import { useEffect, useMemo, useState } from 'react';

import type { Post, PostConflict, MediaAsset, MediaFolder } from '../../../types';
import ConflictAlertBanner from './ConflictAlertBanner';
import DateTimePickerPanel from './DateTimePickerPanel';
import { mediaApi } from '../../media/api/mediaApi';

export interface PostEditorDraft {
  caption: string;
  hashtags: string[];
  tone: string;
  mediaAssetId: string;
  scheduledAt: string;
}

export interface PostEditorModalProps {
  open: boolean;
  initialPost?: Post | null;
  initialDraft?: Partial<PostEditorDraft> | null;
  conflict?: PostConflict | null;
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

export default function PostEditorModal({
  open,
  initialPost,
  initialDraft,
  conflict,
  onClose,
  onSubmit,
  onClearConflict,
}: PostEditorModalProps) {
  const suggestedTime = useMemo(() => getDefaultSuggestedTime(), []);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tone, setTone] = useState('FORMAL');
  const [mediaAssetId, setMediaAssetId] = useState('');
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(suggestedTime);
  const [hashtagInput, setHashtagInput] = useState('');

  // Media picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  useEffect(() => {
    if (!open) return;
    const mergedHashtags = initialPost?.hashtags ?? initialDraft?.hashtags ?? [];
    setCaption(initialPost?.caption ?? initialDraft?.caption ?? '');
    setHashtags(mergedHashtags);
    setTone(initialPost?.tone ?? initialDraft?.tone ?? 'FORMAL');
    setMediaAssetId(initialDraft?.mediaAssetId ?? '');
    setMediaPreviewUrl(initialPost?.mediaUrl ?? null);
    setScheduledAt(
      initialDraft?.scheduledAt
        ? new Date(initialDraft.scheduledAt)
        : initialPost?.scheduledAt
          ? new Date(initialPost.scheduledAt)
          : suggestedTime
    );
    setHashtagInput('');
    setPickerOpen(false);
  }, [initialDraft, initialPost, open, suggestedTime]);

  // Load folders when picker opens
  useEffect(() => {
    if (!pickerOpen) return;
    mediaApi.getFolders().then(setFolders).catch(console.error);
  }, [pickerOpen]);

  // Load assets when a folder is selected in picker
  const loadPickerAssets = async (folder: MediaFolder) => {
    setSelectedFolder(folder);
    setLoadingAssets(true);
    try {
      const data = await mediaApi.getAssets(folder.id);
      setAssets(data);
    } finally {
      setLoadingAssets(false);
    }
  };

  const selectAsset = (asset: MediaAsset) => {
    setMediaAssetId(asset.id);         // ✅ send UUID to backend
    setMediaPreviewUrl(asset.fileUrl); // show preview
    setPickerOpen(false);
    onClearConflict?.();
  };

  if (!open) return null;

  const addHashtag = (value: string) => {
    const cleaned = value.replace(/^#/, '').trim();
    if (!cleaned) return;
    setHashtags(current => (current.includes(cleaned) ? current : [...current, cleaned]));
    setHashtagInput('');
    onClearConflict?.();
  };

  const submit = async () => {
    await onSubmit({
      caption,
      hashtags,
      tone,
      mediaAssetId,
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : '',
    });
  };

  return (
    <div className="upe-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="upe-modal-card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="upe-modal-header">
          <div>
            <div className="upe-modal-kicker">Post Scheduler</div>
            <h2>{initialPost ? 'Edit Scheduled Post' : 'Create Post'}</h2>
          </div>
          <button type="button" className="upe-modal-close" onClick={onClose}>×</button>
        </div>

        {conflict && <ConflictAlertBanner conflict={conflict} />}

        <div className="upe-modal-body">
          <label className="upe-field">
            <span>Caption</span>
            <textarea
              value={caption}
              onChange={e => { setCaption(e.target.value); onClearConflict?.(); }}
              rows={6}
              placeholder="Write your post caption..."
            />
          </label>

          {/* ── Media picker ── */}
          <div className="upe-field">
            <span>Media</span>
            <div className="upe-media-picker-row">
              {mediaPreviewUrl ? (
                <div className="upe-media-thumb">
                  <img src={mediaPreviewUrl} alt="Selected media" />
                  <button
                    type="button"
                    className="upe-media-thumb-remove"
                    onClick={() => { setMediaAssetId(''); setMediaPreviewUrl(null); }}
                    title="Remove"
                  >×</button>
                </div>
              ) : (
                <div className="upe-media-empty-thumb">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                className="upe-secondary-btn"
                onClick={() => setPickerOpen(p => !p)}
              >
                {pickerOpen ? 'Close picker' : mediaPreviewUrl ? 'Change image' : 'Choose from library'}
              </button>
            </div>

            {/* Inline folder + asset picker */}
            {pickerOpen && (
              <div className="upe-picker-panel">
                <div className="upe-picker-folders">
                  {folders.map(folder => (
                    <button
                      key={folder.id}
                      type="button"
                      className={`upe-picker-folder${selectedFolder?.id === folder.id ? ' upe-picker-folder-active' : ''}`}
                      onClick={() => loadPickerAssets(folder)}
                    >
                      {folder.name}
                      <span className="upe-picker-folder-count">{folder.assetCount}</span>
                    </button>
                  ))}
                  {folders.length === 0 && <p className="upe-picker-empty">No folders yet</p>}
                </div>

                <div className="upe-picker-assets">
                  {loadingAssets && <p className="upe-picker-empty">Loading...</p>}
                  {!loadingAssets && selectedFolder && assets.length === 0 && (
                    <p className="upe-picker-empty">No assets in this folder</p>
                  )}
                  {!loadingAssets && !selectedFolder && (
                    <p className="upe-picker-empty">Select a folder to browse assets</p>
                  )}
                  {assets.map(asset => (
                    <button
                      key={asset.id}
                      type="button"
                      className={`upe-picker-asset${mediaAssetId === asset.id ? ' upe-picker-asset-selected' : ''}`}
                      onClick={() => selectAsset(asset)}
                      title={asset.fileName}
                    >
                      <img src={asset.fileUrl} alt={asset.fileName} />
                      {mediaAssetId === asset.id && (
                        <div className="upe-picker-asset-check">✓</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="upe-grid-two">
            <label className="upe-field">
              <span>Hashtags</span>
              <div className="upe-chip-input-shell">
                <div className="upe-chip-row">
                  {hashtags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className="upe-chip"
                      onClick={() => { setHashtags(c => c.filter(i => i !== tag)); onClearConflict?.(); }}
                    >
                      #{tag} <span>×</span>
                    </button>
                  ))}
                  <input
                    value={hashtagInput}
                    onChange={e => setHashtagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
                        e.preventDefault();
                        addHashtag(hashtagInput);
                      }
                    }}
                    placeholder="Type a hashtag and press Enter"
                  />
                </div>
              </div>
            </label>

            <label className="upe-field">
              <span>Tone</span>
              <select value={tone} onChange={e => { setTone(e.target.value); onClearConflict?.(); }}>
                <option value="FORMAL">Formal</option>
                <option value="ENERGETIC">Energetic</option>
                <option value="CELEBRATORY">Celebratory</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
          </div>

          <label className="upe-field">
            <span>Scheduled time</span>
            <DateTimePickerPanel
              value={scheduledAt}
              onChange={v => { setScheduledAt(v); onClearConflict?.(); }}
              suggestedValue={suggestedTime}
            />
          </label>
        </div>

        <div className="upe-modal-footer">
          <button type="button" className="upe-secondary-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="upe-primary-btn" onClick={submit} disabled={Boolean(conflict)}>
            {initialPost ? 'Update Post' : 'Schedule Post'}
          </button>
        </div>
      </div>

      <style>{`
        .upe-media-picker-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 6px;
        }
        .upe-media-thumb {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 10px;
          overflow: hidden;
          border: 2px solid #e2e8f0;
          flex-shrink: 0;
        }
        .upe-media-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .upe-media-thumb-remove {
          position: absolute;
          top: 3px; right: 3px;
          width: 18px; height: 18px;
          background: rgba(0,0,0,0.55);
          color: #fff;
          border: none;
          border-radius: 50%;
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .upe-media-thumb-remove:hover {
          background: rgba(0,0,0,0.75);
        }
        .upe-media-empty-thumb {
          width: 64px; height: 64px;
          border-radius: 10px;
          border: 2px dashed #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          flex-shrink: 0;
          background: #f8fafc;
        }
        .upe-picker-panel {
          margin-top: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          display: flex;
          max-height: 280px;
          background: #ffffff;
        }
        .upe-picker-folders {
          width: 150px;
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
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          font-size: 12px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: all 0.15s;
        }
        .upe-picker-folder:hover { background: #ffffff; border-color: #e2e8f0; }
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
        }
        .upe-picker-assets {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
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
          transition: all 0.15s;
        }
        .upe-picker-asset:hover { border-color: #3b82f6; }
        .upe-picker-asset-selected { border-color: #0C447C !important; }
        .upe-picker-asset img {
          width: 100%; height: 100%;
          object-fit: cover;
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
      `}</style>
    </div>
  );
}