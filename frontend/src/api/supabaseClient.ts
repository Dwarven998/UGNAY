// Supabase Storage upload helper
// Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars.
// Falls back to a local Object URL when credentials are not configured.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'media';

/**
 * Upload a file to Supabase Storage and return its public URL.
 * If Supabase credentials are not configured, returns a local Object URL
 * so that the rest of the app can continue working during local development.
 */
export async function uploadToSupabase(file: File, path: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      '[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set – using local Object URL as fallback.',
    );
    return URL.createObjectURL(file);
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upload failed (${res.status}): ${text}`);
  }

  // Return the public URL
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
