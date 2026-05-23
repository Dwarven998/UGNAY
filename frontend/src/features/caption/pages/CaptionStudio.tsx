// features/caption/pages/CaptionStudio.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function CaptionStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    const urlFromQuery = searchParams.get('imageUrl');
    const urlFromSession = sessionStorage.getItem('caption_image_url');
    setImageUrl(urlFromQuery ?? urlFromSession ?? '');
  }, [searchParams]);

  const handleContinue = () => {
    const nextImageUrl = imageUrl.trim();
    if (!nextImageUrl) return;

    sessionStorage.setItem('caption_image_url', nextImageUrl);
    navigate(`/caption/select-tone?imageUrl=${encodeURIComponent(nextImageUrl)}`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">AI Caption Studio</h1>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">Step 1 — Image</h2>
          <p className="text-sm text-gray-500">
            Paste the public URL of an uploaded media asset, or open the Media Repository to pick one first.
          </p>
        </div>

        <input
          type="text"
          placeholder="https://your-supabase-url/storage/v1/..."
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 text-sm"
        />

        {imageUrl && (
          <img
            src={imageUrl}
            alt="preview"
            className="w-48 h-48 object-cover rounded-lg border"
          />
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/media')}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Open Media Repository
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!imageUrl.trim()}
            className="ml-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Continue to Step 2
          </button>
        </div>
      </section>
    </div>
  );
}