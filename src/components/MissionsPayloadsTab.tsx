import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Package, Search } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { ListResponse, MissionItem } from '../types/space';
import { EmptyState, ErrorBanner, ShimmerCards, StatusText } from './States';

const PROGRAMS = [
  'All',
  'Gaganyaan',
  'Chandrayaan',
  'Earth Observation',
  'Navigation',
  'Commercial',
];

const STATUSES = ['ALL', 'UPCOMING', 'SUCCESS', 'FAILURE'] as const;

interface MissionsPayloadsTabProps {
  onSyncedAt: (iso: string, cacheHit?: boolean) => void;
  refreshToken: number;
}

export function MissionsPayloadsTab({ onSyncedAt, refreshToken }: MissionsPayloadsTabProps) {
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState('All');
  const [status, setStatus] = useState<string>('ALL');
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (program !== 'All') params.set('program', program);
      if (status !== 'ALL') params.set('status', status);
      if (query.trim()) params.set('q', query.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetchApi<ListResponse<MissionItem>>(`/missions${qs}`);
      setMissions(res.items);
      onSyncedAt(res.last_synced_at, res.cache_hit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch missions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadMissions();
    }, 180);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, program, status, refreshToken]);

  const resetFilters = () => {
    setQuery('');
    setProgram('All');
    setStatus('ALL');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
          Missions &amp; Payloads
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Searchable mission timeline with expandable satellite manifests, mass budgets, and target orbits.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0F141F] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mission code, satellite, rocket, or orbit..."
            aria-label="Search missions and payloads"
            className="w-full rounded-lg border border-slate-800 bg-[#07090E] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span>Program</span>
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#07090E] px-3 py-2 text-xs font-medium text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              {PROGRAMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <div
            role="group"
            aria-label="Filter by mission status"
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#07090E] p-1"
          >
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  status === s
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadMissions} />}

      {loading ? (
        <ShimmerCards count={5} height="h-28" />
      ) : missions.length === 0 ? (
        <EmptyState
          title="No missions matched your query"
          subtitle="Clear active search terms or program/status filters to restore the full mission archive."
          onReset={resetFilters}
        />
      ) : (
        <div className="space-y-3">
          {missions.map((m) => {
            const expanded = expandedId === m.id;
            const totalMass = m.payloads.reduce((sum, p) => sum + p.mass_kg, 0);
            return (
              <article
                key={m.id}
                className="rounded-xl border border-slate-800 bg-[#0F141F] transition-colors hover:border-slate-700"
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : m.id)}
                  className="flex w-full items-start justify-between gap-4 p-5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-mono font-semibold text-cyan-400">
                        {m.mission_code}
                      </span>
                      <span className="text-slate-500" aria-hidden="true">·</span>
                      <span className="text-slate-300">{m.program}</span>
                      <span className="text-slate-500" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-slate-400">
                        {new Date(m.launch_date).toISOString().slice(0, 10)}
                      </span>
                    </div>

                    <h2 className="mt-1.5 text-base font-semibold text-slate-100 sm:text-lg">
                      {m.title}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>{m.vehicle_name ?? 'Vehicle TBD'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{m.orbit_type}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {m.payloads.length} payload{m.payloads.length === 1 ? '' : 's'} ({totalMass.toFixed(0)} kg)
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <StatusText status={m.status} />
                    {expanded ? (
                      <ChevronUp className="h-4 w-4 text-cyan-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-800 px-5 pb-5 pt-4">
                    <p className="text-sm leading-relaxed text-slate-300">{m.remarks}</p>
                    <div className="mt-3 text-xs text-slate-400">
                      Operator: <span className="text-slate-200">{m.organization_name}</span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      Launch Pad: <span className="text-slate-200">{m.launch_site}</span>
                    </div>

                    <div className="mt-4">
                      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                        <Package className="h-3.5 w-3.5 text-cyan-400" />
                        Payload Manifest
                      </h3>
                      {m.payloads.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-400">
                          No individual payloads published for this flight.
                        </p>
                      ) : (
                        <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                          {m.payloads.map((p) => (
                            <div
                              key={p.id}
                              className="rounded-lg border border-slate-800 bg-[#07090E] p-3.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-medium text-slate-100">
                                  {p.name}
                                </span>
                                <span className="shrink-0 font-mono text-xs text-amber-400 tabular-nums">
                                  {p.mass_kg.toFixed(1)} kg
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-400">{p.purpose}</p>
                              <p className="mt-2 font-mono text-[11px] text-slate-500">
                                Origin: {p.country_of_origin}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
