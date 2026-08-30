import type { Post } from '../../../types';

export interface PostPreviewModalProps {
  open: boolean;
  post: Post | null;
  currentUserId?: string;
  canModerate: boolean;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onRequestAppeal: (type: 'EDIT' | 'CANCEL') => void;
  onApproveAppeal: () => void;
  onRejectAppeal: () => void;
  onEditNow: () => void;
}

const APPEAL_LABEL: Record<'EDIT' | 'CANCEL', string> = {
  EDIT: 'edit',
  CANCEL: 'cancel',
};

export default function PostPreviewModal({
  open,
  post,
  currentUserId,
  canModerate,
  loading = false,
  error = '',
  onClose,
  onRequestAppeal,
  onApproveAppeal,
  onRejectAppeal,
  onEditNow,
}: PostPreviewModalProps) {
  if (!open || !post) return null;

  const isOwner = Boolean(currentUserId) && post.ownerId === currentUserId;
  const hasPendingAppeal = Boolean(post.appealType);

  return (
    <div className="upe-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="upe-modal-card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="upe-modal-header">
          <div>
            <div className="upe-modal-kicker">Post Scheduler</div>
            <h2>Scheduled Post</h2>
          </div>
          <button type="button" className="upe-modal-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="upe-modal-error-banner">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="upe-modal-body">
          {post.mediaUrl && (
            <div className="upe-preview-media">
              <img src={post.mediaUrl} alt="Post media" />
            </div>
          )}

          <div className="upe-field">
            <span>Caption</span>
            <p className="upe-preview-text">{post.caption}</p>
          </div>

          {post.hashtags.length > 0 && (
            <div className="upe-field">
              <span>Hashtags</span>
              <div className="upe-chip-row">
                {post.hashtags.map(tag => (
                  <span key={tag} className="upe-chip upe-chip-static">#{tag.replace(/^#/, '')}</span>
                ))}
              </div>
            </div>
          )}

          <div className="upe-grid-two">
            <div className="upe-field">
              <span>Tone</span>
              <p className="upe-preview-text">{post.tone}</p>
            </div>
            <div className="upe-field">
              <span>Scheduled time</span>
              <p className="upe-preview-text">
                {post.scheduledAt
                  ? new Date(post.scheduledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                  : '—'}
              </p>
            </div>
          </div>

          {/* ── Officer/admin: review a pending appeal ── */}
          {canModerate && hasPendingAppeal && (
            <div className="upe-appeal-banner">
              <div className="upe-appeal-icon">!</div>
              <div className="upe-appeal-body">
                <div className="upe-appeal-title">
                  Appeal pending: request to {APPEAL_LABEL[post.appealType as 'EDIT' | 'CANCEL']}
                </div>
                <p className="upe-appeal-text">
                  The member who created this post is asking to {APPEAL_LABEL[post.appealType as 'EDIT' | 'CANCEL']} it.
                  {post.appealType === 'CANCEL' && ' Approving will remove it from the calendar.'}
                </p>
                <div className="upe-appeal-actions">
                  <button type="button" className="upe-queue-btn upe-queue-btn-publish" onClick={onApproveAppeal} disabled={loading}>
                    {loading ? 'Working…' : 'Approve'}
                  </button>
                  <button type="button" className="upe-queue-btn upe-queue-btn-delete" onClick={onRejectAppeal} disabled={loading}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Member/owner: appeal to edit or cancel ── */}
          {!canModerate && isOwner && (
            <>
              {hasPendingAppeal ? (
                <div className="upe-appeal-banner upe-appeal-banner-pending">
                  <div className="upe-appeal-icon">…</div>
                  <div className="upe-appeal-body">
                    <div className="upe-appeal-title">
                      Your {APPEAL_LABEL[post.appealType as 'EDIT' | 'CANCEL']} request is awaiting officer/admin review
                    </div>
                    <p className="upe-appeal-text">You'll be able to act on this post once it's reviewed.</p>
                  </div>
                </div>
              ) : post.editUnlocked ? (
                <div className="upe-appeal-banner upe-appeal-banner-approved">
                  <div className="upe-appeal-icon">✓</div>
                  <div className="upe-appeal-body">
                    <div className="upe-appeal-title">Your edit request was approved</div>
                    <p className="upe-appeal-text">You can make one edit to this post now.</p>
                    <div className="upe-appeal-actions">
                      <button type="button" className="upe-primary-btn" onClick={onEditNow}>Edit Now</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="upe-field">
                  <span>This post is already scheduled</span>
                  <div className="upe-appeal-actions">
                    <button
                      type="button"
                      className="upe-secondary-btn"
                      onClick={() => onRequestAppeal('EDIT')}
                      disabled={loading}
                    >
                      {loading ? 'Working…' : 'Request to Edit'}
                    </button>
                    <button
                      type="button"
                      className="upe-secondary-btn upe-appeal-cancel-btn"
                      onClick={() => onRequestAppeal('CANCEL')}
                      disabled={loading}
                    >
                      Request to Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="upe-modal-footer">
          <button type="button" className="upe-secondary-btn" onClick={onClose}>Close</button>
        </div>
      </div>

      <style>{`
        .upe-preview-media {
          height: 220px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .upe-preview-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .upe-preview-text {
          margin: 0;
          font-size: 13px;
          color: #334155;
          line-height: 1.6;
          white-space: pre-wrap;
        }
        .upe-chip-static {
          cursor: default;
        }
        .upe-appeal-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 18px;
          border-radius: 14px;
          background: rgba(245,158,11,0.06);
          border: 1px solid rgba(245,158,11,0.2);
        }
        .upe-appeal-banner-pending {
          background: rgba(100,116,139,0.06);
          border-color: rgba(100,116,139,0.2);
        }
        .upe-appeal-banner-approved {
          background: rgba(16,185,129,0.06);
          border-color: rgba(16,185,129,0.2);
        }
        .upe-appeal-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: rgba(245,158,11,0.15);
          color: #b45309;
          font-weight: 800;
          font-size: 14px;
          flex-shrink: 0;
        }
        .upe-appeal-banner-pending .upe-appeal-icon {
          background: rgba(100,116,139,0.15);
          color: #475569;
        }
        .upe-appeal-banner-approved .upe-appeal-icon {
          background: rgba(16,185,129,0.15);
          color: #059669;
        }
        .upe-appeal-title {
          font-weight: 700;
          font-size: 13px;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .upe-appeal-text {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }
        .upe-appeal-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .upe-appeal-cancel-btn {
          color: #dc2626;
        }
      `}</style>
    </div>
  );
}
