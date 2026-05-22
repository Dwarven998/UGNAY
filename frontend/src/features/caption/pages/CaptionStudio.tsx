// features/caption/pages/CaptionStudio.tsx
import { useState } from 'react';
import { captionApi } from '../api/captionApi.ts';
import type { Tone } from '../../../types';

const TONES: Tone[] = ['FORMAL', 'ENERGETIC', 'CELEBRATORY', 'URGENT'];

export default function CaptionStudio() {
  const [imageUrl, setImageUrl] = useState('');
  const [selectedTone, setSelectedTone] = useState<Tone>('FORMAL');
  const [captions, setCaptions] = useState<string[]>([]);
  const [selectedCaption, setSelectedCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);

  const handleGenerate = async () => {
    if (!imageUrl) return;
    setIsGenerating(true);
    try {
      const result = await captionApi.generate(imageUrl, selectedTone);
      setCaptions(result);
    } catch (e) {
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">AI Caption Studio</h1>

      {/* Step 1: Image URL input */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold text-lg">Step 1 — Image</h2>
        <p className="text-sm text-gray-500">
          Paste the public URL of an uploaded media asset, or select from Media Repository.
        </p>
        <input
          type="text"
          placeholder="https://your-supabase-url/storage/v1/..."
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 text-sm"
        />
        {imageUrl && (
          <img src={imageUrl} alt="preview"
            className="w-48 h-48 object-cover rounded-lg border" />
        )}
      </section>

      {/* Step 2: Tone selection */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold text-lg">Step 2 — Select Tone</h2>
        <div className="grid grid-cols-4 gap-3">
          {TONES.map(tone => (
            <button
              key={tone}
              onClick={() => setSelectedTone(tone)}
              className={`py-2 px-4 rounded-lg border-2 text-sm font-medium transition
                ${selectedTone === tone
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'}`}
            >
              {tone === 'FORMAL' && '🎓 Formal'}
              {tone === 'ENERGETIC' && '⚡ Energetic'}
              {tone === 'CELEBRATORY' && '🎉 Celebratory'}
              {tone === 'URGENT' && '🚨 Urgent'}
            </button>
          ))}
        </div>
        <button
          onClick={handleGenerate}
          disabled={!imageUrl || isGenerating}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
        >
          {isGenerating ? '⏳ Generating with Gemini...' : '✨ Generate 3 Captions'}
        </button>
      </section>

      {/* Step 3: Caption selection */}
      {captions.length > 0 && (
        <section className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-lg">Step 3 — Choose a Caption</h2>
          <div className="space-y-3">
            {captions.map((caption, i) => (
              <div
                key={i}
                onClick={() => setSelectedCaption(caption)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition
                  ${selectedCaption === caption
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'}`}
              >
                <p className="text-sm">{caption}</p>
              </div>
            ))}
          </div>

          {/* Tone rewrite */}
          {selectedCaption && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 font-medium">Rewrite in different tone:</p>
              <div className="flex gap-2 flex-wrap">
                {TONES.map(tone => (
                  <button
                    key={tone}
                    onClick={() => handleRewrite(tone)}
                    disabled={isRewriting}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full"
                  >
                    {tone}
                  </button>
                ))}
              </div>
              {isRewriting && <p className="text-xs text-gray-400">Rewriting...</p>}

              {/* Edited caption preview */}
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

      {/* Step 4: Hashtags */}
      {selectedCaption && (
        <section className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-lg">Step 4 — Hashtags</h2>
          <button
            onClick={handleHashtags}
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm"
          >
            🏷️ Generate Hashtags
          </button>
          {hashtags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {hashtags.map((tag, i) => (
                <span key={i}
                  className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Send to Post Scheduler */}
          <div className="pt-4 border-t">
            <button
              onClick={() => {
                // Store in sessionStorage, redirect to PostManager
                sessionStorage.setItem('caption_draft', JSON.stringify({
                  caption: selectedCaption,
                  hashtags,
                  imageUrl,
                  tone: selectedTone,
                }));
                window.location.href = '/posts';
              }}
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