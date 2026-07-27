import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshMonitorScope } from '../services/monitorData';

type LiveTrigger = 'initial' | 'manual' | 'interval' | 'visibility';

/**
 * Minimum time between full monitor-scope rebuilds for timer-based refresh.
 * Scope rebuild = 14 parallel admin fetches + Nigeria filter — keep this generous.
 */
const POLL_SCOPE_REFRESH_MS = 120_000;

/**
 * Minimum time between full scope rebuilds when the tab regains focus.
 * Focus/visibility fires often; without this, every alt-tab refetches everything.
 */
const VISIBILITY_SCOPE_REFRESH_MS = 300_000;

/**
 * useLiveData — drives auto-refreshing dashboard data.
 *
 * - Polls `loader` every `intervalMs` (default 30s)
 * - Re-runs when the tab regains focus / becomes visible (throttled)
 * - Exposes manual `refresh()` and a `paused` toggle
 *
 * **Performance:** The monitor `loader` typically reads a shared Nigeria scope.
 * We only call `refreshMonitorScope()` when the user taps "Refresh now", or when
 * a throttled background refresh runs — never on every page mount, so navigating
 * between monitor routes reuses the warm cache instead of reloading everything.
 */
export const useLiveData = <T>(
  loader: () => Promise<T>,
  opts: { intervalMs?: number; immediate?: boolean } = {},
) => {
  const { intervalMs = 30_000, immediate = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [refreshing, setRefreshing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  /** Clock of last *started* interval refresh (used to throttle poll-triggered scope invalidation). */
  const lastIntervalRefreshStartedAt = useRef(0);
  /** Clock of last *started* visibility refresh. */
  const lastVisibilityRefreshStartedAt = useRef(0);
  /** Avoid interval/focus refresh racing the first in-flight scope build. */
  const initialPassDoneRef = useRef(false);

  const run = useCallback(async (mode: 'initial' | 'refresh', trigger: LiveTrigger) => {
    const now = Date.now();

    if (mode === 'refresh' && (trigger === 'interval' || trigger === 'visibility')) {
      if (!initialPassDoneRef.current) return;
    }

    if (mode === 'refresh' && trigger === 'interval') {
      const last = lastIntervalRefreshStartedAt.current;
      if (last && now - last < POLL_SCOPE_REFRESH_MS) return;
      lastIntervalRefreshStartedAt.current = now;
    }

    if (mode === 'refresh' && trigger === 'visibility') {
      const last = lastVisibilityRefreshStartedAt.current;
      if (last && now - last < VISIBILITY_SCOPE_REFRESH_MS) return;
      lastVisibilityRefreshStartedAt.current = now;
    }

    if (mode === 'refresh') setRefreshing(true);

    try {
      if (trigger === 'manual' && initialPassDoneRef.current) {
        refreshMonitorScope();
      } else if (mode === 'refresh' && (trigger === 'interval' || trigger === 'visibility')) {
        refreshMonitorScope();
      }
      // `initial`: keep shared monitor scope warm — do not invalidate on every route mount.

      const result = await loaderRef.current();
      setData(result);
      setLastUpdated(new Date());
      setError(null);

      if (trigger === 'initial' || trigger === 'manual') {
        const t = Date.now();
        lastIntervalRefreshStartedAt.current = t;
        lastVisibilityRefreshStartedAt.current = t;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mode === 'initial') {
        initialPassDoneRef.current = true;
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (immediate) void run('initial', 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run('refresh', 'interval');
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [paused, intervalMs, run]);

  // Refresh on tab focus / visibility change (throttled inside `run`)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && !paused) void run('refresh', 'visibility');
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [paused, run]);

  const refresh = useCallback(() => {
    void run('refresh', 'manual');
  }, [run]);

  return {
    data,
    loading,
    refreshing,
    paused,
    setPaused,
    lastUpdated,
    error,
    refresh,
  };
};
