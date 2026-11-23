import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SeedOrganization {
  id: string;
  name: string;
  type: 'GOV_AGENCY' | 'COMMERCIAL_ARM' | 'PRIVATE_STARTUP';
  hq_city: string;
  founded_year: number;
  focus_area: string;
  in_space_authorized: boolean;
  website_url: string;
  description: string;
}

interface SeedVehicle {
  id: string;
  organization_id: string;
  name: string;
  stages: number;
  leo_payload_kg: number;
  gto_payload_kg: number;
  propulsion_type: string;
  status: 'OPERATIONAL' | 'DEVELOPMENT' | 'RETIRED';
}

interface SeedMission {
  id: string;
  organization_id: string;
  vehicle_id: string | null;
  mission_code: string;
  title: string;
  program: string;
  launch_date: string;
  launch_site: string;
  orbit_type: string;
  status: 'UPCOMING' | 'SUCCESS' | 'FAILURE' | 'IN_PROGRESS';
  remarks: string;
}

interface SeedPayload {
  id: string;
  mission_id: string;
  organization_id: string;
  name: string;
  mass_kg: number;
  purpose: string;
  country_of_origin: string;
}

interface SeedCentre {
  id: string;
  name: string;
  acronym: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  primary_role: string;
}

interface SeedDataset {
  organizations: SeedOrganization[];
  launch_vehicles: SeedVehicle[];
  missions: SeedMission[];
  payloads: SeedPayload[];
  isro_centres: SeedCentre[];
}

interface SyncJobRecord {
  job_id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  source: string;
  records_upserted: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; data: unknown }>();
const syncJobs = new Map<string, SyncJobRecord>();

const seedPath = path.resolve(__dirname, 'backend', 'data', 'seed_data.json');
const store: SeedDataset = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as SeedDataset;
let lastSyncedAt = new Date().toISOString();

function sendProblem(
  res: Response,
  status: number,
  title: string,
  detail: string,
  instance: string,
) {
  res.status(status).type('application/problem+json').json({
    type: 'https://antariksh.in/errors/api-error',
    title,
    status,
    detail,
    instance,
  });
}

function getCached<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.data as T;
}

