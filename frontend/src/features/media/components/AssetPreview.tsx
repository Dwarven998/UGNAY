// features/media/components/AssetPreview.tsx
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaAsset } from '../../../types';
import { useDialog } from '../../../components/ui/useDialog';
import { downloadHref, formatBytes, formatDate, isImageAsset, typeLabel } from './assetView';
import './assetPreview.css';

interface AssetPreviewProps {
  /** The files in the order shown on screen; ← / → move through them. */
  assets: MediaAsset[];
  index: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onCaption: (asset: MediaAsset) => void;
  onUseInPost: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
}

interface MediaMeta { id: string; width: number; height: number; duration?: number }

function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Full-size viewer with file details and every per-file action, so nothing depends on hover. */
export default function AssetPreview({ assets, index, onNavigate, onClose, onCaption, onUseInPost, onDelete }: AssetPreviewProps) {
  const asset = assets[index];
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialog<HTMLDivElement>({ open: true, onClose, initialFocusRef: closeRef });
  const [meta, setMeta] = useState<MediaMeta | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  const hasPrev = index > 0;
  const hasNext = index < assets.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only while this preview is the top-most dialog (a delete confirmation may sit above it).
      const topDialog = Array.from(document.querySelectorAll('[aria-modal="true"]')).pop();
      if (topDialog !== dialogRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('video, input, textarea')) return;
      if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); onNavigate(index - 1); }
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); onNavigate(index + 1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, hasPrev, hasNext, onNavigate, dialogRef]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  if (!asset) return null;
  const isImage = isImageAsset(asset);
  const assetMeta = meta?.id === asset.id ? meta : null;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(asset.fileUrl);
      setCopiedId(asset.id);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked (insecure context / permissions): nothing sensible to show beyond the button staying as-is.
    }
  };

  const details: [string, string][] = [
    ['Type', typeLabel(asset) || asset.fileType],
    ['Size', formatBytes(asset.fileSize)],
    ...(assetMeta ? [['Dimensions', `${assetMeta.width} × ${assetMeta.height}`] as [string, string]] : []),
    ...(assetMeta?.duration ? [['Duration', formatDuration(assetMeta.duration)] as [string, string]] : []),
    ['Uploaded', formatDate(asset.createdAt)],
    ['Uploaded by', asset.uploadedBy || '—'],
  ];

  return createPortal(
    <div className="ap-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="ap-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="ap-stage">
          {isImage ? (
            <img
              key={asset.id}
              src={asset.fileUrl}
              alt={asset.fileName}
              onLoad={e => setMeta({ id: asset.id, width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            />
          ) : (
            <video
              key={asset.id}
              src={asset.fileUrl}
              controls
              aria-label={asset.fileName}
              onLoadedMetadata={e => setMeta({
                id: asset.id,
                width: e.currentTarget.videoWidth,
                height: e.currentTarget.videoHeight,
                duration: e.currentTarget.duration,
              })}
            >
              <track kind="captions" label="Preview captions" srcLang="en" src="" />
            </video>
          )}
          {hasPrev && (
            <button type="button" className="ap-nav ap-nav-prev" onClick={() => onNavigate(index - 1)} aria-label="Previous file">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {hasNext && (
            <button type="button" className="ap-nav ap-nav-next" onClick={() => onNavigate(index + 1)} aria-label="Next file">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          <span className="ap-counter" aria-live="polite">{index + 1} of {assets.length}</span>
        </div>

        <aside className="ap-side">
          <div className="ap-side-head">
            <h2 id={titleId} className="ap-title" title={asset.fileName}>{asset.fileName}</h2>
            <button ref={closeRef} type="button" className="ap-close" onClick={onClose} aria-label="Close preview">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <dl className="ap-details">
            {details.map(([label, value]) => (
              <div key={label} className="ap-detail">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="ap-actions">
            <button type="button" className="ap-btn ap-btn-primary" onClick={() => onCaption(asset)}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Caption Studio
            </button>
            {isImage && (
              <button type="button" className="ap-btn ap-btn-primary-outline" onClick={() => onUseInPost(asset)}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Use in Post
              </button>
            )}
            <div className="ap-actions-row">
              <button type="button" className="ap-btn" onClick={() => void copyUrl()}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={copiedId === asset.id ? 'M5 13l4 4L19 7' : 'M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3'} />
                </svg>
                <span aria-live="polite">{copiedId === asset.id ? 'Copied!' : 'Copy URL'}</span>
              </button>
              <a className="ap-btn" href={downloadHref(asset)} download={asset.fileName} target="_blank" rel="noopener noreferrer">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </a>
            </div>
            <button type="button" className="ap-btn ap-btn-danger" onClick={() => onDelete(asset)}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>

          <p className="ap-hint">Use ← → to move between files</p>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
