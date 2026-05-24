import { createClient } from '@supabase/supabase-js';

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