import { useEffect, useMemo, useState } from 'react';

import type { Post, PostConflict } from '../../../types';
import ConflictAlertBanner from './ConflictAlertBanner';
import DateTimePickerPanel from './DateTimePickerPanel';

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
  const [scheduledAt, setScheduledAt] = useState<Date | null>(suggestedTime);
  const [hashtagInput, setHashtagInput] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    const mergedHashtags = initialPost?.hashtags ?? initialDraft?.hashtags ?? [];
    setCaption(initialPost?.caption ?? initialDraft?.caption ?? '');
    setHashtags(mergedHashtags);
    setTone(initialPost?.tone ?? initialDraft?.tone ?? 'FORMAL');
    setMediaAssetId(initialDraft?.mediaAssetId ?? '');
    setScheduledAt(initialDraft?.scheduledAt ? new Date(initialDraft.scheduledAt) : initialPost?.scheduledAt ? new Date(initialPost.scheduledAt) : suggestedTime);
    setHashtagInput('');
  }, [initialDraft, initialPost, open, suggestedTime]);

  if (!open) {
    return null;
  }

  const addHashtag = (value: string) => {
    const cleaned = value.replace(/^#/, '').trim();
    if (!cleaned) {
      return;
    }

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

  const currentMediaUrl = initialPost?.mediaUrl ?? null;

  return (
    <div className="upe-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="upe-modal-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
        <div className="upe-modal-header">
          <div>
            <div className="upe-modal-kicker">Post Scheduler</div>
            <h2>{initialPost ? 'Edit Scheduled Post' : 'Create Post'}</h2>
          </div>
          <button type="button" className="upe-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {conflict && <ConflictAlertBanner conflict={conflict} />}

        <div className="upe-modal-body">
          <label className="upe-field">
            <span>Caption</span>
            <textarea
              value={caption}
              onChange={event => {
                setCaption(event.target.value);
                onClearConflict?.();
              }}
              rows={6}
              placeholder="Write your post caption..."
            />
          </label>

          <div className="upe-media-preview-row">
            <label className="upe-field upe-flex-1">
              <span>Media file reference</span>
              <input
                value={mediaAssetId}
                onChange={event => {
                  setMediaAssetId(event.target.value);
                  onClearConflict?.();
                }}
                placeholder="Media asset UUID"
              />
            </label>
            {currentMediaUrl && (
              <div className="upe-media-preview">
                <img src={currentMediaUrl} alt="Post media preview" />
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
                      onClick={() => {
                        setHashtags(current => current.filter(item => item !== tag));
                        onClearConflict?.();
                      }}
                    >
                      #{tag} <span>×</span>
                    </button>
                  ))}
                  <input
                    value={hashtagInput}
                    onChange={event => setHashtagInput(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
                        event.preventDefault();
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
              <select
                value={tone}
                onChange={event => {
                  setTone(event.target.value);
                  onClearConflict?.();
                }}
              >
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
              onChange={nextValue => {
                setScheduledAt(nextValue);
                onClearConflict?.();
              }}
              suggestedValue={suggestedTime}
            />
          </label>
        </div>

        <div className="upe-modal-footer">
          <button type="button" className="upe-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="upe-primary-btn" onClick={submit} disabled={Boolean(conflict)}>
            {initialPost ? 'Update Post' : 'Schedule Post'}
          </button>
        </div>
      </div>
    </div>
  );
}