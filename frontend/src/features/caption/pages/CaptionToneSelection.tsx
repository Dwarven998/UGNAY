import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { captionApi } from '../api/captionApi.ts';
import TonePreferenceSelector from '../components/TonePreferenceSelector.tsx';
import type { Tone } from '../../../types';

const DEFAULT_TONE: Tone = 'FORMAL';

export default function CaptionToneSelection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [imageUrl, setImageUrl] = useState('');
  const [selectedTone, setSelectedTone] = useState<Tone>(DEFAULT_TONE);
  const [captions, setCaptions] = useState<string[]>([]);
  const [selectedCaption, setSelectedCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);

  useEffect(() => {
    const urlFromQuery = searchParams.get('imageUrl');
    const urlFromSession = sessionStorage.getItem('caption_image_url');
    const resolvedImageUrl = urlFromQuery ?? urlFromSession ?? '';

    setImageUrl(resolvedImageUrl);
    if (resolvedImageUrl) {
      sessionStorage.setItem('caption_image_url', resolvedImageUrl);
    }
  }, [searchParams]);

  const handleBack = () => {
    const query = imageUrl ? `?imageUrl=${encodeURIComponent(imageUrl)}` : '';
    navigate(`/caption${query}`);
  };

  const handleGenerate = async () => {
    if (!imageUrl) return;
    setIsGenerating(true);
    try {
      const result = await captionApi.generate(imageUrl, selectedTone);
      setCaptions(result);
      setSelectedCaption('');
      setHashtags([]);
    } catch {
      alert('Caption generation failed. Check your Gemini API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRewrite = async (tone: Tone) => {
    if (!selectedCaption) return;
    setIsRewriting(true);
    setSelectedTone(tone);
    try {
      const rewritten = await captionApi.rewrite(selectedCaption, tone);
      setSelectedCaption(rewritten);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleHashtags = async () => {
    if (!selectedCaption) return;
    const tags = await captionApi.hashtags(selectedCaption);
    setHashtags(tags);
  };

  const handleSendToScheduler = () => {
    sessionStorage.setItem('caption_draft', JSON.stringify({
      caption: selectedCaption,
      hashtags,
      imageUrl,
      tone: selectedTone,
    }));
    navigate('/posts');
  };

  if (!imageUrl) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center space-y-4">
          <h1 className="text-xl font-bold">Step 2 — Select Tone</h1>
          <p className="text-sm text-gray-500">
            No image was provided. Go back to Step 1 and paste a public media URL first.
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to Step 1
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500">AI Caption Studio</p>
          <h1 className="text-xl font-bold">Step 2 — Select Tone</h1>
        </div>
        <button
          type="button"
          onClick={handleBack}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to Step 1
        </button>
      </div>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
          <img
            src={imageUrl}
            alt="Selected media preview"
            className="h-52 w-full rounded-xl border object-cover"
          />
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">Choose the caption tone</h2>
            <p className="text-sm text-gray-500">
              Pick the tone that matches the organization profile before generating captions.
            </p>
            <TonePreferenceSelector value={selectedTone} onChange={setSelectedTone} disabled={isGenerating} />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {isGenerating ? '⏳ Generating with Gemini...' : '✨ Generate 3 Captions'}
            </button>
          </div>
        </div>
      </section>

      {captions.length > 0 && (
        <section className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-lg">Step 3 — Choose a Caption</h2>
          <div className="space-y-3">
            {captions.map((caption, index) => (
              <button
                key={`${caption}-${index}`}
                type="button"
                onClick={() => setSelectedCaption(caption)}
                className={`w-full p-4 border-2 rounded-lg text-left transition ${
                  selectedCaption === caption
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm">{caption}</p>
              </button>
            ))}
          </div>

          {selectedCaption && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 font-medium">Rewrite in different tone:</p>
              <div className="flex gap-2 flex-wrap">
                {['FORMAL', 'ENERGETIC', 'CELEBRATORY', 'URGENT'].map(tone => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => handleRewrite(tone as Tone)}
                    disabled={isRewriting}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full"
                  >
                    {tone}
                  </button>
                ))}
              </div>
              {isRewriting && <p className="text-xs text-gray-400">Rewriting...</p>}

              <textarea
                value={selectedCaption}
                onChange={e => setSelectedCaption(e.target.value)}
                rows={4}
                className="w-full border rounded-lg px-4 py-2 text-sm"
              />
            </div>
          )}
        </section>
      )}

      {selectedCaption && (
        <section className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-lg">Step 4 — Hashtags</h2>
          <button
            type="button"
            onClick={handleHashtags}
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm"
          >
            🏷️ Generate Hashtags
          </button>
          {hashtags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {hashtags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="pt-4 border-t">
            <button
              type="button"
              onClick={handleSendToScheduler}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium"
            >
              📅 Send to Post Scheduler
            </button>
          </div>
        </section>
      )}
    </div>
  );
}