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
import { ApiError } from './errors';

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
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
      xhr.setRequestHeader('apikey', anonKey);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(storageUploadError(xhr.status, xhr.responseText));
      };
      xhr.onerror = () => reject(uploadNetworkError());
      xhr.ontimeout = () => reject(uploadTimeoutError());
      xhr.send(file);
    });
    return publicUrl;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    throw error instanceof DOMException && error.name === 'TimeoutError' ? uploadTimeoutError() : uploadNetworkError();
  }

  if (!res.ok) {
    throw storageUploadError(res.status, await res.text().catch(() => ''));
  }

  return publicUrl;
}

/*
 * Uploads go straight to Supabase Storage (not through the UGNAY API client), so their failures are turned into
 * the same ApiError type here. The storage service's own response is logged for diagnosis but never shown.
 */
const UPLOAD_TIMEOUT_MS = 5 * 60_000;

export function storageUploadError(status: number, responseText: string): ApiError {
  console.warn(`[UGNAY] Storage upload failed (HTTP ${status}):`, responseText.slice(0, 300));
  let message: string;
  if (status === 413) message = 'This file is too large to upload.';
  else if (status === 401 || status === 403) message = 'The file could not be stored: uploads are not permitted right now. Please contact your administrator.';
  else if (status === 415 || status === 422) message = 'This file type cannot be uploaded. Use JPG, PNG, WebP or MP4.';
  else if (status === 429) message = 'Too many uploads at once. Please wait a moment and try again.';
  else if (status >= 500) message = 'File storage is temporarily unavailable. Please try again in a moment.';
  else message = 'The file could not be uploaded. Please try again.';
  return new ApiError(status, message, null, { code: `STORAGE_UPLOAD_FAILED` });
}

function uploadNetworkError(): ApiError {
  return new ApiError(0, 'Upload failed. Check your connection and try again.', null, { code: 'NETWORK_ERROR', kind: 'network' });
}

function uploadTimeoutError(): ApiError {
  return new ApiError(0, 'The upload took too long and was stopped. Check your connection and try again.', null, {
    code: 'TIMEOUT', kind: 'timeout',
  });
}