function setCached(key: string, data: unknown) {
  responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

function enrichMission(m: SeedMission) {
  const org = store.organizations.find((o) => o.id === m.organization_id);
  const veh = store.launch_vehicles.find((v) => v.id === m.vehicle_id);
  const payloads = store.payloads.filter((p) => p.mission_id === m.id);
  return {
    ...m,
    organization_name: org?.name ?? null,
    organization_type: org?.type ?? null,
    vehicle_name: veh?.name ?? null,
    payloads,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function fetchWithTimeout(url: string, ms = 5000): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AntarikshWatch/1.0' },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runSyncJob(jobId: string) {
  const job = syncJobs.get(jobId);
  if (!job) return;
  job.status = 'RUNNING';

  try {
    let upserted = 0;
    const [launchersData, customerSatsData] = await Promise.all([
      fetchWithTimeout('https://isro.vercel.app/api/launchers'),
      fetchWithTimeout('https://isro.vercel.app/api/customer_satellites'),
    ]);

    if (
      launchersData &&
      typeof launchersData === 'object' &&
      Array.isArray((launchersData as { launchers?: unknown[] }).launchers)
    ) {
      const launchers = (launchersData as { launchers: Array<{ id?: string }> }).launchers;
      for (const item of launchers) {
        const rawId = String(item.id ?? '').trim();
        if (!rawId) continue;
        const vehId = `veh-ext-${slugify(rawId)}`;
        const alreadyKnown =
          store.launch_vehicles.some((v) => v.id === vehId) ||
          /lvm3|gslv|pslv|sslv/i.test(rawId);
        if (!alreadyKnown) {
          store.launch_vehicles.push({
            id: vehId,
            organization_id: 'org-isro',
            name: rawId,
            stages: /pslv/i.test(rawId) ? 4 : 3,
            leo_payload_kg: 1750,
            gto_payload_kg: 0,
            propulsion_type: 'ISRO Heritage Solid/Liquid Stage',
            status: /slv-3|aslv/i.test(rawId) ? 'RETIRED' : 'OPERATIONAL',
          });
          upserted += 1;
        }
      }
    }

    if (
      customerSatsData &&
      typeof customerSatsData === 'object' &&
      Array.isArray(
        (customerSatsData as { customer_satellites?: unknown[] }).customer_satellites,
      )
    ) {
      const sats = (
        customerSatsData as {
          customer_satellites: Array<{
            id?: string;
            country?: string;
            launcher?: string;
            mass?: string;
            launch_date?: string;
          }>;
        }
      ).customer_satellites.slice(0, 12);

      for (const sat of sats) {
        const satName = String(sat.id ?? '').trim();
        const launcher = String(sat.launcher ?? 'PSLV').trim();
        if (!satName) continue;
        const payId = `pay-ext-${slugify(satName)}`;
        const exists = store.payloads.some((p) => p.id === payId);
        if (!exists) {
          const misCode = `ISRO-EXT-${slugify(launcher).toUpperCase().slice(0, 20)}`;
          let mission = store.missions.find((m) => m.mission_code === misCode);
          if (!mission) {
            mission = {
              id: `mis-ext-${slugify(launcher)}`,
              organization_id: 'org-nsil',
              vehicle_id: 'veh-pslv-xl',
              mission_code: misCode,
              title: `${launcher} International Rideshare`,
              program: 'Commercial',
              launch_date: '2023-04-22T08:49:00Z',
              launch_site: 'FLP, SDSC SHAR, Sriharikota',
              orbit_type: 'SSO (Sun-Synchronous)',
              status: 'SUCCESS',
              remarks: `Synced customer satellite manifest launched aboard ${launcher}.`,
            };
            store.missions.push(mission);
            upserted += 1;
          }
          const parsedMass = parseFloat(String(sat.mass ?? '0').replace(/[^0-9.]/g, '')) || 0;
          store.payloads.push({
            id: payId,
            mission_id: mission.id,
            organization_id: 'org-nsil',
            name: satName,
            mass_kg: parsedMass,
            purpose: `International commercial payload launched via ${launcher}`,
            country_of_origin: String(sat.country ?? 'International'),
          });
          upserted += 1;
        }
      }
    }

    responseCache.clear();
    lastSyncedAt = new Date().toISOString();
    job.status = 'COMPLETED';
    job.records_upserted = upserted;
    job.completed_at = lastSyncedAt;
  } catch (err) {
    job.status = 'FAILED';
    job.error_message = err instanceof Error ? err.message : 'Sync failed';
    job.completed_at = new Date().toISOString();
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/v1/missions', (req: Request, res: Response) => {
    const program = typeof req.query.program === 'string' ? req.query.program : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const organizationId =
      typeof req.query.organization_id === 'string' ? req.query.organization_id : undefined;
    const vehicleId = typeof req.query.vehicle_id === 'string' ? req.query.vehicle_id : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    if (
      status &&
      status.toUpperCase() !== 'ALL' &&
      !['UPCOMING', 'SUCCESS', 'FAILURE', 'IN_PROGRESS'].includes(status.toUpperCase())
    ) {
      return sendProblem(
        res,
        400,
        'Invalid Mission Status',
        `Invalid status '${status}'. Expected UPCOMING, SUCCESS, FAILURE, or IN_PROGRESS.`,
        req.path,
      );
    }

    const cacheKey = `missions:${program ?? ''}:${status ?? ''}:${organizationId ?? ''}:${vehicleId ?? ''}:${q ?? ''}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return res.json({ ...cached, cache_hit: true, server_time_utc: new Date().toISOString() });
    }

    let items = store.missions.slice();

    if (program && program.toLowerCase() !== 'all') {
      if (program.toLowerCase() === 'private launches') {
        items = items.filter((m) => {
          const org = store.organizations.find((o) => o.id === m.organization_id);
          return org?.type === 'PRIVATE_STARTUP';
        });
      } else {
        const needle = program.toLowerCase();
        items = items.filter((m) => m.program.toLowerCase().includes(needle));
      }
    }

    if (status && status.toUpperCase() !== 'ALL') {
      items = items.filter((m) => m.status === status.toUpperCase());
    }

    if (organizationId) {
      items = items.filter((m) => m.organization_id === organizationId);
    }

    if (vehicleId) {
      items = items.filter((m) => m.vehicle_id === vehicleId);
    }

    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      items = items.filter((m) => {
        const payloads = store.payloads.filter((p) => p.mission_id === m.id);
        const veh = store.launch_vehicles.find((v) => v.id === m.vehicle_id);
        return (
          m.title.toLowerCase().includes(needle) ||
          m.mission_code.toLowerCase().includes(needle) ||
          m.program.toLowerCase().includes(needle) ||
          m.orbit_type.toLowerCase().includes(needle) ||
          m.remarks.toLowerCase().includes(needle) ||
          (veh?.name.toLowerCase().includes(needle) ?? false) ||
          payloads.some((p) => p.name.toLowerCase().includes(needle))
        );
      });
    }

    items.sort((a, b) => new Date(b.launch_date).getTime() - new Date(a.launch_date).getTime());

    const responseBody = {
      items: items.map(enrichMission),
      total: items.length,
      last_synced_at: lastSyncedAt,
      server_time_utc: new Date().toISOString(),
      cache_hit: false,
    };
    setCached(cacheKey, responseBody);
    return res.json(responseBody);
  });

  app.get('/api/v1/missions/next', (req: Request, res: Response) => {
    const program = typeof req.query.program === 'string' ? req.query.program : undefined;
    const now = Date.now();

    let upcoming = store.missions.filter((m) => m.status === 'UPCOMING');
    if (program && program.toLowerCase() !== 'all') {
      if (program.toLowerCase() === 'private launches') {
        upcoming = upcoming.filter((m) => {
          const org = store.organizations.find((o) => o.id === m.organization_id);
          return org?.type === 'PRIVATE_STARTUP';
        });
      } else {
        const needle = program.toLowerCase();
        upcoming = upcoming.filter((m) => m.program.toLowerCase().includes(needle));
      }
    }

    upcoming.sort(
      (a, b) => new Date(a.launch_date).getTime() - new Date(b.launch_date).getTime(),
    );

    const future = upcoming.find((m) => new Date(m.launch_date).getTime() >= now) ?? upcoming[0];
    if (!future) {
      return sendProblem(
        res,
        404,
        'No Upcoming Mission',
        `No upcoming missions match filter '${program ?? 'All'}'.`,
        req.path,
      );
    }

    return res.json({
      mission: enrichMission(future),
      server_time_utc: new Date(now).toISOString(),
      last_synced_at: lastSyncedAt,
    });
  });

  app.get('/api/v1/vehicles', (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const cacheKey = `vehicles:${status ?? 'all'}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return res.json({ ...cached, cache_hit: true });
    }

    let vehicles = store.launch_vehicles.slice();
    if (status && status.toUpperCase() !== 'ALL') {
      vehicles = vehicles.filter((v) => v.status === status.toUpperCase());
    }
    vehicles.sort((a, b) => b.leo_payload_kg - a.leo_payload_kg);

    const enriched = vehicles.map((v) => {
      const org = store.organizations.find((o) => o.id === v.organization_id);
      return {
        ...v,
        organization_name: org?.name ?? null,
        organization_type: org?.type ?? null,
      };
    });

    const responseBody = {
      items: enriched,
      total: enriched.length,
      last_synced_at: lastSyncedAt,
      cache_hit: false,
    };
    setCached(cacheKey, responseBody);
    return res.json(responseBody);
  });

  app.get('/api/v1/startups', (req: Request, res: Response) => {
    const focus = typeof req.query.focus === 'string' ? req.query.focus : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const cacheKey = `startups:${focus ?? ''}:${q ?? ''}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return res.json({ ...cached, cache_hit: true });
    }

    let startups = store.organizations.filter((o) => o.type === 'PRIVATE_STARTUP');
    if (focus && focus.toLowerCase() !== 'all') {
      const needle = focus.toLowerCase();
      startups = startups.filter((s) => s.focus_area.toLowerCase().includes(needle));
    }
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      startups = startups.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.hq_city.toLowerCase().includes(needle) ||
          s.focus_area.toLowerCase().includes(needle) ||
          s.description.toLowerCase().includes(needle),
      );
    }
    startups.sort((a, b) => a.name.localeCompare(b.name));

    const responseBody = {
      items: startups,
      total: startups.length,
      last_synced_at: lastSyncedAt,
      cache_hit: false,
    };
    setCached(cacheKey, responseBody);
    return res.json(responseBody);
  });

  app.get('/api/v1/centres', (req: Request, res: Response) => {
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const city = typeof req.query.city === 'string' ? req.query.city : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const cacheKey = `centres:${state ?? ''}:${city ?? ''}:${q ?? ''}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return res.json({ ...cached, cache_hit: true });
    }

    let centres = store.isro_centres.slice();
    if (state && state.toLowerCase() !== 'all') {
      const needle = state.toLowerCase();
      centres = centres.filter((c) => c.state.toLowerCase().includes(needle));
    }
    if (city && city.toLowerCase() !== 'all') {
      const needle = city.toLowerCase();
      centres = centres.filter((c) => c.city.toLowerCase().includes(needle));
    }
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      centres = centres.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.acronym.toLowerCase().includes(needle) ||
          c.city.toLowerCase().includes(needle) ||
          c.primary_role.toLowerCase().includes(needle),
      );
    }
    centres.sort((a, b) => a.acronym.localeCompare(b.acronym));

    const responseBody = {
      items: centres,
      total: centres.length,
      last_synced_at: lastSyncedAt,
      cache_hit: false,
    };
    setCached(cacheKey, responseBody);
    return res.json(responseBody);
  });

  app.post('/api/v1/admin/sync', (_req: Request, res: Response) => {
    const jobId = crypto.randomUUID();
    const record: SyncJobRecord = {
      job_id: jobId,
      status: 'QUEUED',
      source: 'api_admin',
      records_upserted: 0,
      error_message: null,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    syncJobs.set(jobId, record);
    void runSyncJob(jobId);
    return res.status(202).json({
      job_id: jobId,
      status: record.status,
      poll_url: `/api/v1/admin/sync/${jobId}`,
    });
  });

  app.get('/api/v1/admin/sync/:jobId', (req: Request, res: Response) => {
    const job = syncJobs.get(req.params.jobId);
    if (!job) {
      return sendProblem(
        res,
        404,
        'Sync Job Not Found',
        `No sync job found with ID '${req.params.jobId}'.`,
        req.path,
      );
    }
    return res.json(job);
  });

  app.get('/api/v1/countdown/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendTick = () => {
      const now = Date.now();
      const upcoming = store.missions
        .filter((m) => m.status === 'UPCOMING')
        .sort((a, b) => new Date(a.launch_date).getTime() - new Date(b.launch_date).getTime());
      const next = upcoming.find((m) => new Date(m.launch_date).getTime() >= now) ?? upcoming[0];
      const launchMs = next ? new Date(next.launch_date).getTime() : now;
      const tMinus = Math.max(0, Math.floor((launchMs - now) / 1000));
      const payload = {
        server_time_utc: new Date(now).toISOString(),
        mission_id: next?.id ?? null,
        mission_code: next?.mission_code ?? null,
        launch_date: next?.launch_date ?? null,
        t_minus_seconds: tMinus,
      };
      res.write(`event: countdown\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    sendTick();
    const interval = setInterval(sendTick, 1000);
    req.on('close', () => {
      clearInterval(interval);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Antariksh Watch server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
