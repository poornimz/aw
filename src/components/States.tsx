import { AlertTriangle, RefreshCw, Satellite } from 'lucide-react';

export function ShimmerCards({ count = 4, height = 'h-28' }: { count?: number; height?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading mission telemetry">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`${height} w-full rounded-xl border border-slate-800 bg-[#0F141F] animate-pulse`}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  onReset,
}: {
  title: string;
  subtitle: string;
  onReset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-800 bg-[#0F141F] p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-800 bg-[#07090E] text-cyan-400">
        <Satellite className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
      >
        Reset Filters
      </button>
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
        <div>
          <p className="text-sm font-semibold text-slate-100">Telemetry Sync Interrupted</p>
          <p className="mt-0.5 text-xs text-slate-300">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-500/50 bg-[#07090E] px-4 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-rose-500/20"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}

export function formatRelativeSync(isoDate: string | null): string {
  if (!isoDate) return 'Synced recently';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'Last synced just now';
  if (mins < 60) return `Last synced ${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last synced ${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  return `Last synced ${Math.floor(hrs / 24)}d ago`;
}

export function StatusText({ status }: { status: string }) {
  const upper = status.toUpperCase();
  if (upper === 'UPCOMING' || upper === 'DEVELOPMENT') {
    return <span className="font-mono text-xs font-medium text-amber-400">▲ {upper}</span>;
  }
  if (upper === 'SUCCESS' || upper === 'OPERATIONAL') {
    return <span className="font-mono text-xs font-medium text-emerald-400">● {upper}</span>;
  }
  return <span className="font-mono text-xs font-medium text-rose-400">✖ {upper}</span>;
}
