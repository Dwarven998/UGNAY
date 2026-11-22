import {
  NETWORK_ERROR,
  TIMEOUT_ERROR,
  UNEXPECTED_RESPONSE,
  codeForStatus,
  messageForCode,
} from './errorMessages';

export type ApiErrorKind = 'http' | 'network' | 'timeout';

export interface ApiFieldError {
  field: string;
  message: string;
}

interface ApiErrorInit {
  code?: string;
  kind?: ApiErrorKind;
  traceId?: string | null;
  details?: ApiFieldError[];
  retryAfterMs?: number | null;
}

/**
 * Every failed API call rejects with an ApiError. `message` is always safe to show to the user.
 *
 * - `status`: HTTP status, or 0 when no response arrived (network failure or timeout).
 * - `data`: the parsed response body as sent by the server. For a scheduling conflict (409) this is the
 *   conflicting post (`postId`, `caption`, `scheduledAt`, …), exactly as before.
 * - `code`: the backend's error code (e.g. `SESSION_EXPIRED`), or one derived from the status.
 * - `traceId`: correlation id to quote when reporting a problem.
 */
export class ApiError extends Error {
  status: number;
  data: unknown;
  code: string;
  kind: ApiErrorKind;
  traceId: string | null;
  details: ApiFieldError[];
  retryAfterMs: number | null;

  constructor(status: number, message: string, data: unknown, init: ApiErrorInit = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = init.code ?? (status ? codeForStatus(status) : UNEXPECTED_RESPONSE);
    this.kind = init.kind ?? 'http';
    this.traceId = init.traceId ?? null;
    this.details = init.details ?? [];
    this.retryAfterMs = init.retryAfterMs ?? null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** A request cancelled on purpose (component unmounted, newer request replaced it): not an error to report. */
export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

/** Retry-After as milliseconds: either delay-seconds or an HTTP date. Null when absent or unparseable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDetails(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map(item => ({ field: String(item.field ?? ''), message: String(item.message ?? '') }));
}

/**
 * Turns an unsuccessful response into an ApiError. Accepts the standard error body
 * (`{status:"error", code, message, details, traceId, …}`), the scheduling-conflict body (post fields plus
 * `code`/`message`), older `{error, message}` bodies, plain text and HTML error pages.
 *
 * Message rules: a 4xx message from the server is shown (the backend writes those for users); a 502/503/504
 * message is shown only when it comes in the backend's own format (a proxy's page is not); a 500 never shows
 * the server's text, only the generic message.
 */
export async function errorFromResponse(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => '');
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null; // HTML/plain-text error page: never shown to the user
    }
  }

  const status = response.status;
  const body = isRecord(data) ? data : {};
  const code = typeof body.code === 'string' && body.code ? body.code : codeForStatus(status);
  const serverMessage = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null;
  const fromBackend = typeof body.code === 'string';

  let message: string;
  if (status === 500 || !serverMessage) {
    message = messageForCode(code, status);
  } else if (status > 500) {
    message = fromBackend ? serverMessage : messageForCode(code, status);
  } else {
    message = serverMessage;
  }

  return new ApiError(status, message, data, {
    code,
    kind: 'http',
    traceId: (typeof body.traceId === 'string' ? body.traceId : null) ?? response.headers.get('X-Request-Id'),
    details: readDetails(body.details),
    retryAfterMs: parseRetryAfter(response.headers.get('Retry-After')),
  });
}

export function networkError(): ApiError {
  return new ApiError(0, messageForCode(NETWORK_ERROR), null, { code: NETWORK_ERROR, kind: 'network' });
}

export function timeoutError(): ApiError {
  return new ApiError(0, messageForCode(TIMEOUT_ERROR), null, { code: TIMEOUT_ERROR, kind: 'timeout' });
}

/**
 * The message to show for any caught error. API errors carry a safe message already; anything else
 * (a programming error, a library exception) gets the fallback so internal details never reach the screen.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(error)) return error.message || fallback;
  return fallback;
}
