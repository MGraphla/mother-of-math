import { Pause, Play, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  lastUpdated: Date | null;
  refreshing: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onRefresh: () => void;
  intervalMs?: number;
}

const LiveIndicator = ({
  lastUpdated,
  refreshing,
  paused,
  onTogglePause,
  onRefresh,
  intervalMs = 30_000,
}: Props) => {
  const [tick, setTick] = useState(0);

  // Re-render every 10s so the "x seconds ago" text stays fresh
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const ago = (() => {
    if (!lastUpdated) return 'never';
    void tick;
    const s = Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  })();

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300">
        <span className="relative flex h-2 w-2">
          {!paused && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          )}
          <span
            className={[
              'relative inline-flex h-2 w-2 rounded-full',
              paused ? 'bg-slate-500' : 'bg-emerald-400',
            ].join(' ')}
          />
        </span>
        <span className="text-slate-200">
          {paused ? 'Paused' : refreshing ? 'Syncing…' : 'Live'}
        </span>
        <span className="text-slate-500">·</span>
        <span className="text-slate-400">updated {ago}</span>
      </div>

      <button
        type="button"
        onClick={onTogglePause}
        title={paused ? 'Resume live updates' : 'Pause live updates'}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
      >
        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </button>

      <button
        type="button"
        onClick={onRefresh}
        title="Refresh now"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
      >
        <RefreshCw className={['h-3 w-3', refreshing ? 'animate-spin' : ''].join(' ')} />
      </button>

      {!paused && (
        <span className="hidden sm:inline text-[10px] text-slate-500">
          auto · {Math.round(intervalMs / 1000)}s
        </span>
      )}
    </div>
  );
};

export default LiveIndicator;
