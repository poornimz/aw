import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import redis
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from rq import Queue
from sqlalchemy import asc, desc, or_
from sqlalchemy.orm import Session, joinedload

from database import SessionLocal, engine, get_db
from models import (
    Base,
    IsroCentre,
    LaunchVehicle,
    Mission,
    MissionStatus,
    Organization,
    OrganizationType,
    Payload,
    SyncJob,
    SyncJobStatus,
)
from seed import upsert_seed_data
from worker import LAST_SYNCED_KEY, get_redis_client, sync_space_data

logger = logging.getLogger("antariksh.api")

CACHE_TTL_SECONDS = 600  # 10 minutes


class ProblemDetails(BaseModel):
    type: str = "about:blank"
    title: str
    status: int
    detail: str
    instance: Optional[str] = None


def problem_response(status: int, title: str, detail: str, instance: Optional[str] = None, type_uri: str = "https://antariksh.in/errors/api-error") -> JSONResponse:
    return JSONResponse(
        status_code=status,
        media_type="application/problem+json",
        content=ProblemDetails(
            type=type_uri,
            title=title,
            status=status,
            detail=detail,
            instance=instance,
        ).model_dump(),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Mission).count() == 0:
            upsert_seed_data(db)
    finally:
        db.close()

    r = get_redis_client()
    if r and not r.get(LAST_SYNCED_KEY):
        r.set(LAST_SYNCED_KEY, datetime.now(timezone.utc).isoformat())
    yield


app = FastAPI(
    title="Indian Space Mission & Startup Tracker API",
    version="1.0.0",
    description="Aggregates ISRO missions, launch vehicles, payloads, ISRO centres, and Indian NewSpace startups.",
    lifespan=lifespan,
)

allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return problem_response(
        status=exc.status_code,
        title="Request Error",
        detail=str(exc.detail),
        instance=str(request.url.path),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception: %s", exc)
    return problem_response(
        status=500,
        title="Internal Server Error",
        detail="An unexpected server error occurred. Cached or fallback records remain available.",
        instance=str(request.url.path),
    )


def _get_last_synced_at(r: Optional[redis.Redis]) -> str:
    if r:
        try:
            val = r.get(LAST_SYNCED_KEY)
            if val:
                return val
        except Exception:
            pass
    return datetime.now(timezone.utc).isoformat()


def _cache_get(r: Optional[redis.Redis], key: str) -> Optional[Dict[str, Any]]:
    if not r:
        return None
    try:
        raw = r.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def _cache_set(r: Optional[redis.Redis], key: str, value: Dict[str, Any], ttl: int = CACHE_TTL_SECONDS) -> None:
    if not r:
        return
    try:
        r.setex(key, ttl, json.dumps(value))
        r.set(f"stale:{key}", json.dumps(value))
    except Exception:
        pass


def _serialize_mission(m: Mission) -> Dict[str, Any]:
    return {
        "id": m.id,
        "organization_id": m.organization_id,
        "organization_name": m.organization.name if m.organization else None,
        "organization_type": m.organization.type.value if m.organization else None,
        "vehicle_id": m.vehicle_id,
        "vehicle_name": m.vehicle.name if m.vehicle else None,
        "mission_code": m.mission_code,
        "title": m.title,
        "program": m.program,
        "launch_date": m.launch_date.astimezone(timezone.utc).isoformat(),
        "launch_site": m.launch_site,
        "orbit_type": m.orbit_type,
        "status": m.status.value,
        "remarks": m.remarks,
        "payloads": [
            {
                "id": p.id,
                "mission_id": p.mission_id,
                "organization_id": p.organization_id,
                "name": p.name,
                "mass_kg": p.mass_kg,
                "purpose": p.purpose,
                "country_of_origin": p.country_of_origin,
            }
            for p in m.payloads
        ],
    }


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "antariksh-api", "time_utc": datetime.now(timezone.utc).isoformat()}


