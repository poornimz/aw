import os
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_antariksh.db"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from seed import init_and_seed  # noqa: E402

init_and_seed()
client = TestClient(app)


def test_list_missions_and_filters():
    resp = client.get("/api/v1/missions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 10
    assert "last_synced_at" in data

    gaganyaan = client.get("/api/v1/missions", params={"program": "Gaganyaan"})
    assert gaganyaan.status_code == 200
    assert gaganyaan.json()["total"] >= 1


def test_invalid_status_returns_rfc7807():
    resp = client.get("/api/v1/missions", params={"status": "INVALID_STATE"})
    assert resp.status_code == 400
    assert resp.headers["content-type"].startswith("application/problem+json")
    body = resp.json()
    assert body["status"] == 400
    assert "title" in body and "detail" in body


def test_next_mission_includes_server_time():
    resp = client.get("/api/v1/missions/next")
    assert resp.status_code == 200
    data = resp.json()
    assert "server_time_utc" in data
    assert data["mission"]["status"] == "UPCOMING"


def test_vehicles_startups_and_centres():
    v_resp = client.get("/api/v1/vehicles")
    assert v_resp.status_code == 200
    assert any("LVM3" in v["name"] for v in v_resp.json()["items"])

    s_resp = client.get("/api/v1/startups", params={"focus": "Launch"})
    assert s_resp.status_code == 200
    names = [s["name"] for s in s_resp.json()["items"]]
    assert "Skyroot Aerospace" in names
    assert "Agnikul Cosmos" in names

    c_resp = client.get("/api/v1/centres", params={"state": "Kerala"})
    assert c_resp.status_code == 200
    acronyms = [c["acronym"] for c in c_resp.json()["items"]]
    assert "VSSC" in acronyms


def test_admin_sync_job_enqueue():
    resp = client.post("/api/v1/admin/sync")
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]
    poll = client.get(f"/api/v1/admin/sync/{job_id}")
    assert poll.status_code == 200
    assert poll.json()["job_id"] == job_id
