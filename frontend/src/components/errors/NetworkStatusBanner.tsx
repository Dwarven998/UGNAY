import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import './errors.css';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const isOnline = () => navigator.onLine;

/**
 * App-wide notice while the browser is offline, and a brief "back online" note afterwards. Requests made
 * while offline still fail with their own inline messages; this explains why.
 */
export function NetworkStatusBanner() {
  const online = useSyncExternalStore(subscribe, isOnline, () => true);
  const [showRecovered, setShowRecovered] = useState(false);
  const wasOffline = useRef(!online);

  useEffect(() => {
    const onOnline = () => {
      if (!wasOffline.current) return;
      wasOffline.current = false;
      setShowRecovered(true);
      window.setTimeout(() => setShowRecovered(false), 3000);
    };
    const onOffline = () => {
      wasOffline.current = true;
      setShowRecovered(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!online) {
    return (
      <div className="ug-status-banner" role="status" aria-live="polite">
        You're offline. Changes can't be saved until your connection is back.
      </div>
    );
  }
  if (showRecovered) {
    return (
      <div className="ug-status-banner ug-status-banner--success" role="status" aria-live="polite">
        You're back online.
      </div>
    );
  }
  return null;
}
