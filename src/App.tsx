import { useEffect, useState } from 'react';
import { BarChart3, Globe, MapPin, RefreshCw, Rocket } from 'lucide-react';
import { IsroCentresTab } from './components/IsroCentresTab';
import { LaunchControlTab } from './components/LaunchControlTab';
import { MissionsPayloadsTab } from './components/MissionsPayloadsTab';
import { RocketsStartupsTab } from './components/RocketsStartupsTab';
import { formatRelativeSync } from './components/States';
import { fetchApi } from './lib/api';
import { SyncJobResponse } from './types/space';

type TabKey = 'launch' | 'missions' | 'startups' | 'centres';

const TABS: Array<{ key: TabKey; label: string; shortLabel: string; icon: typeof Rocket }> = [
  { key: 'launch', label: 'Launch Control', shortLabel: 'Launch', icon: Rocket },
  { key: 'missions', label: 'Missions & Payloads', shortLabel: 'Missions', icon: Globe },
  { key: 'startups', label: 'Rockets & Startups', shortLabel: 'Startups', icon: BarChart3 },
  { key: 'centres', label: 'ISRO Centres', shortLabel: 'Centres', icon: MapPin },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('launch');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<number>(0);
  const [, setClockTick] = useState<number>(0);

  // Refresh "Last synced X mins ago" label every 30s
  useEffect(() => {
    const id = setInterval(() => setClockTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const handleSyncedAt = (iso: string, hit = false) => {
    setLastSyncedAt(iso);
    setCacheHit(hit);
  };

  const triggerSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncNotice('Queuing ingestion job...');
    try {
      const queued = await fetchApi<SyncJobResponse>('/admin/sync', { method: 'POST' });
      const jobId = queued.job_id;
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((r) => setTimeout(r, 400));
        const status = await fetchApi<SyncJobResponse>(`/admin/sync/${jobId}`);
        if (status.status === 'COMPLETED') {
          setSyncNotice(
            `Sync completed (${status.records_upserted ?? 0} upstream records merged)`,
          );
          setRefreshToken((n) => n + 1);
          break;
        }
        if (status.status === 'FAILED') {
          setSyncNotice(status.error_message ?? 'Sync finished with fallback data.');
          break;
        }
      }
    } catch (err) {
      setSyncNotice(err instanceof Error ? err.message : 'Unable to trigger sync.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 pb-20 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0F141F]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-6 py-3.5">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('launch');
            }}
            className="whitespace-nowrap shrink-0 text-lg font-bold tracking-tight text-slate-100"
          >
            Antariksh Watch
          </a>

          <nav
            aria-label="Primary sections"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap shrink-0 border-b-2 py-1 transition-colors ${
                    active
                      ? 'border-cyan-400 text-slate-100 font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={triggerSync}
            disabled={syncing}
            className="inline-flex whitespace-nowrap shrink-0 items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Feeds'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-6 pt-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
            <span className="text-cyan-400">{formatRelativeSync(lastSyncedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{cacheHit ? 'Served from TTL cache' : 'Direct live query'}</span>
            {syncNotice && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300">{syncNotice}</span>
              </>
            )}
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            ISRO · NSIL · IN-SPACe NewSpace Tracker
          </span>
        </div>

        {activeTab === 'launch' && (
          <LaunchControlTab onSyncedAt={handleSyncedAt} refreshToken={refreshToken} />
        )}
        {activeTab === 'missions' && (
          <MissionsPayloadsTab onSyncedAt={handleSyncedAt} refreshToken={refreshToken} />
        )}
        {activeTab === 'startups' && (
          <RocketsStartupsTab onSyncedAt={handleSyncedAt} refreshToken={refreshToken} />
        )}
        {activeTab === 'centres' && (
          <IsroCentresTab onSyncedAt={handleSyncedAt} refreshToken={refreshToken} />
        )}
      </main>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-800 bg-[#0F141F] md:hidden"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
