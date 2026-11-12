// features/caption/pages/CaptionStudio.tsx
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { uploadToSupabase } from '../../../api/supabaseClient';
import { ACCEPTED_UPLOAD_TYPES, formatBytes } from '../../media/components/assetView';

/** The AI assistant rejects videos above this size, so stop them here instead of after the upload. */
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

type Status = 'idle' | 'uploading' | 'ready' | 'error';

interface PickedMedia {
  name: string;
  size: number | null;
  isVideo: boolean;
  /** Local object URL (instant preview) or, when returning from step 2, the stored file's URL. */
  previewUrl: string;
}

/** Dropped files go straight to storage (not into a repository folder) so step 2 has a URL the AI can read. */
const storagePath = (file: File) =>
  `caption-studio/${Date.now()}_${file.name.replace(/[^\w.-]+/g, '_')}`;

function mediaFromUrl(url: string): PickedMedia {
  const rawName = url.split('?')[0].split('/').pop() ?? '';
  let name = rawName;
  try { name = decodeURIComponent(rawName); } catch { /* keep the raw name */ }
  return {
    name: name.replace(/^\d+_/, '') || 'Selected media',
    size: null,
    isVideo: url.toLowerCase().includes('.mp4'),
    previewUrl: url,
  };
}

export default function CaptionStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadToken = useRef(0);
  const dragDepth = useRef(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Coming back from step 2 ("Back"), the already-uploaded file is passed along so the user keeps it.
  const [returnedUrl] = useState(() => searchParams.get('imageUrl') ?? '');
  const [media, setMedia] = useState<PickedMedia | null>(() => (returnedUrl ? mediaFromUrl(returnedUrl) : null));
  const [mediaUrl, setMediaUrl] = useState(returnedUrl);
  const [status, setStatus] = useState<Status>(returnedUrl ? 'ready' : 'idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  // Release the local preview when it's replaced or the page unmounts.
  const previewUrl = media?.previewUrl;
  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Ignore any upload that finishes after leaving the page.
  useEffect(() => () => { uploadToken.current += 1; }, []);

  const upload = async (file: File) => {
    const token = ++uploadToken.current;
    setPendingFile(file);
    setStatus('uploading');
    setProgress(0);
    setError('');
    setMediaUrl('');
    try {
      const url = await uploadToSupabase(file, storagePath(file), fraction => {
        if (token === uploadToken.current) setProgress(Math.round(fraction * 100));
      });
      if (token !== uploadToken.current) return; // replaced or removed meanwhile
      if (url.startsWith('blob:')) {
        // supabaseClient falls back to a browser-only link when storage isn't configured; the AI and Facebook can't use it.
        throw new Error('File storage is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are empty), so this file can’t be used for captions or posts.');
      }
      setMediaUrl(url);
      setStatus('ready');
      setPendingFile(null);
    } catch (err) {
      if (token !== uploadToken.current) return;
      setStatus('error');
      setError(err instanceof Error && err.message ? err.message : 'Upload failed. Check your connection and try again.');
    }
  };

  const acceptFiles = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
      setError(`"${file.name}" isn't supported. Use a PNG, JPG, WebP or MP4 file.`);
      return;
    }
    if (file.type === 'video/mp4' && file.size > MAX_VIDEO_BYTES) {
      setError(`"${file.name}" is ${formatBytes(file.size)}. Videos must be under 15 MB for AI captions.`);
      return;
    }
    setMedia({ name: file.name, size: file.size, isVideo: file.type === 'video/mp4', previewUrl: URL.createObjectURL(file) });
    void upload(file);
    if (files.length > 1) setError(`Caption Studio captions one file at a time, so only "${file.name}" was added.`);
  };

  const removeMedia = () => {
    uploadToken.current += 1;
    setPendingFile(null);
    setMedia(null);
    setMediaUrl('');
    setStatus('idle');
    setProgress(0);
    setError('');
  };

  const openPicker = () => fileRef.current?.click();

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    acceptFiles(files);
  };

  // ── Drag and drop ──
  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    acceptFiles(Array.from(e.dataTransfer.files));
  };
  const onZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
  };

  const handleContinue = () => {
    if (status !== 'ready' || !mediaUrl) return;
    // Single-file flow: clear any multi-select or repository asset left over from an earlier visit.
    sessionStorage.removeItem('caption_image_urls');
    sessionStorage.removeItem('caption_asset_ids');
    sessionStorage.removeItem('caption_asset_id');
    sessionStorage.setItem('caption_image_url', mediaUrl);
    navigate(`/caption/select-tone?imageUrl=${encodeURIComponent(mediaUrl)}`);
  };

  const emptyZoneProps = media ? {} : {
    role: 'button',
    tabIndex: 0,
    'aria-label': 'Upload media: drop a file here or press Enter to browse',
    onClick: openPicker,
    onKeyDown: onZoneKeyDown,
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
          <p className="cs-composer-hint">
            Writing a post? The same AI caption assistant is built into{' '}
            <Link to="/create" className="cs-composer-link">Create Post</Link>.
          </p>
        </div>

        {/* Step card */}
        <section className="cs-card" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s backwards' }}>
          <div className="cs-card-header">
            <div className="cs-step-row">
              <div className="cs-step-badge">1</div>
              <div>
                <h2 className="cs-card-title">Provide Media</h2>
                <p className="cs-card-desc">
                  Drag and drop a photo or video, or select one from your repository.
                </p>
              </div>
            </div>
          </div>

          <div className="cs-card-body">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_UPLOAD_TYPES.join(',')}
              onChange={handleFilePick}
              style={{ display: 'none' }}
            />

            {/* Drop zone (also the preview once a file is chosen) */}
            <div
              className={`cs-dropzone${dragging ? ' cs-dropzone-active' : ''}${media ? ' cs-dropzone-filled' : ''}`}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              {...emptyZoneProps}
            >
              {media ? (
                <div className="cs-media">
                  <div className="cs-preview">
                    {media.isVideo ? (
                      <video src={media.previewUrl} controls preload="metadata" className="cs-preview-img" aria-label={media.name}>
                        <track kind="captions" label="Preview captions" srcLang="en" src="" />
                      </video>
                    ) : (
                      <img src={media.previewUrl} alt={media.name} className="cs-preview-img" />
                    )}
                    {dragging && <div className="cs-drop-overlay">Drop to replace</div>}
                  </div>

                  <div className="cs-media-info">
                    <p className="cs-media-name" title={media.name}>{media.name}</p>
                    <p className="cs-media-meta">
                      {media.isVideo ? 'Video' : 'Image'}
                      {media.size != null && <> · {formatBytes(media.size)}</>}
                    </p>

                    {status === 'uploading' && (
                      <div className="cs-progress">
                        <div className="cs-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Upload progress">
                          <div className="cs-progress-bar" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="cs-progress-text">Uploading… {progress}%</span>
                      </div>
                    )}
                    {status === 'ready' && (
                      <p className="cs-media-status">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Ready for captioning
                      </p>
                    )}

                    <div className="cs-media-actions">
                      {status === 'error' && pendingFile && (
                        <button type="button" className="cs-btn-link" onClick={() => void upload(pendingFile)}>
                          Retry upload
                        </button>
                      )}
                      <button type="button" className="cs-btn-link" onClick={openPicker}>Replace</button>
                      <button type="button" className="cs-btn-link cs-btn-link-danger" onClick={removeMedia}>Remove</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cs-drop-empty">
                  <div className="cs-drop-icon">
                    <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="cs-drop-title">{dragging ? 'Drop your file here' : 'Drag and drop your media here'}</p>
                  <p className="cs-drop-sub">or <span className="cs-drop-browse">browse your files</span></p>
                  <p className="cs-drop-types">PNG, JPG, WEBP or MP4 · videos up to 15 MB</p>
                </div>
              )}
            </div>

            {error && <p className="cs-error" role="alert">{error}</p>}

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
                disabled={status !== 'ready' || !mediaUrl}
                className="cs-btn-primary"
              >
                {status === 'uploading' ? 'Uploading…' : 'Continue to Step 2'}
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

        .cs-composer-hint {
          margin-top: 10px;
          font-size: 13px;
          color: #64748b;
        }
        .cs-composer-link {
          color: #0C447C;
          font-weight: 600;
          text-underline-offset: 2px;
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

        /* Drop zone */
        .cs-dropzone {
          border: 2px dashed #cbd5e1;
          border-radius: 14px;
          background: #fafbfc;
          margin-bottom: 24px;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        .cs-dropzone[role="button"] { cursor: pointer; }
        .cs-dropzone[role="button"]:hover { border-color: #93c5fd; background: #f5f9ff; }
        .cs-dropzone:focus-visible { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.12); }
        .cs-dropzone-active { border-color: #3b82f6; background: rgba(59,130,246,0.06); }
        .cs-dropzone-filled { border-style: solid; border-color: #e2e8f0; background: #ffffff; }
        .cs-dropzone-filled.cs-dropzone-active { border-style: dashed; border-color: #3b82f6; }

        .cs-drop-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 200px;
          padding: 24px;
          text-align: center;
        }
        .cs-drop-icon {
          width: 52px; height: 52px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(12,68,124,0.06);
          color: #0C447C;
          margin-bottom: 6px;
        }
        .cs-drop-title { margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; }
        .cs-drop-sub { margin: 0; font-size: 13px; color: #64748b; }
        .cs-drop-browse { color: #0C447C; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
        .cs-drop-types { margin: 6px 0 0; font-size: 12px; color: #94a3b8; }

        /* Chosen file */
        .cs-media { display: flex; align-items: flex-start; gap: 20px; padding: 16px; }
        .cs-preview {
          position: relative;
          flex-shrink: 0;
          padding: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
        }
        .cs-preview-img {
          width: 220px;
          height: 220px;
          object-fit: cover;
          border-radius: 12px;
          display: block;
        }
        video.cs-preview-img { object-fit: contain; background: #0f172a; }
        .cs-drop-overlay {
          position: absolute; inset: 6px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(12,68,124,0.75);
          color: #fff; font-size: 13px; font-weight: 600;
          pointer-events: none;
        }
        .cs-media-info { min-width: 0; flex: 1; padding-top: 4px; }
        .cs-media-name {
          margin: 0 0 2px;
          font-size: 14px; font-weight: 700; color: #0f172a;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cs-media-meta { margin: 0 0 14px; font-size: 12px; color: #64748b; }
        .cs-media-status { display: flex; align-items: center; gap: 6px; margin: 0 0 14px; font-size: 13px; font-weight: 600; color: #15803d; }
        .cs-progress { margin-bottom: 14px; }
        .cs-progress-track { height: 6px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
        .cs-progress-bar { height: 100%; background: linear-gradient(90deg, #0C447C, #3b82f6); transition: width 0.2s; }
        .cs-progress-text { display: block; margin-top: 6px; font-size: 12px; color: #64748b; }
        .cs-media-actions { display: flex; flex-wrap: wrap; gap: 14px; }
        .cs-btn-link {
          padding: 0; border: none; background: none;
          font: inherit; font-size: 13px; font-weight: 600; color: #0C447C;
          cursor: pointer; text-decoration: underline; text-underline-offset: 2px;
        }
        .cs-btn-link-danger { color: #dc2626; }
        .cs-error {
          margin: -12px 0 20px;
          padding: 10px 14px;
          border-radius: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 13px;
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
          .cs-media { flex-direction: column; align-items: stretch; }
          .cs-preview-img { width: 100%; height: auto; aspect-ratio: 1; }
        }
      `}</style>
    </>
  );
}