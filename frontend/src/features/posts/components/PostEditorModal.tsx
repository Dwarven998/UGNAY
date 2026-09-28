import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Post, PostConflict, MediaAsset, MediaFolder } from '../../../types';
import ConflictAlertBanner from './ConflictAlertBanner';
import DateTimePickerPanel from './DateTimePickerPanel';
import { mediaApi } from '../../media/api/mediaApi';
import { useOrganization } from '../../../context/useOrganization';
import { useDialog } from '../../../components/ui/useDialog';
import { useFacebookConnection } from '../hooks/useFacebookConnection';
import { normalizeHashtags } from '../composerHandoff';
import '../posts.css';

export interface PostEditorDraft {
  caption: string;
  hashtags: string[];
  tone: string;
  mediaAssetId: string;
  mediaAssetIds?: string[];
  scheduledAt: string;
  /** Preview URL carried from Caption Studio (not an asset ID). */
  mediaPreviewUrl?: string;
  mediaPreviewUrls?: string[];
  /** True when the draft originated from Caption Studio (tone was pre-selected). */
  fromCaptionStudio?: boolean;
}

export interface PostEditorModalProps {
  open: boolean;
  initialPost?: Post | null;
  initialDraft?: Partial<PostEditorDraft> | null;
  conflict?: PostConflict | null;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (draft: PostEditorDraft) => Promise<void>;
  onClearConflict?: () => void;
}

function getDefaultSuggestedTime() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(19, 0, 0, 0);
  return next;
}

/** A comparable snapshot of the editable fields, used to detect unsaved changes. */
function snapshot(caption: string, hashtags: string[], tone: string, assets: { id: string; url: string }[], scheduledAt: Date | null) {
  return JSON.stringify([caption, hashtags, tone, assets.map(a => a.id || a.url), scheduledAt?.getTime() ?? null]);
}

