import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient, { ApiError, DEFAULT_TIMEOUT_MS, resetSessionExpiryGuard, retryDelayMs, timeoutFor } from './axiosClient';
import { sessionEvents } from './sessionEvents';
import type { SessionEndReason } from './sessionEvents';

const fetchMock = vi.fn<typeof fetch>();

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const standard = (status: number, code: string, message: string) =>
  json(status, { status: 'error', code, message, details: [], traceId: 'trace-12345678' });

/** A fetch that never answers on its own, only rejects when its signal aborts (like a hung server). */
function hangingFetch(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
}

let sessionEnds: SessionEndReason[] = [];
let unsubscribe: () => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  resetSessionExpiryGuard();
  sessionEnds = [];
  unsubscribe = sessionEvents.onSessionEnded(reason => sessionEnds.push(reason));
});

afterEach(() => {
  unsubscribe();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Lets the request run to completion while fake timers drive retries and timeouts. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const result = promise.then(value => ({ value }), error => ({ error }));
  await vi.runAllTimersAsync();
  const outcome = await result;
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
}

describe('successful responses', () => {
  it('returns parsed JSON, null for 204, and sends the session cookie', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await expect(settle(axiosClient.get('/api/x'))).resolves.toEqual({ data: { ok: true } });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include' });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(settle(axiosClient.delete('/api/x/1'))).resolves.toEqual({ data: null });
  });

  it('rejects an unreadable success body with a friendly error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>maintenance</html>', { status: 200 }));
    await expect(settle(axiosClient.get('/api/x'))).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });
});