@app.get("/api/v1/missions")
def list_missions(
    program: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    organization_id: Optional[str] = Query(default=None),
    vehicle_id: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    r = get_redis_client()
    cache_key = f"cache:missions:{program or ''}:{status or ''}:{organization_id or ''}:{vehicle_id or ''}:{q or ''}"
    cached = _cache_get(r, cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    query = db.query(Mission).options(
        joinedload(Mission.organization),
        joinedload(Mission.vehicle),
        joinedload(Mission.payloads),
    )

    if program and program.lower() != "all":
        if program.lower() == "private launches":
            query = query.join(Mission.organization).filter(Organization.type == OrganizationType.PRIVATE_STARTUP)
        else:
            query = query.filter(Mission.program.ilike(f"%{program}%"))

    if status and status.upper() != "ALL":
        try:
            query = query.filter(Mission.status == MissionStatus(status.upper()))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid mission status '{status}'. Expected UPCOMING, SUCCESS, FAILURE, or IN_PROGRESS.")

    if organization_id:
        query = query.filter(Mission.organization_id == organization_id)

    if vehicle_id:
        query = query.filter(Mission.vehicle_id == vehicle_id)

    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Mission.title.ilike(pattern),
                Mission.mission_code.ilike(pattern),
                Mission.program.ilike(pattern),
                Mission.remarks.ilike(pattern),
                Mission.orbit_type.ilike(pattern),
            )
        )

    missions = query.order_by(desc(Mission.launch_date)).all()
    last_synced = _get_last_synced_at(r)
    payload = {
        "items": [_serialize_mission(m) for m in missions],
        "total": len(missions),
        "last_synced_at": last_synced,
        "server_time_utc": datetime.now(timezone.utc).isoformat(),
        "cache_hit": False,
    }
    _cache_set(r, cache_key, payload)
    return payload


