/*
 * The AI assistant needs the image itself. Sending only its storage URL makes the server download it again,
 * and that download is what intermittently failed ("Connection reset"). The browser has usually loaded the
 * image already, so it sends a downscaled copy instead — smaller and faster for the model too. Anything that
 * goes wrong here falls back to the plain URL, which the server still accepts.
 */

// 1536px allows Gemini to read small text, dates, venues, and announcements on pubmats clearly.
const MAX_EDGE = 1536;
const JPEG_QUALITY = 0.90;
const FETCH_TIMEOUT_MS = 8000;

export async function toCaptionImage(url: string): Promise<string> {
  if (!url || url.startsWith('data:image')) return url;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache', signal: controller.signal });
    if (!response.ok) return url;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return url;

    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return url;
      // JPEG has no transparency; paint white first so transparent PNGs don't turn black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      return dataUrl.startsWith('data:image/jpeg') ? dataUrl : url;
    } finally {
      bitmap.close();
    }
  } catch {
    return url;
  } finally {
    window.clearTimeout(timer);
  }
}
