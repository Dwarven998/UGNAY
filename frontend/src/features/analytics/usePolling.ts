import { useEffect, useRef, useState } from 'react';

// Analytics stays live while a page is open: the interval is kept under the 5s freshness target.
export const POLL_INTERVAL_MS = 4_000;

interface PollState<T> { key: string; data: T | null; error: string | null; syncedAt: Date | null }

/**
 * Last good result per key. Reopening a screen shows it immediately (with the sync badge spinning) instead
 * of an empty skeleton. Keys include the organization, so nothing carries over between organizations.
 */
const lastGood = new Map<string, { data: unknown; syncedAt: Date }>();

/**
 * Loads `load()` immediately and then every few seconds while the tab is visible. State is tagged with
 * `key` (organization + view), so data fetched for one organization is never shown under another:
 * switching keys instantly reads as "loading" instead of flashing stale numbers.
 */
export function usePolling<T>(key: string, enabled: boolean, load: () => Promise<T>) {
  const [state, setState] = useState<PollState<T>>({ key: '', data: null, error: null, syncedAt: null });
  const [syncing, setSyncing] = useState(false);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return; // a slow response must never stack overlapping requests
      inFlight = true;
      setSyncing(true);
      try {
        const data = await loadRef.current();
        const syncedAt = new Date();
        lastGood.set(key, { data, syncedAt });
        if (!cancelled) setState({ key, data, error: null, syncedAt });
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Request failed';
          setState(prev => ({ key, data: prev.key === key ? prev.data : null, syncedAt: prev.key === key ? prev.syncedAt : null, error: message }));
        }
      } finally {
        inFlight = false;
        if (!cancelled) setSyncing(false);
      }
    };

    void tick();
    const interval = setInterval(() => { if (!document.hidden) void tick(); }, POLL_INTERVAL_MS);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, enabled]);

  const current = state.key === key;
  const cached = lastGood.get(key);
  return {
    data: current ? state.data : ((cached?.data as T | undefined) ?? null),
    error: current ? state.error : null,
    syncedAt: current ? state.syncedAt : (cached?.syncedAt ?? null),
    syncing,
  };
}