@app.get("/api/v1/missions/next")
def get_next_mission(
    program: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    r = get_redis_client()
    now = datetime.now(timezone.utc)
    query = (
        db.query(Mission)
        .options(joinedload(Mission.organization), joinedload(Mission.vehicle), joinedload(Mission.payloads))
        .filter(Mission.status == MissionStatus.UPCOMING)
    )
    if program and program.lower() != "all":
        if program.lower() == "private launches":
            query = query.join(Mission.organization).filter(Organization.type == OrganizationType.PRIVATE_STARTUP)
        else:
            query = query.filter(Mission.program.ilike(f"%{program}%"))

    upcoming = query.filter(Mission.launch_date >= now).order_by(asc(Mission.launch_date)).first()
    if not upcoming:
        upcoming = query.order_by(asc(Mission.launch_date)).first()

    if not upcoming:
        raise HTTPException(status_code=404, detail="No upcoming missions found for the requested filter.")

    return {
        "mission": _serialize_mission(upcoming),
        "server_time_utc": now.isoformat(),
        "last_synced_at": _get_last_synced_at(r),
    }


@app.get("/api/v1/vehicles")
def list_vehicles(
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    r = get_redis_client()
    cache_key = f"cache:vehicles:{status or 'all'}"
    cached = _cache_get(r, cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    query = db.query(LaunchVehicle).options(joinedload(LaunchVehicle.organization))
    if status and status.upper() != "ALL":
        query = query.filter(LaunchVehicle.status == status.upper())

    vehicles = query.order_by(desc(LaunchVehicle.leo_payload_kg)).all()
    payload = {
        "items": [
            {
                "id": v.id,
                "organization_id": v.organization_id,
                "organization_name": v.organization.name if v.organization else None,
                "organization_type": v.organization.type.value if v.organization else None,
                "name": v.name,
                "stages": v.stages,
                "leo_payload_kg": v.leo_payload_kg,
                "gto_payload_kg": v.gto_payload_kg,
                "propulsion_type": v.propulsion_type,
                "status": v.status.value,
            }
            for v in vehicles
        ],
        "total": len(vehicles),
        "last_synced_at": _get_last_synced_at(r),
        "cache_hit": False,
    }
    _cache_set(r, cache_key, payload)
    return payload


@app.get("/api/v1/startups")
def list_startups(
    focus: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    r = get_redis_client()
    cache_key = f"cache:startups:{focus or ''}:{q or ''}"
    cached = _cache_get(r, cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    query = db.query(Organization).filter(Organization.type == OrganizationType.PRIVATE_STARTUP)
    if focus and focus.lower() != "all":
        query = query.filter(Organization.focus_area.ilike(f"%{focus}%"))
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Organization.name.ilike(pattern),
                Organization.hq_city.ilike(pattern),
                Organization.focus_area.ilike(pattern),
                Organization.description.ilike(pattern),
            )
        )

    startups = query.order_by(asc(Organization.name)).all()
    payload = {
        "items": [
            {
                "id": s.id,
                "name": s.name,
                "type": s.type.value,
                "hq_city": s.hq_city,
                "founded_year": s.founded_year,
                "focus_area": s.focus_area,
                "in_space_authorized": s.in_space_authorized,
                "website_url": s.website_url,
                "description": s.description,
            }
            for s in startups
        ],
        "total": len(startups),
        "last_synced_at": _get_last_synced_at(r),
        "cache_hit": False,
    }
    _cache_set(r, cache_key, payload)
    return payload


@app.get("/api/v1/centres")
def list_centres(
    state: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    r = get_redis_client()
    cache_key = f"cache:centres:{state or ''}:{city or ''}:{q or ''}"
    cached = _cache_get(r, cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    query = db.query(IsroCentre)
    if state and state.lower() != "all":
        query = query.filter(IsroCentre.state.ilike(f"%{state}%"))
    if city and city.lower() != "all":
        query = query.filter(IsroCentre.city.ilike(f"%{city}%"))
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                IsroCentre.name.ilike(pattern),
                IsroCentre.acronym.ilike(pattern),
                IsroCentre.city.ilike(pattern),
                IsroCentre.primary_role.ilike(pattern),
            )
        )

    centres = query.order_by(asc(IsroCentre.acronym)).all()
    payload = {
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "acronym": c.acronym,
                "city": c.city,
                "state": c.state,
                "latitude": c.latitude,
                "longitude": c.longitude,
                "primary_role": c.primary_role,
            }
            for c in centres
        ],
        "total": len(centres),
        "last_synced_at": _get_last_synced_at(r),
        "cache_hit": False,
    }
    _cache_set(r, cache_key, payload)
    return payload


@app.post("/api/v1/admin/sync", status_code=202)
def trigger_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> Dict[str, Any]:
    job_id = str(uuid.uuid4())
    job = SyncJob(id=job_id, status=SyncJobStatus.QUEUED, source="api_admin")
    db.add(job)
    db.commit()

    r = get_redis_client()
    enqueued_via = "fastapi_background"
    if r:
        try:
            q = Queue("space_sync", connection=r)
            q.enqueue(sync_space_data, job_id, "rq_worker")
            enqueued_via = "rq_worker"
        except Exception:
            background_tasks.add_task(sync_space_data, job_id, "fastapi_background")
    else:
        background_tasks.add_task(sync_space_data, job_id, "fastapi_background")

    return {
        "job_id": job_id,
        "status": "QUEUED",
        "enqueued_via": enqueued_via,
        "poll_url": f"/api/v1/admin/sync/{job_id}",
    }


@app.get("/api/v1/admin/sync/{job_id}")
def get_sync_status(job_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    job = db.get(SyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Sync job '{job_id}' not found.")
    return {
        "job_id": job.id,
        "status": job.status.value,
        "source": job.source,
        "records_upserted": job.records_upserted,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


@app.get("/api/v1/countdown/stream")
async def countdown_sse() -> StreamingResponse:
    async def event_generator():
        while True:
            db = SessionLocal()
            try:
                now = datetime.now(timezone.utc)
                next_mission = (
                    db.query(Mission)
                    .filter(Mission.status == MissionStatus.UPCOMING, Mission.launch_date >= now)
                    .order_by(asc(Mission.launch_date))
                    .first()
                )
                payload = {
                    "server_time_utc": now.isoformat(),
                    "mission_id": next_mission.id if next_mission else None,
                    "mission_code": next_mission.mission_code if next_mission else None,
                    "launch_date": next_mission.launch_date.astimezone(timezone.utc).isoformat() if next_mission else None,
                    "t_minus_seconds": max(0, int((next_mission.launch_date.astimezone(timezone.utc) - now).total_seconds())) if next_mission else 0,
                }
                yield f"event: countdown\ndata: {json.dumps(payload)}\n\n"
            finally:
                db.close()
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.websocket("/api/v1/ws/countdown")
async def countdown_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            db = SessionLocal()
            try:
                now = datetime.now(timezone.utc)
                next_mission = (
                    db.query(Mission)
                    .filter(Mission.status == MissionStatus.UPCOMING, Mission.launch_date >= now)
                    .order_by(asc(Mission.launch_date))
                    .first()
                )
                await websocket.send_json(
                    {
                        "server_time_utc": now.isoformat(),
                        "mission_id": next_mission.id if next_mission else None,
                        "mission_code": next_mission.mission_code if next_mission else None,
                        "launch_date": next_mission.launch_date.astimezone(timezone.utc).isoformat() if next_mission else None,
                        "t_minus_seconds": max(0, int((next_mission.launch_date.astimezone(timezone.utc) - now).total_seconds())) if next_mission else 0,
                    }
                )
            finally:
                db.close()
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
