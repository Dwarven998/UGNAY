import { describe, expect, it } from 'vitest';
import { ApiError, errorFromResponse, getErrorMessage, isAbortError, networkError, parseRetryAfter, timeoutError } from './errors';
import { ERROR_MESSAGES, codeForStatus, messageForCode } from './errorMessages';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('errorFromResponse', () => {
  it('reads the standard backend error body', async () => {
    const error = await errorFromResponse(json(404, {
      status: 'error', code: 'RESOURCE_NOT_FOUND', message: 'Post not found', error: 'Not Found',
      details: [], timestamp: '2026-11-22T10:30:00Z', path: '/api/posts/1', traceId: 'trace-12345678',
    }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(error.message).toBe('Post not found');
    expect(error.traceId).toBe('trace-12345678');
    expect(error.kind).toBe('http');
  });

  it('keeps the scheduling-conflict body intact as data for the conflict banner', async () => {
    const body = {
      postId: '11111111-1111-1111-1111-111111111111', caption: 'Existing post', scheduledAt: '2026-12-01T10:00:00Z',
      status: 'SCHEDULED', mediaUrl: null, code: 'SCHEDULE_CONFLICT',
      message: 'Schedule conflict detected within 30 minutes of an existing scheduled post', traceId: 't-12345678',
    };
    const error = await errorFromResponse(json(409, body));

    expect(error.status).toBe(409);
    expect(error.code).toBe('SCHEDULE_CONFLICT');
    expect(error.data).toEqual(body);
    expect((error.data as { postId: string }).postId).toBe(body.postId);
  });

  it('collects validation details', async () => {
    const error = await errorFromResponse(json(400, {
      code: 'VALIDATION_ERROR', message: 'Enter a new password.',
      details: [{ field: 'newPassword', message: 'Enter a new password.' }],
    }));
    expect(error.details).toEqual([{ field: 'newPassword', message: 'Enter a new password.' }]);
  });

  it('never shows the server text of a 500', async () => {
    const error = await errorFromResponse(json(500, {
      code: 'INTERNAL_SERVER_ERROR', message: 'java.lang.NullPointerException at com.ugnay.PostService:77',
    }));
    expect(error.message).toBe(ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
    expect(error.message).not.toContain('NullPointer');
  });

  it('shows a backend-written 503 message but not a proxy error page', async () => {
    const backend = await errorFromResponse(json(503, {
      code: 'EXTERNAL_SERVICE_UNAVAILABLE', message: 'The AI assistant is busy right now. Please try again in a moment.',
    }));
    expect(backend.message).toBe('The AI assistant is busy right now. Please try again in a moment.');

    const proxy = await errorFromResponse(new Response('<html><body>502 Bad Gateway nginx</body></html>', { status: 502 }));
    expect(proxy.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(proxy.message).toBe(ERROR_MESSAGES.EXTERNAL_SERVICE_ERROR);
    expect(proxy.data).toBeNull();
  });

  it('handles empty and plain-text bodies', async () => {
    const empty = await errorFromResponse(new Response(null, { status: 403 }));
    expect(empty.code).toBe('FORBIDDEN');
    expect(empty.message).toBe(ERROR_MESSAGES.FORBIDDEN);

    const text = await errorFromResponse(new Response('Email already registered', { status: 400 }));
    expect(text.message).toBe(ERROR_MESSAGES.BAD_REQUEST);
  });

  it('reads the correlation id and Retry-After from headers', async () => {
    const error = await errorFromResponse(new Response('', {
      status: 429, headers: { 'X-Request-Id': 'hdr-trace-123', 'Retry-After': '30' },
    }));
    expect(error.traceId).toBe('hdr-trace-123');
    expect(error.retryAfterMs).toBe(30_000);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('status and code mapping', () => {
  it.each([
    [400, 'BAD_REQUEST'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'RESOURCE_NOT_FOUND'],
    [409, 'RESOURCE_CONFLICT'], [422, 'VALIDATION_ERROR'], [429, 'RATE_LIMIT_EXCEEDED'],
    [500, 'INTERNAL_SERVER_ERROR'], [502, 'EXTERNAL_SERVICE_ERROR'], [503, 'SERVICE_UNAVAILABLE'],
    [504, 'EXTERNAL_SERVICE_TIMEOUT'], [599, 'INTERNAL_SERVER_ERROR'], [418, 'BAD_REQUEST'],
  ])('HTTP %i maps to %s', (status, code) => {
    expect(codeForStatus(status)).toBe(code);
  });

  it('unknown codes fall back to the status message', () => {
    expect(messageForCode('SOMETHING_NEW', 404)).toBe(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    expect(messageForCode('SESSION_EXPIRED')).toBe('Your session has expired. Please sign in again.');
  });

  it('every message is non-empty', () => {
    for (const message of Object.values(ERROR_MESSAGES)) expect(message.trim()).not.toBe('');
  });
});

describe('helpers', () => {
  it('parses Retry-After seconds and dates', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6_000);
    expect(parseRetryAfter('soon')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });

  it('builds network and timeout errors with friendly messages', () => {
    expect(networkError()).toMatchObject({ status: 0, kind: 'network', code: 'NETWORK_ERROR' });
    expect(networkError().message).toMatch(/internet connection/i);
    expect(timeoutError()).toMatchObject({ status: 0, kind: 'timeout', code: 'TIMEOUT' });
  });

  it('getErrorMessage never exposes non-API error text', () => {
    expect(getErrorMessage(new TypeError("Cannot read properties of undefined (reading 'id')"), 'Fallback'))
      .toBe('Fallback');
    expect(getErrorMessage(networkError())).toBe(networkError().message);
    expect(getErrorMessage('a string')).toBe('Something went wrong. Please try again.');
  });

  it('recognises cancelled requests', () => {
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true);
    expect(isAbortError(networkError())).toBe(false);
  });
});
