const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'media';

export async function uploadToSupabase(file: File, path: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      '[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set – using local Object URL as fallback.',
    );
    return URL.createObjectURL(file);
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

  const res = await fetch(url, {
    method: 'PUT', 
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY, 
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upload failed (${res.status}): ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}