import { useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, Orbit, Rocket } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { ListResponse, MissionItem, NextMissionResponse } from '../types/space';
import { EmptyState, ErrorBanner, ShimmerCards, StatusText } from './States';

const QUICK_FILTERS = ['All', 'Gaganyaan', 'Chandrayaan', 'Private Launches'] as const;

interface LaunchControlTabProps {
  onSyncedAt: (iso: string, cacheHit?: boolean) => void;
  refreshToken: number;
}

function splitCountdown(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

export function LaunchControlTab({ onSyncedAt, refreshToken }: LaunchControlTabProps) {
  const [filter, setFilter] = useState<string>('All');
  const [nextMission, setNextMission] = useState<NextMissionResponse | null>(null);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const param = filter === 'All' ? '' : `?program=${encodeURIComponent(filter)}`;
      const [nextRes, listRes] = await Promise.all([
        fetchApi<NextMissionResponse>(`/missions/next${param}`),
        fetchApi<ListResponse<MissionItem>>(`/missions${param}`),
      ]);
      setNextMission(nextRes);
      setMissions(listRes.items);
      const serverMs = new Date(nextRes.server_time_utc).getTime();
      setClockOffsetMs(serverMs - Date.now());
      onSyncedAt(listRes.last_synced_at, listRes.cache_hit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load launch schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, refreshToken]);

  // Local 1s tick corrected by server clock offset
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Authoritative SSE clock sync when viewing All launches
  useEffect(() => {
    if (filter !== 'All') return;
    const es = new EventSource('/api/v1/countdown/stream');
    es.addEventListener('countdown', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as { server_time_utc?: string };
        if (data.server_time_utc) {
          setClockOffsetMs(new Date(data.server_time_utc).getTime() - Date.now());
        }
      } catch {
        // Ignore malformed SSE event
      }
    });
    return () => es.close();
  }, [filter]);

  const countdown = useMemo(() => {
    if (!nextMission) return splitCountdown(0);
    const targetMs = new Date(nextMission.mission.launch_date).getTime();
    const serverAdjustedNow = nowMs + clockOffsetMs;
    const diffSec = Math.max(0, Math.floor((targetMs - serverAdjustedNow) / 1000));
    return splitCountdown(diffSec);
  }, [nextMission, nowMs, clockOffsetMs]);

  const upcomingCount = missions.filter((m) => m.status === 'UPCOMING').length;
  const totalPayloads = missions.reduce((acc, m) => acc + m.payloads.length, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl text-balance">
            Launch Control
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Authoritative UTC launch countdown and flight readiness manifest across ISRO &amp; NewSpace vehicles.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Mission program quick filter"
          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0F141F] p-1"
        >
          {QUICK_FILTERS.map((item) => {
            const active = filter === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item)}
                className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadData} />}

      {loading ? (
        <ShimmerCards count={3} height="h-44" />
      ) : !nextMission ? (
        <EmptyState
          title={`No upcoming launches for "${filter}"`}
          subtitle="Switch back to all missions to restore the live countdown and upcoming launch queue."
          onReset={() => setFilter('All')}
        />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
            <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0F141F] p-6 lg:col-span-7">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="font-mono text-cyan-400">
                    {nextMission.mission.mission_code} · {nextMission.mission.program}
                  </span>
                  <StatusText status={nextMission.mission.status} />
                </div>

                <h2 className="mt-3 text-2xl font-bold text-slate-100 sm:text-3xl text-balance">
                  {nextMission.mission.title}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Rocket className="h-3.5 w-3.5 text-cyan-400" />
                    {nextMission.mission.vehicle_name ?? 'Vehicle TBD'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {nextMission.mission.launch_site}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Orbit className="h-3.5 w-3.5 text-slate-400" />
                    {nextMission.mission.orbit_type}
                  </span>
                </div>

                <div className="mt-6 rounded-lg border border-slate-800 bg-[#07090E] p-5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono tracking-wider uppercase">
                      T-Minus Countdown (Server Synced UTC)
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(nextMission.mission.launch_date).toUTCString().replace('GMT', 'UTC')}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {[
                      { label: 'Days', value: countdown.days },
                      { label: 'Hours', value: countdown.hours },
                      { label: 'Minutes', value: countdown.minutes },
                      { label: 'Seconds', value: countdown.seconds },
                    ].map((unit) => (
                      <div
                        key={unit.label}
                        className="rounded-lg border border-slate-800/80 bg-[#0F141F] px-3 py-3 text-center"
                      >
                        <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums sm:text-4xl">
                          {unit.value}
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-slate-400">
                          {unit.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-slate-300">
                {nextMission.mission.remarks}
              </p>
            </div>

            <div className="relative min-h-[260px] overflow-hidden rounded-xl border border-slate-800 bg-[#0F141F] lg:col-span-5">
              {!imgFailed ? (
                <img
                  src="/src/assets/images/launch_pad_sriharikota_1795412934338.jpg"
                  alt="Orbital launch vehicle on the coastal umbilical pad at Satish Dhawan Space Centre, Sriharikota"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover lg:h-full"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0F141F] via-[#0B1220] to-[#07090E] p-6 text-center">
                  <Rocket className="h-10 w-10 text-cyan-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-200">
                    {nextMission.mission.launch_site}
                  </p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#07090E] via-[#07090E]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="font-mono text-xs text-cyan-300">
                  {nextMission.mission.organization_name ?? 'ISRO'}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {nextMission.mission.launch_site}
                </p>
                <p className="mt-1 text-xs text-slate-300 font-mono tabular-nums">
                  {nextMission.mission.payloads.length} manifested payload(s) ·{' '}
                  {nextMission.mission.payloads
                    .reduce((sum, p) => sum + p.mass_kg, 0)
                    .toLocaleString()}{' '}
                  kg
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0F141F] p-4">
              <div className="text-xs text-slate-400">Filtered Missions</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100 tabular-nums">
                {missions.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0F141F] p-4">
              <div className="text-xs text-slate-400">Upcoming Manifested</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-amber-400 tabular-nums">
                {upcomingCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0F141F] p-4">
              <div className="text-xs text-slate-400">Tracked Payloads</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-cyan-400 tabular-nums">
                {totalPayloads}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0F141F] p-4">
              <div className="text-xs text-slate-400">Primary Spaceport</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100">
                SHAR
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-100">
              Mission Manifest ({missions.length})
            </h3>
            {missions.length === 0 ? (
              <EmptyState
                title={`No missions match "${filter}"`}
                subtitle="Reset quick filters to display all ISRO and private startup launches."
                onReset={() => setFilter('All')}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {missions.map((m) => (
                  <article
                    key={m.id}
                    className="rounded-xl border border-slate-800 bg-[#0F141F] p-5 transition-colors hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-base font-semibold text-slate-100">{m.title}</h4>
                      <StatusText status={m.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-slate-400 tabular-nums">
                      <span className="text-cyan-400">{m.mission_code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{m.vehicle_name ?? 'Vehicle TBD'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(m.launch_date).toISOString().slice(0, 10)}</span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-400 line-clamp-2">
                      {m.remarks}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                      <span>{m.orbit_type}</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {m.payloads.length} payload{m.payloads.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
