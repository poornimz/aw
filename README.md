# Antariksh Watch — Indian Space Mission & Startup Tracker

Full-stack Indian Space Mission & Startup Tracker aggregating **ISRO missions** (Gaganyaan, Chandrayaan, Aditya-L1, PSLV, GSLV, SSLV, LVM3) alongside **private Indian NewSpace companies** (Skyroot Aerospace, Agnikul Cosmos, Pixxel, Bellatrix Aerospace, Dhruva Space, Digantara, GalaxEye).

---

## Repository Layout

- `backend/` — FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL + Redis + RQ background ingestion worker (`sync_space_data`) + `pytest` suite.
- `flutter_app/` — Single cross-platform Flutter (Dart) codebase configured for both **Flutter Web** (`build/web`) and **Android Release APK** (`app-release.apk`), using web-safe packages (`dio`, `flutter_riverpod`, `web_socket_channel`, `fl_chart`, `intl`, `shimmer`).
- `.github/workflows/build_release.yml` — Automated CI pipeline running backend tests and building both `build/web` and `app-release.apk`.
- `server.ts` & `src/` — Interactive Node/Express + React web preview inside Google AI Studio serving the exact `/api/v1` API contract and mission control interface.

---

## 1. Backend Setup (FastAPI + PostgreSQL + Redis)

### Environment Variables

```bash
export DATABASE_URL="postgresql+psycopg2://antariksh:antariksh@localhost:5432/antariksh_tracker"
export REDIS_URL="redis://localhost:6379/0"
export CORS_ORIGINS="*"
```

### Run Locally

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
python seed.py
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Run Background Worker (RQ + 6-Hour Sync)

```bash
cd backend
rq worker space_sync --url $REDIS_URL
# Or run a one-off ingestion sync:
python worker.py
```

### Run Docker Container

```bash
cd backend
docker build -t antariksh-api .
docker run -p 8000:8000 -e DATABASE_URL=... -e REDIS_URL=... antariksh-api
```

### Run Backend Tests

```bash
cd backend
pytest tests/test_api.py -v
```

---

## 2. Flutter Cross-Platform Build Commands (Web + Android APK)

All API endpoints are injected at compile time via `--dart-define=API_BASE_URL=...` (defaulting to `http://10.0.2.2:8000/api/v1` for Android emulators).

### Fetch Packages & Analyze

```bash
cd flutter_app
flutter pub get
flutter analyze
```

### Build Flutter Web (`build/web`)

```bash
cd flutter_app
flutter build web --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api/v1
```

Deploy `flutter_app/build/web` to Vercel (SPA rewrites configured in `flutter_app/vercel.json`) or Firebase Hosting.

### Build Standalone Android Release APK (`app-release.apk`)

```bash
cd flutter_app
flutter build apk --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api/v1
```

Output artifact:
`flutter_app/build/app/outputs/flutter-apk/app-release.apk`

---

## 3. Architecture Trade-offs & Failure Modes Handled

1. **Client Clock Drift on Countdown Timers**:
   - `GET /api/v1/missions/next` returns both `launch_date` and `server_time_utc`. Additionally, `/api/v1/countdown/stream` (SSE) and `/api/v1/ws/countdown` (WebSocket) broadcast authoritative UTC ticks. The Flutter `countdownTickProvider` computes `clockOffset = serverTime - localUtc` so devices with skewed system clocks display accurate `T- DD:HH:MM:SS`.
2. **Upstream API Rate Limits & Offline Resilience**:
   - External feeds (`isro.vercel.app`, `space.veerexa.com`) are ingested asynchronously in `sync_space_data` (`worker.py`) rather than on user request paths. If any upstream endpoint times out or rate-limits, the worker logs the warning, preserves existing PostgreSQL records, and merges the curated `seed_data.json` fallback dataset.
3. **Redis Cache Stampede & Stale-Cache Fallback**:
   - `GET /api/v1/missions`, `/vehicles`, `/startups`, and `/centres` cache serialized JSON responses in Redis for 10 minutes (`TTL: 600s`) and maintain a `stale:` backup key. When `sync_space_data` finishes, it invalidates cached keys and updates `last_synced_at`. If Redis is unreachable, endpoints degrade gracefully to PostgreSQL without failing requests.
4. **Structured RFC 7807 Errors & Dio Retry Interceptor**:
   - FastAPI returns `application/problem+json` payloads (`type`, `title`, `status`, `detail`, `instance`) for invalid query parameters or missing resources. The Flutter `SpaceApiClient` includes exponential-backoff retries on transient timeouts/5xx errors and surfaces non-crashing retry banners in the UI.
5. **Web-Safe Single Codebase**:
   - Zero `dart:io` or `dart:ffi` imports; uses `dio`, `flutter_riverpod`, `web_socket_channel`, `fl_chart`, `intl`, and `shimmer` so the identical codebase compiles cleanly to both `build/web` and `app-release.apk`.
