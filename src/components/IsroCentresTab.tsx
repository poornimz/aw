import { useEffect, useMemo, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { IsroCentreItem, ListResponse } from '../types/space';
import { EmptyState, ErrorBanner, ShimmerCards } from './States';

const STATES = [
  'All',
  'Karnataka',
  'Kerala',
  'Andhra Pradesh',
  'Gujarat',
  'Tamil Nadu',
  'Telangana',
] as const;

interface IsroCentresTabProps {
  onSyncedAt: (iso: string, cacheHit?: boolean) => void;
  refreshToken: number;
}

export function IsroCentresTab({ onSyncedAt, refreshToken }: IsroCentresTabProps) {
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [centres, setCentres] = useState<IsroCentreItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const loadCentres = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (stateFilter !== 'All') params.set('state', stateFilter);
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetchApi<ListResponse<IsroCentreItem>>(`/centres${qs}`);
      setCentres(res.items);
      if (res.items.length > 0 && !res.items.some((c) => c.id === selectedId)) {
        setSelectedId(res.items[0].id);
      }
      onSyncedAt(res.last_synced_at, res.cache_hit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ISRO centres.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadCentres();
    }, 150);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFilter, search, refreshToken]);

  const selectedCentre = useMemo(
    () => centres.find((c) => c.id === selectedId) ?? centres[0] ?? null,
    [centres, selectedId],
  );

  // Project lat [6..28] and lon [68..86] onto SVG viewBox 420x360
  const project = (lat: number, lon: number) => {
    const x = 40 + ((lon - 68) / 18) * 340;
    const y = 330 - ((lat - 6) / 22) * 290;
    return { x, y };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
          ISRO Centres &amp; Spaceports
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Interactive geospatial directory of ISRO launch complexes, propulsion test stands, and satellite integration hubs.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0F141F] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search VSSC, SDSC SHAR, city, or specialization..."
            aria-label="Search ISRO centres"
            className="w-full rounded-lg border border-slate-800 bg-[#07090E] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#07090E] p-1">
          {STATES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStateFilter(st)}
              className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                stateFilter === st
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadCentres} />}

      {loading ? (
        <ShimmerCards count={4} height="h-28" />
      ) : centres.length === 0 ? (
        <EmptyState
          title="No ISRO centres matched your filters"
          subtitle="Reset state and search filters to inspect all Indian space research facilities."
          onReset={() => {
            setStateFilter('All');
            setSearch('');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-800 bg-[#0F141F] p-5 lg:col-span-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                Peninsular India Telemetry Grid
              </span>
              <span className="font-mono tabular-nums">{centres.length} facilities</span>
            </div>

            <div className="relative mt-4 overflow-hidden rounded-lg border border-slate-800 bg-[#07090E]">
              {!imgFailed && (
                <img
                  src="/src/assets/images/orbital_earth_horizon_1795412933871.jpg"
                  alt="Orbital Earth view over peninsular India"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
                />
              )}
              <svg
                viewBox="0 0 420 360"
                className="relative z-10 w-full cursor-crosshair"
                role="img"
                aria-label="Coordinate plot of ISRO centres across India"
              >
                {[70, 74, 78, 82].map((lon) => {
                  const { x } = project(15, lon);
                  return (
                    <g key={lon}>
                      <line x1={x} y1={20} x2={x} y2={340} stroke="#1E293B" strokeDasharray="2 4" />
                      <text x={x} y={352} textAnchor="middle" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono, monospace">
                        {lon}°E
                      </text>
                    </g>
                  );
                })}
                {[8, 13, 18, 23].map((lat) => {
                  const { y } = project(lat, 75);
                  return (
                    <g key={lat}>
                      <line x1={25} y1={y} x2={400} y2={y} stroke="#1E293B" strokeDasharray="2 4" />
                      <text x={20} y={y + 3} textAnchor="end" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono, monospace">
                        {lat}°N
                      </text>
                    </g>
                  );
                })}

                {centres.map((c) => {
                  const { x, y } = project(c.latitude, c.longitude);
                  const active = selectedCentre?.id === c.id;
                  return (
                    <g
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={active ? 11 : 6}
                        fill={active ? '#06B6D4' : '#F59E0B'}
                        fillOpacity={active ? 0.25 : 0.15}
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={active ? 5 : 4}
                        fill={active ? '#06B6D4' : '#F59E0B'}
                        stroke="#07090E"
                        strokeWidth={1.5}
                      />
                      <text
                        x={x + 8}
                        y={y + 3}
                        fill={active ? '#F1F5F9' : '#CBD5E1'}
                        fontSize={active ? '11' : '10'}
                        fontWeight={active ? '700' : '500'}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {c.acronym}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {selectedCentre && (
              <div className="mt-4 rounded-lg border border-slate-800 bg-[#07090E] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-cyan-400">
                    {selectedCentre.acronym}
                  </span>
                  <span className="font-mono text-xs text-amber-400 tabular-nums">
                    {selectedCentre.latitude.toFixed(4)}°N, {selectedCentre.longitude.toFixed(4)}°E
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-semibold text-slate-100">
                  {selectedCentre.name}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedCentre.city}, {selectedCentre.state}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  {selectedCentre.primary_role}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 lg:col-span-7">
            {centres.map((c) => {
              const active = selectedCentre?.id === c.id;
              return (
                <article
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`cursor-pointer rounded-xl border p-5 transition-colors ${
                    active
                      ? 'border-cyan-500/60 bg-[#131B2A]'
                      : 'border-slate-800 bg-[#0F141F] hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-cyan-400">
                          {c.acronym}
                        </span>
                        <span className="text-slate-500" aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-slate-300">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {c.city}, {c.state}
                        </span>
                      </div>
                      <h2 className="mt-1 text-base font-semibold text-slate-100">
                        {c.name}
                      </h2>
                    </div>

                    <span className="font-mono text-xs tabular-nums text-amber-400">
                      {c.latitude.toFixed(2)}°N, {c.longitude.toFixed(2)}°E
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                    {c.primary_role}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
