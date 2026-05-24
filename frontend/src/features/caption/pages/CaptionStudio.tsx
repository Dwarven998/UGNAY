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
    <>
      <div className="cs-container">
        {/* Header */}
        <div className="cs-header" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="cs-ai-badge">
            <span className="cs-pulse-dot"></span>
            AI-Powered
          </div>
          <h1 className="cs-title">Caption Studio</h1>
          <p className="cs-subtitle">Generate highly engaging, brand-aligned captions powered by AI in seconds.</p>
        </div>

        {/* Step card */}
        <section className="cs-card" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s backwards' }}>
          <div className="cs-card-header">
            <div className="cs-step-row">
              <div className="cs-step-badge">1</div>
              <div>
                <h2 className="cs-card-title">Provide Media</h2>
                <p className="cs-card-desc">
                  Paste the public URL of an uploaded media asset, or select one from your repository.
                </p>
              </div>
            </div>
          </div>

          <div className="cs-card-body">
            {/* URL input */}
            <div className="cs-field">
              <label className="cs-label">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Media URL
              </label>
              <div className="cs-input-wrapper">
                <input
                  type="url"
                  placeholder="https://your-supabase-url/storage/v1/..."
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  className="cs-input"
                />
              </div>
            </div>

            {/* Preview */}
            {imageUrl ? (
              <div className="cs-preview">
                <img
                  src={imageUrl}
                  alt="preview"
                  className="cs-preview-img"
                />
              </div>
            ) : (
              <div className="cs-preview-placeholder">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Image preview will appear here</span>
              </div>
            )}

            {/* Actions */}
            <div className="cs-actions">
              <button
                type="button"
                onClick={() => navigate('/media')}
                className="cs-btn-secondary"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Open Media Repository
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!imageUrl.trim()}
                className="cs-btn-primary"
              >
                Continue to Step 2
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .cs-container {
          padding: 36px 40px 48px;
          max-width: 760px;
          margin: 0 auto;
        }

        /* Header */
        .cs-header {
          margin-bottom: 32px;
        }
        .cs-ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(12,68,124,0.06);
          border: 1px solid rgba(12,68,124,0.1);
          padding: 6px 14px;
          border-radius: 20px;
          color: #0C447C;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 14px;
        }
        .cs-pulse-dot {
          width: 7px; height: 7px;
          background: #4ade80;
          border-radius: 50%;
          animation: pulseGlow 2s infinite;
        }
        .cs-title {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.03em;
          margin: 0 0 6px;
        }
        .cs-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
          line-height: 1.5;
        }

        /* Card */
        .cs-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 8px 32px rgba(0,0,0,0.04);
          overflow: hidden;
        }
        .cs-card-header {
          padding: 24px 28px;
          background: linear-gradient(135deg, rgba(12,68,124,0.03) 0%, rgba(59,130,246,0.02) 100%);
          border-bottom: 1px solid #f1f5f9;
        }
        .cs-step-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .cs-step-badge {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #0C447C, #3b82f6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(12,68,124,0.2);
        }
        .cs-card-title {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px;
        }
        .cs-card-desc {
          font-size: 13px;
          color: #64748b;
          margin: 0;
          line-height: 1.5;
        }
        .cs-card-body {
          padding: 28px;
        }

        /* Input */
        .cs-field { margin-bottom: 24px; }
        .cs-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 8px;
        }
        .cs-input-wrapper { position: relative; }
        .cs-input {
          width: 100%;
          height: 48px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 0 16px;
          font-size: 14px;
          color: #0f172a;
          background: #f8fafc;
          font-family: inherit;
          outline: none;
          transition: all 0.2s;
        }
        .cs-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.1);
          background: #ffffff;
        }
        .cs-input::placeholder { color: #94a3b8; }

        /* Preview */
        .cs-preview {
          display: inline-block;
          padding: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          margin-bottom: 24px;
        }
        .cs-preview-img {
          width: 220px;
          height: 220px;
          object-fit: cover;
          border-radius: 12px;
          display: block;
        }
        .cs-preview-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 160px;
          border: 2px dashed #e2e8f0;
          border-radius: 14px;
          background: #fafbfc;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 24px;
        }

        /* Actions */
        .cs-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
          flex-wrap: wrap;
          gap: 12px;
        }
        .cs-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: transparent;
          color: #0C447C;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .cs-btn-secondary:hover {
          background: rgba(12,68,124,0.04);
          border-color: rgba(12,68,124,0.15);
        }
        .cs-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          background: #0C447C;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(12,68,124,0.2);
          font-family: inherit;
        }
        .cs-btn-primary:hover:not(:disabled) {
          background: #0a3867;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(12,68,124,0.3);
        }
        .cs-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .cs-container { padding: 24px 20px; }
          .cs-actions { flex-direction: column; }
          .cs-btn-secondary, .cs-btn-primary { width: 100%; justify-content: center; }
        }
      `}</style>
    </>
  );
}