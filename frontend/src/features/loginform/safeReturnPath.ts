const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * The in-app path to return to after signing in, taken from router state `{ from }`. Only same-app paths are
 * accepted ("/posts?x=1"): never another origin ("//evil.example", "https://…"), a backslash trick, or an
 * auth page (which would loop). Anything else falls back to the dashboard.
 */
export function safeReturnPath(state: unknown, fallback = '/'): string {
  const from = typeof state === 'object' && state !== null ? (state as { from?: unknown }).from : undefined;
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) {
    return fallback;
  }
  const pathname = from.split(/[?#]/, 1)[0];
  return AUTH_PAGES.includes(pathname) ? fallback : from;
}