export default function PostEditorModal({
  open,
  initialPost,
  initialDraft,
  conflict,
  loading = false,
  error = '',
  onClose,
  onSubmit,
  onClearConflict,
}: PostEditorModalProps) {
  const suggestedTime = useMemo(() => getDefaultSuggestedTime(), []);
  const { activeOrgId } = useOrganization();
  const { scopeKey, resolved: pageResolved } = useFacebookConnection();
  const scopeKeyRef = useRef(scopeKey);
  useEffect(() => { scopeKeyRef.current = scopeKey; }, [scopeKey]);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tone, setTone] = useState('FORMAL');
  const [selectedAssets, setSelectedAssets] = useState<{ id: string; url: string }[]>([]);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(suggestedTime);
  const [hashtagInput, setHashtagInput] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const submittingRef = useRef(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const ids = {
    title: useId(),
    caption: useId(),
    hashtags: useId(),
    tone: useId(),
    schedule: useId(),
    media: useId(),
  };

  // Media picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [foldersState, setFoldersState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetsError, setAssetsError] = useState('');

  useEffect(() => {
    if (!open) return;
    const mergedHashtags = initialPost?.hashtags ?? initialDraft?.hashtags ?? [];
    const nextCaption = initialPost?.caption ?? initialDraft?.caption ?? '';
    const nextTone = initialPost?.tone ?? initialDraft?.tone ?? 'FORMAL';
    setCaption(nextCaption);
    setHashtags(mergedHashtags);
    setTone(nextTone);

    const urls: string[] = initialDraft?.mediaPreviewUrls && initialDraft.mediaPreviewUrls.length > 0
      ? initialDraft.mediaPreviewUrls
      : initialPost?.mediaUrls && initialPost.mediaUrls.length > 0
        ? initialPost.mediaUrls
        : (initialPost?.mediaUrl ? [initialPost.mediaUrl] : (initialDraft?.mediaPreviewUrl ? [initialDraft.mediaPreviewUrl] : []));

    const assetIds: string[] = initialDraft?.mediaAssetIds && initialDraft.mediaAssetIds.length > 0
      ? initialDraft.mediaAssetIds
      : initialPost?.mediaAssetIds && initialPost.mediaAssetIds.length > 0
        ? initialPost.mediaAssetIds
        : (initialDraft?.mediaAssetId ? [initialDraft.mediaAssetId] : []);

    const combined: { id: string; url: string }[] = [];
    const count = Math.max(urls.length, assetIds.length);
    for (let i = 0; i < count; i++) {
      if (urls[i] || assetIds[i]) {
        combined.push({
          id: assetIds[i] || '',
          url: urls[i] || '',
        });
      }
    }
    setSelectedAssets(combined);

    const nextScheduledAt = initialDraft?.scheduledAt
      ? new Date(initialDraft.scheduledAt)
      : initialPost?.scheduledAt
        ? new Date(initialPost.scheduledAt)
        : suggestedTime;
    setScheduledAt(nextScheduledAt);
    setHashtagInput('');
    setPickerOpen(false);
    setConfirmDiscard(false);
    setInitialSnapshot(snapshot(nextCaption, mergedHashtags, nextTone, combined, nextScheduledAt));
  }, [initialDraft, initialPost, open, suggestedTime]);

  // The picker only ever offers the active workspace's Media Repository for the connected Facebook Page.
  // When the Page changes, whatever the picker was showing belongs to the previous Page and is dropped
  // (adjusted during render, so the old Page's folders are never painted for the new one).
  const [pickerScope, setPickerScope] = useState(scopeKey);
  if (pickerScope !== scopeKey) {
    setPickerScope(scopeKey);
    setFolders([]);
    setFoldersState('loading');
    setSelectedFolder(null);
    setAssets([]);
  }

  // Load folders when picker opens
  useEffect(() => {
    if (!pickerOpen || !pageResolved) return;
    let cancelled = false;
    mediaApi.getFolders(activeOrgId)
      .then(data => {
        if (cancelled) return;
        setFolders(data);
        setFoldersState('ready');
      })
      .catch(err => {
        console.error('Failed to load folders:', err);
        if (!cancelled) setFoldersState('error');
      });
    return () => { cancelled = true; };
  }, [pickerOpen, pageResolved, activeOrgId, scopeKey]);

  const dirty = open && snapshot(caption, hashtags, tone, selectedAssets, scheduledAt) !== initialSnapshot;

  /** Every way of dismissing the modal goes through here, so unsaved edits are never lost by accident. */
  const requestClose = () => {
    if (loading) return;
    if (confirmDiscard) {
      // Escape / backdrop while the prompt is showing means "keep editing".
      setConfirmDiscard(false);
      return;
    }
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const dialogRef = useDialog<HTMLDivElement>({
    open,
    onClose: requestClose,
    canClose: !loading,
    initialFocusRef: captionRef,
  });

  // Load assets when a folder is selected in picker
  const loadPickerAssets = async (folder: MediaFolder) => {
    const requestedScope = scopeKey;
    setSelectedFolder(folder);
    setLoadingAssets(true);
    setAssetsError('');
    try {
      const data = await mediaApi.getAssets(folder.id);
      if (scopeKeyRef.current === requestedScope) setAssets(data);
    } catch (err) {
      console.error('Failed to load folder assets:', err);
      setAssets([]);
      setAssetsError('Couldn’t load this folder. Try selecting it again.');
    } finally {
      setLoadingAssets(false);
    }
  };

  const toggleAsset = (asset: MediaAsset) => {
    setSelectedAssets(prev => {
      const exists = prev.some(item => (item.id && item.id === asset.id) || (item.url && item.url === asset.fileUrl));
      if (exists) {
        return prev.filter(item => !(item.id === asset.id || item.url === asset.fileUrl));
      } else {
        return [...prev, { id: asset.id, url: asset.fileUrl }];
      }
    });
    onClearConflict?.();
  };

  const removeAssetAt = (index: number) => {
    setSelectedAssets(prev => prev.filter((_, i) => i !== index));
    onClearConflict?.();
  };

  if (!open) return null;

  const addHashtag = (value: string) => {
    const cleaned = value.replace(/^#/, '').trim();
    if (!cleaned) return;
    // Stored with the leading "#": the publisher joins hashtags into the message as-is.
    setHashtags(current => normalizeHashtags([...current, cleaned]));
    setHashtagInput('');
    onClearConflict?.();
  };

  const submit = async () => {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    const assetIds = selectedAssets.map(a => a.id).filter(Boolean);
    const urls = selectedAssets.map(a => a.url).filter(Boolean);
    try {
      await onSubmit({
        caption,
        hashtags: normalizeHashtags([...hashtags, ...(hashtagInput.trim() ? [hashtagInput] : [])]),
        tone,
        mediaAssetId: assetIds[0] || '',
        mediaAssetIds: assetIds,
        mediaPreviewUrl: urls[0] || '',
        mediaPreviewUrls: urls,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : '',
      });
    } finally {
      submittingRef.current = false;
    }
  };

  const isEdit = Boolean(initialPost);
  const primaryLabel = loading ? (isEdit ? 'Saving…' : 'Scheduling…') : (isEdit ? 'Update Post' : 'Schedule Post');

  return createPortal(
    <div className="upe-modal-backdrop" role="presentation" onClick={requestClose}>
      <div
        ref={dialogRef}
        className="upe-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-busy={loading || undefined}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="upe-modal-header">
          <div>
            <div className="upe-modal-kicker">Post Scheduler</div>
            <h2 id={ids.title}>{isEdit ? 'Edit Scheduled Post' : 'Create Post'}</h2>
          </div>
          <button
            type="button"
            className="upe-modal-close"
            onClick={requestClose}
            disabled={loading}
            aria-label="Close dialog"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="upe-modal-body">
          <label className="upe-field" htmlFor={ids.caption}>
            <span className="upe-field-label-row">
              <span className="upe-field-label">Caption</span>
              <span className="upe-field-hint">{caption.length.toLocaleString()} characters</span>
            </span>
            <textarea
              ref={captionRef}
              id={ids.caption}
              value={caption}
              onChange={e => { setCaption(e.target.value); onClearConflict?.(); }}
              rows={6}
              placeholder="Write your post caption..."
              disabled={loading}
            />
          </label>

          {/* ── Media picker ── */}
          <div className="upe-field" role="group" aria-labelledby={ids.media}>
            <div className="upe-field-label-row">
              <span className="upe-field-label" id={ids.media}>Media {selectedAssets.length > 0 ? `(${selectedAssets.length})` : ''}</span>
              {selectedAssets.length > 1 && (
                <span className="upe-field-meta">Multi-image Carousel Post</span>
              )}
            </div>
            <div className="upe-media-picker-row">
              {selectedAssets.length > 0 ? (
                <ul className="upe-media-strip">
                  {selectedAssets.map((item, idx) => (
                    <li key={`${item.id || item.url}-${idx}`} className="upe-media-thumb">
                      <img src={item.url} alt={`Media ${idx + 1}`} />
                      <span className="upe-media-thumb-num" aria-hidden="true">{idx + 1}</span>
                      <button
                        type="button"
                        className="upe-media-thumb-remove"
                        onClick={() => removeAssetAt(idx)}
                        title="Remove"
                        aria-label={`Remove media ${idx + 1}`}
                        disabled={loading}
                      >×</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="upe-media-empty-thumb" aria-hidden="true">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                className="upe-secondary-btn"
                onClick={() => setPickerOpen(p => !p)}
                aria-expanded={pickerOpen}
                disabled={loading}
              >
                {pickerOpen ? 'Done selecting' : selectedAssets.length > 0 ? 'Add / Manage images' : 'Choose from library'}
              </button>
            </div>

            {/* Inline folder + asset picker */}
            {pickerOpen && (
              <div className="upe-picker-panel">
                <div className="upe-picker-folders" aria-label="Folders">
                  {foldersState === 'loading' && <p className="upe-picker-empty" role="status">Loading…</p>}
                  {foldersState === 'error' && <p className="upe-picker-empty upe-picker-error" role="alert">Couldn’t load folders</p>}
                  {foldersState === 'ready' && folders.map(folder => (
                    <button
                      key={folder.id}
                      type="button"
                      className={`upe-picker-folder${selectedFolder?.id === folder.id ? ' upe-picker-folder-active' : ''}`}
                      onClick={() => loadPickerAssets(folder)}
                      aria-pressed={selectedFolder?.id === folder.id}
                    >
                      <span className="upe-picker-folder-name">{folder.name}</span>
                      <span className="upe-picker-folder-count">{folder.assetCount}</span>
                    </button>
                  ))}
                  {foldersState === 'ready' && folders.length === 0 && <p className="upe-picker-empty">No folders yet</p>}
                </div>

                <div className="upe-picker-assets">
                  {loadingAssets && <p className="upe-picker-empty" role="status">Loading...</p>}
                  {!loadingAssets && assetsError && <p className="upe-picker-empty upe-picker-error" role="alert">{assetsError}</p>}
                  {!loadingAssets && !assetsError && selectedFolder && assets.length === 0 && (
                    <p className="upe-picker-empty">No assets in this folder</p>
                  )}
                  {!loadingAssets && !selectedFolder && (
                    <p className="upe-picker-empty">Select a folder to browse assets</p>
                  )}
                  {!loadingAssets && assets.map(asset => {
                    const isSelected = selectedAssets.some(item => (item.id && item.id === asset.id) || (item.url && item.url === asset.fileUrl));
                    const selectedIndex = selectedAssets.findIndex(item => (item.id && item.id === asset.id) || (item.url && item.url === asset.fileUrl));
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        className={`upe-picker-asset${isSelected ? ' upe-picker-asset-selected' : ''}`}
                        onClick={() => toggleAsset(asset)}
                        title={asset.fileName}
                        aria-pressed={isSelected}
                        aria-label={asset.fileName}
                      >
                        <img src={asset.fileUrl} alt="" loading="lazy" />
                        {isSelected && (
                          <div className="upe-picker-asset-check" aria-hidden="true">
                            <span>{selectedIndex + 1}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className={initialDraft?.fromCaptionStudio ? 'upe-field-stack' : 'upe-grid-two'}>
            <div className="upe-field">
              <label className="upe-field-label" htmlFor={ids.hashtags}>Hashtags</label>
              <div className="upe-chip-input-shell">
                <div className="upe-chip-row">
                  {hashtags.map(tag => {
                    const display = tag.replace(/^#/, '');
                    return (
                      <button
                        key={tag}
                        type="button"
                        className="upe-chip"
                        onClick={() => { setHashtags(c => c.filter(i => i !== tag)); onClearConflict?.(); }}
                        aria-label={`Remove hashtag #${display}`}
                        disabled={loading}
                      >
                        #{display} <span className="upe-chip-x" aria-hidden="true">×</span>
                      </button>
                    );
                  })}
                  <input
                    id={ids.hashtags}
                    value={hashtagInput}
                    onChange={e => setHashtagInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && hashtagInput.trim()) {
                        e.preventDefault();
                        addHashtag(hashtagInput);
                      }
                    }}
                    placeholder="Type a hashtag and press Enter"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Hide tone selector when it was already chosen in Caption Studio */}
            {!initialDraft?.fromCaptionStudio && (
              <div className="upe-field">
                <label className="upe-field-label" htmlFor={ids.tone}>Tone</label>
                <select id={ids.tone} value={tone} onChange={e => { setTone(e.target.value); onClearConflict?.(); }} disabled={loading}>
                  <option value="FORMAL">Formal</option>
                  <option value="ENERGETIC">Energetic</option>
                  <option value="CELEBRATORY">Celebratory</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            )}
          </div>

          <div className="upe-field">
            <label className="upe-field-label" htmlFor={ids.schedule}>Scheduled time</label>
            <DateTimePickerPanel
              inputId={ids.schedule}
              value={scheduledAt}
              onChange={v => { setScheduledAt(v); onClearConflict?.(); }}
              suggestedValue={suggestedTime}
              invalid={Boolean(conflict)}
            />
            {conflict && <ConflictAlertBanner conflict={conflict} />}
          </div>

          {error && (
            <div className="upe-modal-error-banner" role="alert">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="upe-modal-footer">
          {confirmDiscard ? (
            <div className="upe-modal-discard">
              <span className="upe-modal-discard-text" role="alert">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Discard your unsaved changes?
              </span>
              <span className="upe-modal-discard-actions">
                <button type="button" className="upe-secondary-btn" onClick={() => setConfirmDiscard(false)} autoFocus>
                  Keep editing
                </button>
                <button type="button" className="upe-secondary-btn upe-danger-text-btn" onClick={onClose}>
                  Discard
                </button>
              </span>
            </div>
          ) : (
            <>
              {conflict && <span className="upe-modal-footer-note">Choose another time to continue</span>}
              <button type="button" className="upe-secondary-btn" onClick={requestClose} disabled={loading}>Cancel</button>
              <button
                type="button"
                className="upe-primary-btn"
                onClick={() => void submit()}
                disabled={Boolean(conflict) || loading}
                aria-busy={loading || undefined}
              >
                {loading && <span className="upe-btn-spinner" aria-hidden="true" />}
                {primaryLabel}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .upe-field-stack { display: grid; gap: 20px; }

        .upe-media-picker-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .upe-media-strip {
          list-style: none;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin: 0;
          padding: 0;
        }
        .upe-media-thumb-num {
          position: absolute;
          bottom: 4px;
          left: 4px;
          background: rgba(12, 68, 124, 0.88);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 6px;
          line-height: 1.3;
        }
        .upe-media-thumb {
          position: relative;
          width: 68px;
          height: 68px;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid #e2e8f0;
          flex-shrink: 0;
          background: #f1f5f9;
        }
        .upe-media-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .upe-media-thumb-remove {
          position: absolute;
          top: 4px; right: 4px;
          width: 22px; height: 22px;
          background: rgba(15,23,42,0.62);
          color: #fff;
          border: none;
          border-radius: 50%;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s;
        }
        .upe-media-thumb-remove:hover:not(:disabled) {
          background: rgba(15,23,42,0.85);
        }
        .upe-media-thumb-remove:focus-visible {
          outline: 2px solid #ffffff;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.6);
        }
        .upe-media-empty-thumb {
          width: 68px; height: 68px;
          border-radius: 12px;
          border: 2px dashed #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          flex-shrink: 0;
          background: #f8fafc;
        }
        .upe-picker-panel {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          display: flex;
          height: 280px;
          background: #ffffff;
          animation: fadeIn 0.2s ease-out;
        }
        .upe-picker-folders {
          width: 170px;
          flex-shrink: 0;
          border-right: 1px solid #e2e8f0;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: #f8fafc;
        }
        .upe-picker-folder {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          font-size: 12.5px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background-color 0.15s, border-color 0.15s, color 0.15s;
        }
        .upe-picker-folder-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .upe-picker-folder:hover { background: #ffffff; border-color: #e2e8f0; }
        .upe-picker-folder:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.35); }
        .upe-picker-folder-active {
          background: rgba(12,68,124,0.06) !important;
          border-color: rgba(12,68,124,0.15) !important;
          color: #0C447C !important;
          font-weight: 600 !important;
        }
        .upe-picker-folder-count {
          font-size: 10px;
          background: #e2e8f0;
          padding: 1px 6px;
          border-radius: 10px;
          color: #64748b;
          flex-shrink: 0;
        }
        .upe-picker-assets {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
          gap: 8px;
          align-content: start;
        }
        .upe-picker-asset {
          position: relative;
          aspect-ratio: 1;
          border-radius: 10px;
          overflow: hidden;
          border: 2px solid #e2e8f0;
          cursor: pointer;
          padding: 0;
          background: #f1f5f9;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .upe-picker-asset:hover { border-color: #3b82f6; }
        .upe-picker-asset:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.45); }
        .upe-picker-asset-selected { border-color: #0C447C !important; }
        .upe-picker-asset img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }
        .upe-picker-asset-check {
          position: absolute;
          inset: 0;
          background: rgba(12,68,124,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 18px;
          font-weight: 700;
        }
        .upe-picker-empty {
          grid-column: 1 / -1;
          font-size: 12px;
          color: #94a3b8;
          text-align: center;
          padding: 20px 0;
          margin: 0;
        }
        .upe-picker-error { color: #b91c1c; }

        @media (max-width: 640px) {
          .upe-picker-panel { flex-direction: column; height: auto; }
          .upe-picker-folders {
            width: auto;
            flex-direction: row;
            overflow-x: auto;
            border-right: none;
            border-bottom: 1px solid #e2e8f0;
          }
          .upe-picker-folder { width: auto; flex-shrink: 0; }
          .upe-picker-assets { max-height: 240px; grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); }
          .upe-media-picker-row > .upe-secondary-btn { flex: 1; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
