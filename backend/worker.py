import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
import redis
from sqlalchemy.orm import Session

from database import SessionLocal, engine
from models import (
    Base,
    IsroCentre,
    LaunchVehicle,
    Mission,
    MissionStatus,
    Payload,
    SyncJob,
    SyncJobStatus,
    VehicleStatus,
)
from seed import upsert_seed_data

logger = logging.getLogger("antariksh.worker")
logging.basicConfig(level=logging.INFO)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
VEEREXA_API_BASE = os.getenv("VEEREXA_API_BASE", "https://space.veerexa.com/api/v1")
ISRO_API_BASE = os.getenv("ISRO_API_BASE", "https://isro.vercel.app/api")
SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", str(6 * 3600)))

LAST_SYNCED_KEY = "antariksh:last_synced_at"


def get_redis_client() -> Optional[redis.Redis]:
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2.0)
        client.ping()
        return client
    except Exception as exc:
        logger.warning("Redis unavailable (%s); continuing with DB-only mode.", exc)
        return None


def invalidate_space_caches(r: Optional[redis.Redis]) -> int:
    if r is None:
        return 0
    deleted = 0
    try:
        for pattern in ("cache:missions:*", "cache:vehicles*", "cache:startups*", "cache:centres*", "cache:next_mission*"):
            keys = list(r.scan_iter(match=pattern))
            if keys:
                deleted += r.delete(*keys)
        r.set(LAST_SYNCED_KEY, datetime.now(timezone.utc).isoformat())
    except Exception as exc:
        logger.warning("Failed to invalidate Redis caches: %s", exc)
    return deleted


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:48]