describe('authentication errors', () => {
  it('ends the session once for 401 SESSION_EXPIRED, even when several requests fail together', async () => {
    fetchMock.mockImplementation(async () => standard(401, 'SESSION_EXPIRED', 'Your session has expired.'));

    const results = await Promise.allSettled([
      settle(axiosClient.get('/api/posts')),
      settle(axiosClient.get('/api/media/folders')),
      settle(axiosClient.post('/api/posts', {})),
    ]);

    expect(results.every(r => r.status === 'rejected')).toBe(true);
    expect(sessionEnds).toEqual(['expired']);
  });

  it('does not treat 401 from the sign-in and session-check endpoints as a lost session', async () => {
    fetchMock.mockImplementation(async () => standard(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'));
    await expect(settle(axiosClient.post('/api/auth/login', {}))).rejects.toMatchObject({ status: 401 });
    await expect(settle(axiosClient.get('/api/auth/me'))).rejects.toMatchObject({ status: 401 });
    await expect(settle(axiosClient.post('/api/auth/google', {}))).rejects.toMatchObject({ status: 401 });
    expect(sessionEnds).toEqual([]);
  });

  it('keeps the session on 403 and surfaces the permission message', async () => {
    fetchMock.mockResolvedValueOnce(standard(403, 'FORBIDDEN', 'Requires officer or admin role'));
    await expect(settle(axiosClient.get('/api/posts/moderation?orgId=1')))
      .rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Requires officer or admin role' });
    expect(sessionEnds).toEqual([]);
  });

  it('reports a later expiry again after a new sign-in', async () => {
    fetchMock.mockImplementation(async () => standard(401, 'UNAUTHORIZED', 'Please sign in to continue.'));
    await settle(axiosClient.get('/api/posts')).catch(() => undefined);
    resetSessionExpiryGuard();
    await settle(axiosClient.get('/api/posts')).catch(() => undefined);
    expect(sessionEnds).toEqual(['signed-out', 'signed-out']);
  });
});

describe('retries', () => {
  it('retries a GET after a network failure and succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(json(200, [1, 2]));
    await expect(settle(axiosClient.get('/api/posts'))).resolves.toEqual({ data: [1, 2] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up on a GET after two retries of 503', async () => {
    fetchMock.mockImplementation(async () => standard(503, 'SERVICE_UNAVAILABLE', 'Temporarily unavailable.'));
    await expect(settle(axiosClient.get('/api/posts'))).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)('never retries %s (no duplicate posts or schedules)', async method => {
    fetchMock.mockImplementation(async () => standard(503, 'SERVICE_UNAVAILABLE', 'Temporarily unavailable.'));
    const call = method === 'delete' ? axiosClient.delete('/api/posts/1') : axiosClient[method]('/api/posts', {});
    await expect(settle(call)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry client errors', async () => {
    fetchMock.mockResolvedValueOnce(standard(404, 'RESOURCE_NOT_FOUND', 'Post not found'));
    await expect(settle(axiosClient.get('/api/posts/1'))).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('can be switched off per request (polling)', async () => {
    fetchMock.mockImplementation(async () => standard(503, 'SERVICE_UNAVAILABLE', 'x'));
    await expect(settle(axiosClient.get('/api/analytics/dashboard', { retries: 0 }))).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits the Retry-After the server asks for', async () => {
    fetchMock
      .mockResolvedValueOnce(json(429, { code: 'RATE_LIMIT_EXCEEDED', message: 'Slow down.' }, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(json(200, { ok: true }));

    const pending = axiosClient.get('/api/x');
    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not sit out a long Retry-After; the error is shown instead', async () => {
    fetchMock.mockResolvedValueOnce(json(429, { code: 'RATE_LIMIT_EXCEEDED', message: 'Slow down.' }, { 'Retry-After': '120' }));
    await expect(settle(axiosClient.get('/api/x'))).rejects.toMatchObject({ status: 429, retryAfterMs: 120_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses capped exponential back-off', () => {
    const noJitter = () => 0;
    expect(retryDelayMs(0, null, noJitter)).toBe(600);
    expect(retryDelayMs(1, null, noJitter)).toBe(1_200);
    expect(retryDelayMs(10, null, noJitter)).toBe(8_000);
    expect(retryDelayMs(0, 3_000, noJitter)).toBe(3_000);
    expect(retryDelayMs(0, 600_000, noJitter)).toBe(15_000);
  });
});

describe('timeouts and cancellation', () => {
  it('gives the session check and AI calls longer than ordinary requests', () => {
    expect(timeoutFor('/api/auth/me')).toBe(90_000);
    expect(timeoutFor('/api/caption/generate')).toBe(150_000);
    expect(timeoutFor('/api/media/assets/generate-caption')).toBe(150_000);
    expect(timeoutFor('/api/media/folders/abc/recommend')).toBe(150_000);
    expect(timeoutFor('/api/analytics/recommendation?orgId=1')).toBe(DEFAULT_TIMEOUT_MS);
    expect(timeoutFor('/api/posts')).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('times out a hung request without retrying it', async () => {
    fetchMock.mockImplementation(hangingFetch);
    await expect(settle(axiosClient.get('/api/x', { timeoutMs: 1_000 })))
      .rejects.toMatchObject({ kind: 'timeout', code: 'TIMEOUT', status: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a request cancelled by the caller rejects with AbortError, not an ApiError', async () => {
    fetchMock.mockImplementation(hangingFetch);
    const controller = new AbortController();
    const pending = axiosClient.get('/api/x', { signal: controller.signal });
    controller.abort();
    const error = await settle(pending).catch(e => e);
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('cancelling during a retry wait stops further attempts', async () => {
    fetchMock.mockImplementation(async () => standard(503, 'SERVICE_UNAVAILABLE', 'x'));
    const controller = new AbortController();
    const pending = axiosClient.get('/api/x', { signal: controller.signal }).catch(e => e);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    controller.abort();
    await vi.runAllTimersAsync();
    expect(((await pending) as Error).name).toBe('AbortError');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('an already-cancelled signal never sends the request', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await settle(axiosClient.get('/api/x', { signal: controller.signal })).catch(e => e);
    expect((error as Error).name).toBe('AbortError');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a network failure gets a friendly message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(settle(axiosClient.post('/api/posts', {})))
      .rejects.toMatchObject({ kind: 'network', code: 'NETWORK_ERROR', message: expect.stringMatching(/connect/i) });
  });
});
