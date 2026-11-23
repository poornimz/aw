import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from sqlalchemy.orm import Session

from database import SessionLocal, engine
from models import (
    Base,
    IsroCentre,
    LaunchVehicle,
    Mission,
    MissionStatus,
    Organization,
    OrganizationType,
    Payload,
    VehicleStatus,
)

SEED_FILE = Path(__file__).resolve().parent / "data" / "seed_data.json"


def load_seed_payload() -> Dict[str, Any]:
    with SEED_FILE.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def parse_iso_dt(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def upsert_seed_data(db: Session, data: Dict[str, Any] | None = None) -> int:
    payload = data or load_seed_payload()
    count = 0

    for org in payload.get("organizations", []):
        existing = db.get(Organization, org["id"])
        if existing:
            existing.name = org["name"]
            existing.type = OrganizationType(org["type"])
            existing.hq_city = org["hq_city"]
            existing.founded_year = org["founded_year"]
            existing.focus_area = org["focus_area"]
            existing.in_space_authorized = org["in_space_authorized"]
            existing.website_url = org["website_url"]
            existing.description = org["description"]
        else:
            db.add(
                Organization(
                    id=org["id"],
                    name=org["name"],
                    type=OrganizationType(org["type"]),
                    hq_city=org["hq_city"],
                    founded_year=org["founded_year"],
                    focus_area=org["focus_area"],
                    in_space_authorized=org["in_space_authorized"],
                    website_url=org["website_url"],
                    description=org["description"],
                )
            )
        count += 1

    db.flush()

    for veh in payload.get("launch_vehicles", []):
        existing = db.get(LaunchVehicle, veh["id"])
        if existing:
            existing.organization_id = veh["organization_id"]
            existing.name = veh["name"]
            existing.stages = veh["stages"]
            existing.leo_payload_kg = veh["leo_payload_kg"]
            existing.gto_payload_kg = veh["gto_payload_kg"]
            existing.propulsion_type = veh["propulsion_type"]
            existing.status = VehicleStatus(veh["status"])
        else:
            db.add(
                LaunchVehicle(
                    id=veh["id"],
                    organization_id=veh["organization_id"],
                    name=veh["name"],
                    stages=veh["stages"],
                    leo_payload_kg=veh["leo_payload_kg"],
                    gto_payload_kg=veh["gto_payload_kg"],
                    propulsion_type=veh["propulsion_type"],
                    status=VehicleStatus(veh["status"]),
                )
            )
        count += 1

    db.flush()

    for mis in payload.get("missions", []):
        existing = db.get(Mission, mis["id"])
        launch_dt = parse_iso_dt(mis["launch_date"])
        if existing:
            existing.organization_id = mis["organization_id"]
            existing.vehicle_id = mis.get("vehicle_id")
            existing.mission_code = mis["mission_code"]
            existing.title = mis["title"]
            existing.program = mis["program"]
            existing.launch_date = launch_dt
            existing.launch_site = mis["launch_site"]
            existing.orbit_type = mis["orbit_type"]
            existing.status = MissionStatus(mis["status"])
            existing.remarks = mis["remarks"]
        else:
            db.add(
                Mission(
                    id=mis["id"],
                    organization_id=mis["organization_id"],
                    vehicle_id=mis.get("vehicle_id"),
                    mission_code=mis["mission_code"],
                    title=mis["title"],
                    program=mis["program"],
                    launch_date=launch_dt,
                    launch_site=mis["launch_site"],
                    orbit_type=mis["orbit_type"],
                    status=MissionStatus(mis["status"]),
                    remarks=mis["remarks"],
                )
            )
        count += 1

    db.flush()

    for pay in payload.get("payloads", []):
        existing = db.get(Payload, pay["id"])
        if existing:
            existing.mission_id = pay["mission_id"]
            existing.organization_id = pay["organization_id"]
            existing.name = pay["name"]
            existing.mass_kg = float(pay.get("mass_kg", 0.0))
            existing.purpose = pay["purpose"]
            existing.country_of_origin = pay.get("country_of_origin", "India")
        else:
            db.add(
                Payload(
                    id=pay["id"],
                    mission_id=pay["mission_id"],
                    organization_id=pay["organization_id"],
                    name=pay["name"],
                    mass_kg=float(pay.get("mass_kg", 0.0)),
                    purpose=pay["purpose"],
                    country_of_origin=pay.get("country_of_origin", "India"),
                )
            )
        count += 1

    for ctr in payload.get("isro_centres", []):
        existing = db.get(IsroCentre, ctr["id"])
        if existing:
            existing.name = ctr["name"]
            existing.acronym = ctr["acronym"]
            existing.city = ctr["city"]
            existing.state = ctr["state"]
            existing.latitude = float(ctr["latitude"])
            existing.longitude = float(ctr["longitude"])
            existing.primary_role = ctr["primary_role"]
        else:
            db.add(
                IsroCentre(
                    id=ctr["id"],
                    name=ctr["name"],
                    acronym=ctr["acronym"],
                    city=ctr["city"],
                    state=ctr["state"],
                    latitude=float(ctr["latitude"]),
                    longitude=float(ctr["longitude"]),
                    primary_role=ctr["primary_role"],
                )
            )
        count += 1

    db.commit()
    return count


def init_and_seed() -> int:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        return upsert_seed_data(db)
    finally:
        db.close()


if __name__ == "__main__":
    total = init_and_seed()
    print(f"Seeded/updated {total} records successfully.")
