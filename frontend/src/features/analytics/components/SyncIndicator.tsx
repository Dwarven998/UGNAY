import { useEffect, useState } from 'react';

/** Header badge: pulses green when idle, shows a spinner while a sync is in flight. */
export function SyncBadge({ syncing, syncedAt }: Readonly<{ syncing: boolean; syncedAt: Date | null }>) {
  return (
    <div className="an-sync-meta">
      <span className={`an-pulse-badge${syncing ? ' syncing' : ''}`} role="status">
        {syncing ? <span className="an-spinner sm" aria-hidden="true" /> : <span className="an-pulse-dot" />}
        {syncing ? 'Syncing insights…' : 'Live Sync Active'}
      </span>
      <span className="an-sync-time">
        {syncedAt
          ? `Updated ${syncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
          : 'Connecting to Facebook…'}
      </span>
    </div>
  );
}

const STEPS = [
  'Connecting to your Facebook Page',
  'Fetching views and interactions',
  'Collecting your top content',
  'Putting the numbers together',
];

/** Prominent loading state shown while the very first sync of a screen is still running. */
export function SyncingPanel({ steps = STEPS }: Readonly<{ steps?: string[] }>) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(timer);
  }, []);

  const step = Math.min(steps.length - 1, Math.floor(elapsed / 1.5));
  const slow = elapsed >= 8;

  return (
    <div className="an-syncing" role="status" aria-live="polite">
      <div className="an-spinner lg" aria-hidden="true" />
      <div className="an-syncing-text">
        <strong>Syncing insights from Facebook…</strong>
        <span>{slow ? 'Facebook is taking longer than usual — still working on it.' : `${steps[step]}…`}</span>
        <div className="an-progress" aria-hidden="true"><i /></div>
      </div>
      <span className="an-syncing-time">{elapsed}s</span>
    </div>
  );
}
