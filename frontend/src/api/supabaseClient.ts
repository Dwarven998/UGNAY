/*import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Upload a file to Supabase Storage → returns public URL
export async function uploadToSupabase(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('ugnay-media')
    .upload(path, file, { upsert: true });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from('ugnay-media')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
*/

//new
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'media';

/** `onProgress` receives 0–1 as the bytes go up (uses XHR, since fetch can't report upload progress). */
export async function uploadToSupabase(file: File, path: string, onProgress?: (fraction: number) => void): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      '[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set – using local Object URL as fallback.',
    );
    onProgress?.(1);
    return URL.createObjectURL(file);
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

  if (onProgress) {
    const anonKey = SUPABASE_ANON_KEY;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
      xhr.setRequestHeader('apikey', anonKey);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Supabase upload failed (${xhr.status}): ${xhr.responseText}`));
      };
      xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
      xhr.send(file);
    });
    return publicUrl;
  }

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

  return publicUrl;
}