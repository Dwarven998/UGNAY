import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile site key.
 * Must be set in frontend/.env as VITE_TURNSTILE_SITE_KEY.
 * The value is not hardcoded here — configure it in your .env file.
 */
const TURNSTILE_SITE_KEY: string = (() => {
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!key) throw new Error('[Turnstile] VITE_TURNSTILE_SITE_KEY is not set in frontend/.env');
  return key;
})();

// Extend Window to include the Cloudflare Turnstile API
declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
}

interface UseTurnstileResult {
  /** The current Turnstile token. Empty string means no valid token yet. */
  token: string;
  /** Whether the widget is ready and a valid token has been obtained. */
  isVerified: boolean;
  /** Reset the widget and clear the token (call after failed auth). */
  reset: () => void;
  /** Ref to attach to the container div where the widget will be rendered. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * React hook that manages a Cloudflare Turnstile widget lifecycle.
 *
 * - Renders the widget when the script is ready.
 * - Stores the token until it is consumed by a form submission.
 * - Clears the token when it expires or an error occurs.
 * - Exposes a reset() function so the parent can request a new token
 *   after a failed server-side verification.
 *
 * Tokens are single-use: pass them once to the backend, then reset.
 */
export function useTurnstile(): UseTurnstileResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState('');
  const isVerified = token.length > 0;

  const reset = useCallback(() => {
    setToken('');
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    let rendered = false;

    const tryRender = () => {
      if (rendered) return;
      if (!containerRef.current || !window.turnstile) return;

      rendered = true;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
        theme: 'light',
      });
    };

    // Try immediately in case the script is already loaded
    tryRender();

    // If not ready yet, poll for up to 5 seconds (script loads asynchronously via defer)
    let attempts = 0;
    const MAX_ATTEMPTS = 50;
    const interval = setInterval(() => {
      attempts++;
      tryRender();
      if (rendered || attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      // Remove the widget when the component unmounts to avoid leaks
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore — widget may already be gone
        }
        widgetIdRef.current = null;
      }
      setToken('');
    };
  }, []);

  return { token, isVerified, reset, containerRef };
}
