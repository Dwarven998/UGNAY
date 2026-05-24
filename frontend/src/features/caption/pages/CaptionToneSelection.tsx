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
      <>
        <div className="cts-container">
          <div className="cts-missing">
            <div className="cts-missing-icon">
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="cts-missing-title">Missing Media</h1>
            <p className="cts-missing-text">
              No image was provided. Please go back to the first step and provide a valid public media URL to continue.
            </p>
            <button type="button" onClick={handleBack} className="cts-btn-back-empty">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Return to Step 1
            </button>
          </div>
        </div>
        <style>{ctsStyles}</style>
      </>
    );
  }

  return (
    <>
      <div className="cts-container">
        {/* Header */}
        <div className="cts-header" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
          <div>
            <div className="cts-breadcrumb">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>AI Caption Studio</span>
            </div>
            <h1 className="cts-title">Generate &amp; Refine</h1>
          </div>
          <button type="button" onClick={handleBack} className="cts-btn-back">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Change Image
          </button>
        </div>

        {/* Step 2: Tone + Generate */}
        <section className="cts-card" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s backwards' }}>
          <div className="cts-card-grid">
            {/* Image preview */}
            <div className="cts-image-wrap">
              <img src={imageUrl} alt="Selected media preview" className="cts-image" />
            </div>

            {/* Controls */}
            <div className="cts-controls">
              <div className="cts-step-header">
                <div className="cts-step-badge">2</div>
                <div>
                  <h2 className="cts-step-title">Select Brand Tone</h2>
                  <p className="cts-step-desc">Choose the voice that best fits this specific post.</p>
                </div>
              </div>

              <TonePreferenceSelector value={selectedTone} onChange={setSelectedTone} disabled={isGenerating} />

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="cts-btn-generate"
              >
                {isGenerating ? (
                  <>
                    <svg className="cts-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating with AI...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Generate 3 Captions
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Step 3: Select & Refine */}
        {captions.length > 0 && (
          <section className="cts-card" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            <div className="cts-section-header">
              <div className="cts-step-badge">3</div>
              <h2 className="cts-section-title">Select &amp; Refine Caption</h2>
            </div>
            <div className="cts-section-body">
              <div className="cts-caption-grid">
                {captions.map((caption, index) => (
                  <button
                    key={`${caption}-${index}`}
                    type="button"
                    onClick={() => setSelectedCaption(caption)}
                    className={`cts-caption-card ${selectedCaption === caption ? 'cts-caption-active' : ''}`}
                  >
                    <div className="cts-caption-number">#{index + 1}</div>
                    <p className="cts-caption-text">{caption}</p>
                  </button>
                ))}
              </div>

              {selectedCaption && (
                <div className="cts-refine" style={{ animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                  <div className="cts-refine-header">
                    <label className="cts-refine-label">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Caption
                    </label>
                    <div className="cts-rewrite-group">
                      <span className="cts-rewrite-label">Rewrite as:</span>
                      {(['FORMAL', 'ENERGETIC', 'CELEBRATORY', 'URGENT'] as Tone[]).map(tone => (
                        <button
                          key={tone}
                          type="button"
                          onClick={() => handleRewrite(tone)}
                          disabled={isRewriting}
                          className="cts-rewrite-btn"
                        >
                          {tone}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cts-textarea-wrap">
                    <textarea
                      value={selectedCaption}
                      onChange={e => setSelectedCaption(e.target.value)}
                      rows={5}
                      className="cts-textarea"
                    />
                    {isRewriting && (
                      <div className="cts-rewriting-overlay">
                        <svg className="cts-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Rewriting...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Step 4: Final Touches */}
        {selectedCaption && (
          <section className="cts-card cts-card-final" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            <div className="cts-section-header">
              <div className="cts-step-badge">4</div>
              <h2 className="cts-section-title" style={{ flex: 1 }}>Final Touches</h2>
              <button type="button" onClick={handleHashtags} className="cts-btn-hashtag">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                Generate Hashtags
              </button>
            </div>
            <div className="cts-section-body">
              {hashtags.length > 0 ? (
                <div className="cts-hashtag-pills">
                  {hashtags.map((tag, index) => (
                    <span key={`${tag}-${index}`} className="cts-hashtag-pill">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="cts-hashtag-empty">No hashtags generated yet. Click the button above to auto-generate.</p>
              )}

              <div className="cts-final-action">
                <button type="button" onClick={handleSendToScheduler} className="cts-btn-send">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Send to Post Scheduler
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      <style>{ctsStyles}</style>
    </>
  );
}

const ctsStyles = `
  .cts-container {
    padding: 36px 40px 60px;
    max-width: 960px;
    margin: 0 auto;
  }

  /* Header */
  .cts-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 28px;
  }
  .cts-breadcrumb {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #0C447C;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .cts-title {
    font-size: 28px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.03em;
    margin: 0;
  }
  .cts-btn-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #ffffff;
    color: #64748b;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    flex-shrink: 0;
  }
  .cts-btn-back:hover { color: #0f172a; border-color: #cbd5e1; background: #f8fafc; }

  /* Cards */
  .cts-card {
    background: #ffffff;
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 24px rgba(0,0,0,0.04);
    overflow: hidden;
    margin-bottom: 20px;
  }
  .cts-card-final { margin-bottom: 0; }

  .cts-card-grid {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 0;
  }
  .cts-image-wrap {
    padding: 24px;
    background: #f8fafc;
    border-right: 1px solid #f1f5f9;
    display: flex;
    align-items: flex-start;
  }
  .cts-image {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  }
  .cts-controls {
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .cts-step-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .cts-step-badge {
    width: 30px; height: 30px;
    background: linear-gradient(135deg, #0C447C, #3b82f6);
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(12,68,124,0.2);
  }
  .cts-step-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 2px;
  }
  .cts-step-desc {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }
  .cts-btn-generate {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px 24px;
    background: #0C447C;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 14px rgba(12,68,124,0.2);
    font-family: inherit;
  }
  .cts-btn-generate:hover:not(:disabled) {
    background: #0a3867;
    box-shadow: 0 6px 20px rgba(12,68,124,0.3);
  }
  .cts-btn-generate:disabled { opacity: 0.7; cursor: not-allowed; }
  .cts-spinner { animation: spin 0.8s linear infinite; }

  /* Section headers */
  .cts-section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 28px;
    background: linear-gradient(135deg, rgba(12,68,124,0.03) 0%, rgba(59,130,246,0.02) 100%);
    border-bottom: 1px solid #f1f5f9;
  }
  .cts-section-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }
  .cts-section-body { padding: 24px 28px; }

  /* Caption cards */
  .cts-caption-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 4px;
  }
  .cts-caption-card {
    position: relative;
    text-align: left;
    padding: 18px;
    border-radius: 14px;
    border: 2px solid #e2e8f0;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
    font-family: inherit;
  }
  .cts-caption-card:hover {
    border-color: #cbd5e1;
    background: #fafbfc;
  }
  .cts-caption-active {
    border-color: #0C447C !important;
    background: rgba(12,68,124,0.02) !important;
    box-shadow: 0 0 0 4px rgba(12,68,124,0.06);
  }
  .cts-caption-number {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .cts-caption-active .cts-caption-number { color: #0C447C; }
  .cts-caption-text {
    font-size: 13px;
    color: #475569;
    line-height: 1.65;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Refine */
  .cts-refine {
    padding-top: 24px;
    border-top: 1px solid #f1f5f9;
    margin-top: 20px;
  }
  .cts-refine-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 10px;
  }
  .cts-refine-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #334155;
  }
  .cts-rewrite-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cts-rewrite-label {
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
    margin-right: 4px;
  }
  .cts-rewrite-btn {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 5px 12px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #475569;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .cts-rewrite-btn:hover:not(:disabled) {
    background: #e2e8f0;
    color: #0f172a;
  }
  .cts-rewrite-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cts-textarea-wrap { position: relative; }
  .cts-textarea {
    width: 100%;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    padding: 16px;
    font-size: 14px;
    color: #0f172a;
    background: #ffffff;
    font-family: inherit;
    outline: none;
    transition: all 0.2s;
    resize: vertical;
    line-height: 1.65;
  }
  .cts-textarea:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 4px rgba(59,130,246,0.1);
  }
  .cts-rewriting-overlay {
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(4px);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #0C447C;
    font-size: 14px;
    font-weight: 600;
  }

  /* Hashtags */
  .cts-btn-hashtag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #059669;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    margin-left: auto;
  }
  .cts-btn-hashtag:hover { background: #047857; }
  .cts-hashtag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
  }
  .cts-hashtag-pill {
    display: inline-flex;
    align-items: center;
    padding: 6px 14px;
    background: rgba(5,150,105,0.06);
    border: 1px solid rgba(5,150,105,0.12);
    color: #059669;
    font-size: 12px;
    font-weight: 600;
    border-radius: 20px;
  }
  .cts-hashtag-empty {
    color: #94a3b8;
    font-size: 13px;
    text-align: center;
    padding: 20px 0;
    margin: 0 0 20px;
  }

  /* Final CTA */
  .cts-final-action {
    padding-top: 20px;
    border-top: 1px solid #f1f5f9;
  }
  .cts-btn-send {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 16px 24px;
    background: #0C447C;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 14px rgba(12,68,124,0.2);
    font-family: inherit;
  }
  .cts-btn-send:hover {
    background: #0a3867;
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(12,68,124,0.3);
  }

  /* Missing state */
  .cts-missing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 80px 24px;
    background: #ffffff;
    border-radius: 20px;
    border: 2px dashed #e2e8f0;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1);
  }
  .cts-missing-icon {
    width: 64px; height: 64px;
    background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04));
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f59e0b;
    margin-bottom: 20px;
  }
  .cts-missing-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 8px;
  }
  .cts-missing-text {
    font-size: 14px;
    color: #64748b;
    margin: 0 0 24px;
    max-width: 400px;
    line-height: 1.6;
  }
  .cts-btn-back-empty {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    color: #0C447C;
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .cts-btn-back-empty:hover { background: #f8fafc; border-color: #cbd5e1; }

  @media (max-width: 768px) {
    .cts-container { padding: 24px 20px 48px; }
    .cts-card-grid { grid-template-columns: 1fr; }
    .cts-image-wrap { border-right: none; border-bottom: 1px solid #f1f5f9; }
    .cts-caption-grid { grid-template-columns: 1fr; }
    .cts-refine-header { flex-direction: column; align-items: flex-start; }
    .cts-rewrite-group { flex-wrap: wrap; }
    .cts-header { flex-direction: column; gap: 12px; }
    .cts-section-header { flex-wrap: wrap; }
  }
`;