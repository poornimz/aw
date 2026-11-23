import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { LaunchVehicleItem, ListResponse, StartupOrganization } from '../types/space';
import { EmptyState, ErrorBanner, ShimmerCards, StatusText } from './States';

const FOCUS_TAGS = ['All', 'Launch', 'Satellites & EO', 'Propulsion', 'SSA/Debris'] as const;

interface RocketsStartupsTabProps {
  onSyncedAt: (iso: string, cacheHit?: boolean) => void;
  refreshToken: number;
}

export function RocketsStartupsTab({ onSyncedAt, refreshToken }: RocketsStartupsTabProps) {
  const [focus, setFocus] = useState<string>('All');
  const [vehicles, setVehicles] = useState<LaunchVehicleItem[]>([]);
  const [startups, setStartups] = useState<StartupOrganization[]>([]);
  const [hoveredVehicleId, setHoveredVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const focusQuery = focus === 'All' ? '' : `?focus=${encodeURIComponent(focus)}`;
      const [vehRes, stRes] = await Promise.all([
        fetchApi<ListResponse<LaunchVehicleItem>>('/vehicles'),
        fetchApi<ListResponse<StartupOrganization>>(`/startups${focusQuery}`),
      ]);
      setVehicles(vehRes.items);
      setStartups(stRes.items);
      onSyncedAt(stRes.last_synced_at, stRes.cache_hit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch vehicles and startups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, refreshToken]);

  const chartVehicles = vehicles.slice(0, 7);
  const maxLeo = Math.max(10000, ...chartVehicles.map((v) => v.leo_payload_kg));
  const hoveredVehicle = chartVehicles.find((v) => v.id === hoveredVehicleId) ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
          Rockets &amp; Startups
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Orbital lift capacity comparisons (LEO vs GTO) alongside IN-SPACe authorized Indian NewSpace companies.
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadData} />}

      {loading ? (
        <ShimmerCards count={4} height="h-36" />
      ) : (
        <>
          <section className="rounded-xl border border-slate-800 bg-[#0F141F] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Launch Vehicle Payload Capacity (LEO vs GTO)
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Hover or focus any vehicle bar group to inspect exact payload mass in kilograms.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" />
                  LEO Payload (kg)
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                  GTO Payload (kg)
                </span>
              </div>
            </div>

            {hoveredVehicle && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#07090E] px-4 py-2.5 font-mono text-xs tabular-nums">
                <span className="font-semibold text-slate-100">{hoveredVehicle.name}</span>
                <span className="text-cyan-400">
                  LEO: {hoveredVehicle.leo_payload_kg.toLocaleString()} kg
                </span>
                <span className="text-amber-400">
                  GTO: {hoveredVehicle.gto_payload_kg.toLocaleString()} kg
                </span>
                <span className="text-slate-400">{hoveredVehicle.stages} stages</span>
              </div>
            )}

            <div className="mt-5 overflow-x-auto">
              <svg
                viewBox="0 0 760 250"
                className="h-60 w-full min-w-[540px]"
                role="img"
                aria-label="Grouped bar chart comparing LEO and GTO payload capacity across Indian launch vehicles"
              >
                {[0, 2500, 5000, 7500, 10000].map((tick) => {
                  const y = 200 - (tick / maxLeo) * 170;
                  return (
                    <g key={tick}>
                      <line
                        x1={56}
                        y1={y}
                        x2={740}
                        y2={y}
                        stroke="#1E293B"
                        strokeDasharray={tick === 0 ? undefined : '3 3'}
                      />
                      <text
                        x={48}
                        y={y + 4}
                        textAnchor="end"
                        fill="#94A3B8"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {tick === 0 ? '0' : `${(tick / 1000).toFixed(1)}t`}
                      </text>
                    </g>
                  );
                })}

                {chartVehicles.map((v, idx) => {
                  const slotWidth = 670 / Math.max(1, chartVehicles.length);
                  const xBase = 72 + idx * slotWidth;
                  const leoH = (v.leo_payload_kg / maxLeo) * 170;
                  const gtoH = (v.gto_payload_kg / maxLeo) * 170;
                  const isHovered = hoveredVehicleId === v.id;
                  const shortLabel = v.name.split(' ')[0];

                  return (
                    <g
                      key={v.id}
                      onMouseEnter={() => setHoveredVehicleId(v.id)}
                      onMouseLeave={() => setHoveredVehicleId(null)}
                      className="cursor-crosshair"
                    >
                      {isHovered && (
                        <rect
                          x={xBase - 6}
                          y={20}
                          width={58}
                          height={186}
                          rx={4}
                          fill="#1E293B"
                          opacity={0.45}
                        />
                      )}
                      <rect
                        x={xBase}
                        y={200 - leoH}
                        width={20}
                        height={Math.max(2, leoH)}
                        rx={3}
                        fill="#06B6D4"
                      />
                      <rect
                        x={xBase + 24}
                        y={200 - gtoH}
                        width={20}
                        height={v.gto_payload_kg > 0 ? Math.max(2, gtoH) : 0}
                        rx={3}
                        fill="#F59E0B"
                      />
                      <text
                        x={xBase + 22}
                        y={222}
                        textAnchor="middle"
                        fill={isHovered ? '#F1F5F9' : '#94A3B8'}
                        fontSize="11"
                        fontFamily="IBM Plex Sans, sans-serif"
                      >
                        {shortLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-6 overflow-x-auto border-t border-slate-800 pt-4">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2.5 font-medium">Vehicle</th>
                    <th className="pb-2.5 font-medium">Operator</th>
                    <th className="pb-2.5 font-medium text-right">Stages</th>
                    <th className="pb-2.5 font-medium text-right">LEO (kg)</th>
                    <th className="pb-2.5 font-medium text-right">GTO (kg)</th>
                    <th className="pb-2.5 font-medium pl-4">Propulsion</th>
                    <th className="pb-2.5 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-[#07090E]/60">
                      <td className="py-2.5 font-semibold text-slate-100">{v.name}</td>
                      <td className="py-2.5 text-slate-300">{v.organization_name}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-300">
                        {v.stages}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-cyan-400">
                        {v.leo_payload_kg.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-amber-400">
                        {v.gto_payload_kg > 0 ? v.gto_payload_kg.toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 pl-4 text-slate-400">{v.propulsion_type}</td>
                      <td className="py-2.5 text-right">
                        <StatusText status={v.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                Indian NewSpace Startup Directory ({startups.length})
              </h2>

              <div
                role="tablist"
                aria-label="Filter startups by domain focus"
                className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#0F141F] p-1"
              >
                {FOCUS_TAGS.map((tag) => {
                  const active = focus === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFocus(tag)}
                      className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-cyan-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {startups.length === 0 ? (
              <EmptyState
                title={`No startups match "${focus}"`}
                subtitle="Reset domain focus filters to inspect all Indian private aerospace startups."
                onReset={() => setFocus('All')}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {startups.map((s) => (
                  <article
                    key={s.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0F141F] p-5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-bold text-slate-100">{s.name}</h3>
                        {s.in_space_authorized && (
                          <span className="shrink-0 font-mono text-[11px] font-medium text-emerald-400">
                            ● IN-SPACe Authorized
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-cyan-400">
                        <span>{s.focus_area}</span>
                        <span className="text-slate-500" aria-hidden="true">·</span>
                        <span className="text-slate-400">{s.hq_city}</span>
                        <span className="text-slate-500" aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-slate-400">
                          Est. {s.founded_year}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">
                        {s.description}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-slate-800/80 pt-3">
                      <a
                        href={s.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300"
                      >
                        Visit Official Website
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
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
