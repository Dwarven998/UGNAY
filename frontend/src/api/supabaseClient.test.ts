import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getErrorMessage } from './errors';

/** Loads the module with a fake storage configuration; fetch is mocked, so nothing is ever uploaded. */
async function loadClient() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://storage.example.test');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  return import('./supabaseClient');
}

const file = () => new File(['x'], 'photo.png', { type: 'image/png' });

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('uploadToSupabase failures', () => {
  it('turns a storage error into a friendly ApiError without the provider response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      '{"statusCode":"413","error":"Payload too large","message":"The object exceeded the maximum allowed size"}',
      { status: 413 },
    )));
    const { uploadToSupabase } = await loadClient();

    const error = await uploadToSupabase(file(), 'folder/photo.png').catch(e => e);

    // A fresh module copy per test (resetModules), so compare by name rather than class identity.
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(413);
    expect(error.message).toBe('This file is too large to upload.');
    expect(error.message).not.toContain('statusCode');
    // Screens that use getErrorMessage show the same friendly text.
    expect(getErrorMessage(Object.assign(new Error(error.message), { name: 'ApiError' }), 'x')).toBe('x');
  });

  it('reports a dropped connection as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const { uploadToSupabase } = await loadClient();

    const error = await uploadToSupabase(file(), 'folder/photo.png').catch(e => e);

    expect(error).toMatchObject({ kind: 'network', code: 'NETWORK_ERROR' });
    expect(error.message).toMatch(/check your connection/i);
  });

  it('still returns the public URL on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    const { uploadToSupabase } = await loadClient();

    await expect(uploadToSupabase(file(), 'folder/photo.png'))
      .resolves.toBe('https://storage.example.test/storage/v1/object/public/media/folder/photo.png');
  });

  it.each([
    [401, /not permitted/], [403, /not permitted/], [415, /file type/], [429, /too many uploads/i],
    [500, /temporarily unavailable/], [503, /temporarily unavailable/], [400, /could not be uploaded/],
  ])('HTTP %i gets a friendly message', async (status, expected) => {
    const { storageUploadError } = await loadClient();
    expect(storageUploadError(status, '{"raw":"provider detail"}').message).toMatch(expected);
  });
});