async def _fetch_json(client: httpx.AsyncClient, url: str) -> Optional[Dict[str, Any]]:
    try:
        resp = await client.get(url, timeout=8.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("Upstream fetch failed for %s: %s", url, exc)
        return None


async def fetch_external_space_feeds() -> Dict[str, Any]:
    async with httpx.AsyncClient(headers={"User-Agent": "AntarikshWatch/1.0"}) as client:
        spacecrafts, launchers, customer_sats, centres, veerexa_missions = await asyncio.gather(
            _fetch_json(client, f"{ISRO_API_BASE}/spacecrafts"),
            _fetch_json(client, f"{ISRO_API_BASE}/launchers"),
            _fetch_json(client, f"{ISRO_API_BASE}/customer_satellites"),
            _fetch_json(client, f"{ISRO_API_BASE}/centres"),
            _fetch_json(client, f"{VEEREXA_API_BASE}/missions"),
        )
    return {
        "spacecrafts": (spacecrafts or {}).get("spacecrafts", []),
        "launchers": (launchers or {}).get("launchers", []),
        "customer_satellites": (customer_sats or {}).get("customer_satellites", []),
        "centres": (centres or {}).get("centres", []),
        "veerexa_missions": (veerexa_missions or {}).get("missions", []) if isinstance(veerexa_missions, dict) else [],
    }


def _normalize_and_upsert_upstream(db: Session, feeds: Dict[str, Any]) -> int:
    upserted = 0

    for item in feeds.get("launchers", []):
        raw_id = str(item.get("id", "")).strip()
        if not raw_id:
            continue
        veh_id = f"veh-ext-{_slugify(raw_id)}"
        if not db.get(LaunchVehicle, veh_id) and not any(k in raw_id.lower() for k in ("lvm3", "gslv", "pslv", "sslv")):
            db.add(
                LaunchVehicle(
                    id=veh_id,
                    organization_id="org-isro",
                    name=raw_id,
                    stages=4 if "pslv" in raw_id.lower() else 3,
                    leo_payload_kg=1750,
                    gto_payload_kg=0,
                    propulsion_type="ISRO Heritage Solid/Liquid Stage",
                    status=VehicleStatus.RETIRED if "slv-3" in raw_id.lower() or "aslv" in raw_id.lower() else VehicleStatus.OPERATIONAL,
                )
            )
            upserted += 1

    for idx, sat in enumerate(feeds.get("customer_satellites", [])[:20]):
        sat_id_raw = str(sat.get("id", f"cust-{idx}")).strip()
        country = str(sat.get("country", "International")).strip() or "International"
        launcher = str(sat.get("launcher", "PSLV")).strip()
        launch_date_str = str(sat.get("launch_date", "")).strip()
        mass_raw = str(sat.get("mass", "0")).strip()
        try:
            mass_kg = float(re.sub(r"[^0-9.]", "", mass_raw) or 0.0)
        except ValueError:
            mass_kg = 0.0

        mission_code = f"ISRO-EXT-{_slugify(launcher).upper()[:24]}"
        mission = db.query(Mission).filter(Mission.mission_code == mission_code).first()
        if not mission:
            parsed_dt = datetime(2023, 1, 1, tzinfo=timezone.utc)
            if launch_date_str:
                for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
                    try:
                        parsed_dt = datetime.strptime(launch_date_str, fmt).replace(tzinfo=timezone.utc)
                        break
                    except ValueError:
                        continue
            mission = Mission(
                id=f"mis-ext-{_slugify(launcher)}",
                organization_id="org-nsil",
                vehicle_id="veh-pslv-xl",
                mission_code=mission_code,
                title=f"{launcher} Commercial Rideshare",
                program="Commercial",
                launch_date=parsed_dt,
                launch_site="SDSC SHAR, Sriharikota",
                orbit_type="SSO (Sun-Synchronous)",
                status=MissionStatus.SUCCESS,
                remarks=f"Synced commercial customer launch on {launcher}.",
            )
            db.add(mission)
            db.flush()
            upserted += 1

        pay_id = f"pay-ext-{_slugify(sat_id_raw)}"
        if not db.get(Payload, pay_id):
            db.add(
                Payload(
                    id=pay_id,
                    mission_id=mission.id,
                    organization_id="org-nsil",
                    name=sat_id_raw,
                    mass_kg=mass_kg,
                    purpose=f"Customer satellite launched aboard {launcher}",
                    country_of_origin=country,
                )
            )
            upserted += 1

    for ctr in feeds.get("centres", []):
        name = str(ctr.get("name", "")).strip()
        place = str(ctr.get("Place", "")).strip()
        state = str(ctr.get("State", "")).strip()
        if not name or not place:
            continue
        existing = db.query(IsroCentre).filter(IsroCentre.name.ilike(f"%{name[:24]}%")).first()
        if not existing:
            acronym = "".join(w[0] for w in name.split() if w[0].isalpha())[:8].upper() or "ISRO"
            ctr_id = f"ctr-ext-{_slugify(name)}"
            if not db.query(IsroCentre).filter(IsroCentre.acronym == acronym).first() and not db.get(IsroCentre, ctr_id):
                db.add(
                    IsroCentre(
                        id=ctr_id,
                        name=name,
                        acronym=acronym,
                        city=place,
                        state=state or "India",
                        latitude=13.0,
                        longitude=77.6,
                        primary_role=f"ISRO facility located in {place}, {state}.",
                    )
                )
                upserted += 1

    db.commit()
    return upserted


def sync_space_data(job_id: Optional[str] = None, source: str = "scheduled") -> Dict[str, Any]:
    """
    RQ-compatible synchronous entrypoint for background space data ingestion.
    1. Ensures curated seed/fallback dataset is present in PostgreSQL.
    2. Fetches external ISRO & Space Veerexa feeds with timeouts and graceful fallback.
    3. Normalizes & upserts records into PostgreSQL.
    4. Invalidates stale Redis caches and records last_synced_at.
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    redis_client = get_redis_client()

    job: Optional[SyncJob] = None
    if job_id:
        job = db.get(SyncJob, job_id)
        if job:
            job.status = SyncJobStatus.RUNNING
            db.commit()

    try:
        seed_count = upsert_seed_data(db)
        feeds = asyncio.run(fetch_external_space_feeds())
        ext_count = _normalize_and_upsert_upstream(db, feeds)
        total_upserted = seed_count + ext_count
        invalidated = invalidate_space_caches(redis_client)

        if job:
            job.status = SyncJobStatus.COMPLETED
            job.records_upserted = total_upserted
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

        logger.info("sync_space_data completed: upserted=%d invalidated_keys=%d", total_upserted, invalidated)
        return {
            "job_id": job_id,
            "status": "COMPLETED",
            "source": source,
            "records_upserted": total_upserted,
            "invalidated_keys": invalidated,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        logger.exception("sync_space_data failed: %s", exc)
        if job:
            job.status = SyncJobStatus.FAILED
            job.error_message = str(exc)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
        return {
            "job_id": job_id,
            "status": "FAILED",
            "error": str(exc),
        }
    finally:
        db.close()


async def run_periodic_sync_loop() -> None:
    while True:
        logger.info("Running 6-hour scheduled space data sync...")
        await asyncio.to_thread(sync_space_data, None, "6h_scheduler")
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)


if __name__ == "__main__":
    result = sync_space_data(source="cli")
    print(json.dumps(result, indent=2))
