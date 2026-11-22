import { secureStorage } from '../utils/secureStorage';
import { ApiError, errorFromResponse, isAbortError, networkError, timeoutError } from './errors';
import { sessionEvents } from './sessionEvents';

type ApiResponse<T> = { data: T };

/**
 * Per-request options. Every existing call site works without them.
 * - `signal`: cancel the request (e.g. on unmount); a cancelled request rejects with an AbortError, not an ApiError.
 * - `timeoutMs`: give up after this long and reject with a TIMEOUT ApiError.
 * - `retries`: extra attempts for transient failures. Only GET requests are ever retried; pass 0 to disable
 *   (polling does, since its next tick is the retry).
 */
export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
}

const baseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8080'
).replace(/\/$/, '');

/*
 * Timeouts are generous on purpose: the hosted backend sleeps when idle and its first answer can take up to a
 * minute, and AI caption generation (image download + model call) legitimately takes a while.
 */
export const DEFAULT_TIMEOUT_MS = 60_000;
const SESSION_CHECK_TIMEOUT_MS = 90_000;
const AI_TIMEOUT_MS = 150_000;
/** Caption Studio and the Media Repository's AI actions (matched on the path, without the query string). */
const isAiPath = (pathname: string) =>
  pathname.startsWith('/api/caption/') || pathname.endsWith('/generate-caption') || pathname.endsWith('/recommend');

const DEFAULT_GET_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 600;
const RETRY_MAX_DELAY_MS = 8_000;
/** A Retry-After longer than this is not waited out automatically; the error is shown instead. */
const MAX_HONOURED_RETRY_AFTER_MS = 15_000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/** 401s from these are answers about the credentials being submitted, not a lost session. */
const SESSION_EXEMPT_PATHS = ['/api/auth/login', '/api/auth/me', '/api/auth/google', '/api/auth/logout'];

export function timeoutFor(path: string): number {
  const pathname = path.split('?', 1)[0];
  if (pathname.endsWith('/api/auth/me')) return SESSION_CHECK_TIMEOUT_MS;
  if (isAiPath(pathname)) return AI_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

function abortError(): DOMException {
  return new DOMException('The request was cancelled.', 'AbortError');
}

/** Waits `ms`, or rejects with an AbortError as soon as `signal` aborts. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Exponential back-off with jitter, capped; a server-sent Retry-After wins when it is reasonable. */
export function retryDelayMs(attempt: number, retryAfterMs: number | null, random = Math.random): number {
  if (retryAfterMs !== null) return Math.min(retryAfterMs, MAX_HONOURED_RETRY_AFTER_MS);
  const exponential = RETRY_BASE_DELAY_MS * 2 ** attempt;
  return Math.min(RETRY_MAX_DELAY_MS, exponential + Math.floor(random() * RETRY_BASE_DELAY_MS));
}

function isRetryable(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  if (error.kind === 'network') return true;
  if (RETRYABLE_STATUSES.has(error.status)) return true;
  // 429: only when the server says how long to wait, and that wait is short.
  return error.status === 429 && error.retryAfterMs !== null && error.retryAfterMs <= MAX_HONOURED_RETRY_AFTER_MS;
}

let sessionEndHandled = false;

/** Lets a fresh sign-in report a later expiry again. Called by AuthContext once a session is established. */
export function resetSessionExpiryGuard(): void {
  sessionEndHandled = false;
}

function handleUnauthorized(path: string, error: ApiError): void {
  if (SESSION_EXEMPT_PATHS.some(p => path.endsWith(p))) return;
  secureStorage.purgeSensitiveKeys();
  // Several requests can fail with 401 at once; only the first one ends the session.
  if (sessionEndHandled) return;
  sessionEndHandled = true;
  const reason = error.code === 'SESSION_EXPIRED' ? 'expired' : 'signed-out';
  if (!sessionEvents.emitSessionEnded(reason)) {
    const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
    if (!publicPaths.includes(window.location.pathname)) window.location.assign('/login');
  }
}

/** One attempt: fetch with a timeout linked to the caller's signal. */
async function attempt(url: string, init: RequestInit, timeoutMs: number, callerSignal?: AbortSignal): Promise<Response> {
  if (callerSignal?.aborted) throw abortError();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', forwardAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw timeoutError();
    if (callerSignal?.aborted || isAbortError(error)) throw abortError();
    throw networkError();
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', forwardAbort);
  }
}

async function readBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return null as T;
  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, 'The server sent an unexpected response. Please try again.', null, {
      code: 'UNEXPECTED_RESPONSE',
      traceId: res.headers.get('X-Request-Id'),
    });
  }
}

async function request<T>(path: string, init: RequestInit, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
  if (!(init.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  // Authentication is carried only by the HttpOnly session cookie. A token is never read from browser
  // storage: one planted there (by injected script or by hand) could otherwise sign requests in as
  // another account.
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  const method = (init.method || 'GET').toUpperCase();
  // Only reads are retried: repeating a POST/PUT/PATCH/DELETE could create a post twice or schedule twice.
  const maxRetries = method === 'GET' ? Math.max(0, options.retries ?? DEFAULT_GET_RETRIES) : 0;
  const timeoutMs = options.timeoutMs ?? timeoutFor(formattedPath);

  for (let attemptNo = 0; ; attemptNo++) {
    try {
      const res = await attempt(
        `${baseUrl}${formattedPath}`,
        { ...init, method, headers, credentials: 'include' }, // HttpOnly session cookie
        timeoutMs,
        options.signal,
      );
      if (!res.ok) {
        const error = await errorFromResponse(res);
        if (res.status === 401) handleUnauthorized(formattedPath, error);
        throw error;
      }
      const data = await readBody<T>(res);
      return { data };
    } catch (error) {
      if (attemptNo >= maxRetries || !isRetryable(error) || options.signal?.aborted) throw error;
      await delay(retryDelayMs(attemptNo, error.retryAfterMs), options.signal);
    }
  }
}

const axiosClient = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'GET' }, options),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, options),
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, options),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, options),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'DELETE' }, options),
};

export type { ApiResponse };
export { ApiError };
export default axiosClient;
