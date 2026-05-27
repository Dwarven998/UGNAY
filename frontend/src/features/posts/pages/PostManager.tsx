import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/axiosClient';
import { useAuth } from '../../../context/AuthContext';
import type { Post, PostConflict } from '../../../types';
import { postApi, type PostUpsertPayload } from '../api/postApi';
import FacebookPageConnectButton from '../components/FacebookPageConnectButton';
import PostEditorModal, { type PostEditorDraft } from '../components/PostEditorModal';
import PostSchedulerCalendar from '../components/PostSchedulerCalendar';

type EditorState = {
  mode: 'create' | 'edit';
  post?: Post | null;
  draft?: Partial<PostEditorDraft> | null;
};

function parseCaptionDraftFromSession(): Partial<PostEditorDraft> | null {
  const saved = sessionStorage.getItem('caption_draft');
  if (!saved) {
    return null;
  }

  sessionStorage.removeItem('caption_draft');
  try {
    const data = JSON.parse(saved) as { caption?: string; hashtags?: string[]; tone?: string };
    return {
      caption: data.caption ?? '',
      hashtags: data.hashtags ?? [],
      tone: data.tone ?? 'FORMAL',
    };
  } catch {
    return null;
  }
}

function getDefaultDraft(date?: Date | null, initial?: Partial<PostEditorDraft> | null): Partial<PostEditorDraft> {
  return {
    caption: initial?.caption ?? '',
    hashtags: initial?.hashtags ?? [],
    tone: initial?.tone ?? 'FORMAL',
    mediaAssetId: initial?.mediaAssetId ?? '',
    scheduledAt: date ? date.toISOString() : initial?.scheduledAt,
  };
}

export default function PostManager() {
  const { user, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [conflict, setConflict] = useState<PostConflict | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadPosts = async () => {
    const data = await postApi.getAll();
    setPosts(data);
  };

  useEffect(() => {
    loadPosts();

    const initialDraft = parseCaptionDraftFromSession();
    if (initialDraft) {
      setEditor({ mode: 'create', draft: initialDraft });
    }
  }, []);

  useEffect(() => {
    const facebookState = searchParams.get('facebook');
    if (!facebookState) {
      return;
    }

    const message = searchParams.get('message');
    void refreshUserProfile();
    if (facebookState === 'failed') {
      setError(message || 'Facebook connection failed.');
    } else {
      setError('');
    }

    navigate('/posts', { replace: true });
  }, [navigate, refreshUserProfile, searchParams]);

  const openCreate = (date?: Date) => {
    if (!user?.facebookConnected) {
      setError('Connect your Facebook Page to enable post scheduling.');
      return;
    }
    setConflict(null);
    setError('');
    setEditor({ mode: 'create', draft: getDefaultDraft(date) });
  };

  const openEdit = (post: Post) => {
    setConflict(null);
    setError('');
    setEditor({
      mode: 'edit',
      post,
      draft: getDefaultDraft(post.scheduledAt ? new Date(post.scheduledAt) : null, {
        caption: post.caption,
        hashtags: post.hashtags,
        tone: post.tone,
      }),
    });
  };

  const closeEditor = () => {
    setEditor(null);
    setConflict(null);
    setError('');
  };

  const saveDraft = async (draft: PostEditorDraft) => {
    const payload: PostUpsertPayload = {
      caption: draft.caption,
      hashtags: draft.hashtags,
      tone: draft.tone,
      mediaAssetId: draft.mediaAssetId || undefined,
      scheduledAt: draft.scheduledAt || undefined,
    };

    try {
      setLoading(true);
      setError('');
      if (editor?.mode === 'edit' && editor.post) {
        await postApi.update(editor.post.id, payload);
      } else {
        await postApi.create(payload);
      }
      await loadPosts();
      closeEditor();
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 409) {
        setConflict(caughtError.data as PostConflict);
        return;
      }
      if (caughtError instanceof ApiError && caughtError.status === 428) {
        setError(caughtError.message);
        return;
      }
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save post');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await postApi.delete(id);
    setPosts(current => current.filter(post => post.id !== id));
  };

  const handlePublish = async (post: Post) => {
    try {
      setPublishingPostId(post.id);
      setError('');
      await postApi.publish(post.id);
      await loadPosts();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to publish post');
    } finally {
      setPublishingPostId(null);
    }
  };

  /* Filter upcoming posts: only show non-published posts in the queue sidebar */
  const upcomingPosts = posts.filter(p => p.status !== 'PUBLISHED').slice(0, 6);

  const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    DRAFT: { bg: 'rgba(148,163,184,0.12)', color: '#64748b', label: 'Draft' },
    SCHEDULED: { bg: 'rgba(59,130,246,0.10)', color: '#2563eb', label: 'Scheduled' },
    PUBLISHED: { bg: 'rgba(16,185,129,0.10)', color: '#059669', label: 'Published' },
    FAILED: { bg: 'rgba(239,68,68,0.10)', color: '#dc2626', label: 'Failed' },
  };

  return (
    <div className="upe-page">
      {/* ── Header ── */}
      <div className="upe-header" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
        <div>
          <div className="upe-breadcrumb">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Post Manager</span>
          </div>
          <h1 className="upe-title">Automated Facebook Publishing</h1>
          <p className="upe-subtitle">
            Schedule posts, resolve time conflicts before saving, and let the backend publish them exactly at the chosen time.
          </p>
          {!user?.facebookConnected && (
            <div className="upe-connection-notice">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Connect your Facebook Page to enable post scheduling.
            </div>
          )}
        </div>

        <div className="upe-header-actions">
          <FacebookPageConnectButton />
          <button
            type="button"
            className="upe-btn-primary"
            onClick={() => openCreate()}
            disabled={!user?.facebookConnected}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Post
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="upe-error-banner" style={{ animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="upe-layout">
        <PostSchedulerCalendar posts={posts} onDateClick={openCreate} onEventClick={openEdit} />

        {/* ── Upcoming Posts sidebar ── */}
        <div className="upe-sidebar-card" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s backwards' }}>
          <div className="upe-sidebar-header">
            <div className="upe-sidebar-header-left">
              <div className="upe-sidebar-icon">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="upe-sidebar-title">Upcoming Posts</h3>
            </div>
            <span className="upe-sidebar-count">{upcomingPosts.length}</span>
          </div>

          <div className="upe-queue-list">
            {upcomingPosts.length === 0 && (
              <div className="upe-queue-empty">
                <div className="upe-queue-empty-icon">
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="upe-queue-empty-title">No upcoming posts</p>
                <p className="upe-queue-empty-text">Create a post to get started</p>
              </div>
            )}

            {upcomingPosts.map((post, i) => (
              <article
                key={post.id}
                className="upe-queue-item"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="upe-queue-item-top">
                  <span
                    className="upe-status-badge"
                    style={{
                      background: STATUS_BADGE[post.status]?.bg,
                      color: STATUS_BADGE[post.status]?.color,
                    }}
                  >
                    <span className={`upe-status-dot is-${post.status.toLowerCase()}`} />
                    {STATUS_BADGE[post.status]?.label ?? post.status}
                  </span>
                  {post.scheduledAt && (
                    <time className="upe-queue-time">
                      {new Date(post.scheduledAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </time>
                  )}
                </div>
                <p className="upe-queue-caption">{post.caption}</p>
                <div className="upe-queue-actions">
                  <button
                    type="button"
                    className="upe-queue-btn upe-queue-btn-publish"
                    onClick={() => handlePublish(post)}
                    disabled={publishingPostId === post.id || post.status === 'PUBLISHED'}
                  >
                    {publishingPostId === post.id ? 'Publishing…' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    className="upe-queue-btn upe-queue-btn-edit"
                    onClick={() => openEdit(post)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="upe-queue-btn upe-queue-btn-delete"
                    onClick={() => handleDelete(post.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <PostEditorModal
        open={Boolean(editor)}
        initialPost={editor?.post ?? null}
        initialDraft={editor?.draft ?? null}
        conflict={conflict}
        onClose={closeEditor}
        onSubmit={saveDraft}
        onClearConflict={() => setConflict(null)}
      />

      {loading && (
        <div className="upe-loading-hint">
          <svg className="upe-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle className="upe-spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
            <path className="upe-spinner-fill" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Saving post…
        </div>
      )}

      <style>{`
        /* ── Page Container ── */
        .upe-page {
          padding: 36px 40px 48px;
          max-width: 1280px;
          margin: 0 auto;
        }

        /* ── Header ── */
        .upe-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
        }

        .upe-breadcrumb {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #0C447C;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 8px;
        }

        .upe-title {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.03em;
          margin: 0 0 6px;
        }

        .upe-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
          max-width: 560px;
          line-height: 1.5;
        }

        .upe-connection-notice {
          margin-top: 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          color: #b45309;
        }

        .upe-header-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
          flex-shrink: 0;
        }

        /* ── Buttons ── */
        .upe-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #0C447C;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 2px 8px rgba(12,68,124,0.2);
          font-family: inherit;
        }

        .upe-btn-primary:hover:not(:disabled) {
          background: #0a3867;
          box-shadow: 0 4px 14px rgba(12,68,124,0.25);
          transform: translateY(-1px);
        }

        .upe-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* ── Error Banner ── */
        .upe-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding: 14px 18px;
          background: #ffffff;
          border: 1px solid #fecaca;
          border-left: 4px solid #ef4444;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          color: #991b1b;
          box-shadow: 0 2px 8px rgba(239,68,68,0.06);
        }

        .upe-error-banner svg {
          color: #ef4444;
          flex-shrink: 0;
        }

        /* ── Loading Hint ── */
        .upe-loading-hint {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          color: #334155;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          z-index: 20;
          animation: fadeUp 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        .upe-spinner { animation: spin 0.8s linear infinite; }
        .upe-spinner-track { opacity: 0.2; }
        .upe-spinner-fill { opacity: 0.7; }

        /* ── 2-Column Layout ── */
        .upe-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.8fr) minmax(300px, 0.85fr);
          gap: 24px;
          align-items: start;
        }

        /* ── Calendar Card (base styles for the calendar wrapper) ── */
        .upe-calendar-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s;
          animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1);
        }

        .upe-calendar-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }

        /* ── Calendar Header ── */
        .upe-calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .upe-section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 11px;
          font-weight: 600;
          color: #0C447C;
          margin-bottom: 4px;
        }

        .upe-calendar-header h3 {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        /* ── Legend ── */
        .upe-calendar-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .upe-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
        }

        .upe-legend-item i {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          display: inline-block;
        }

        /* ── Calendar Event ── */
        .upe-calendar-event {
          display: grid;
          gap: 2px;
          padding: 2px 0;
        }

        .upe-calendar-event-status {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
          opacity: 0.9;
        }

        .upe-calendar-event-title {
          font-size: 11px;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Sidebar Card ── */
        .upe-sidebar-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s;
        }

        .upe-sidebar-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }

        .upe-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
          background: linear-gradient(135deg, rgba(12,68,124,0.03) 0%, rgba(59,130,246,0.02) 100%);
          border-bottom: 1px solid #f1f5f9;
        }

        .upe-sidebar-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .upe-sidebar-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #0C447C, #3b82f6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .upe-sidebar-title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .upe-sidebar-count {
          font-size: 12px;
          font-weight: 700;
          color: #0C447C;
          background: rgba(12,68,124,0.08);
          padding: 4px 10px;
          border-radius: 10px;
        }

        /* ── Queue List ── */
        .upe-queue-list {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 520px;
          overflow-y: auto;
        }

        /* ── Queue Empty State ── */
        .upe-queue-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 16px;
          text-align: center;
        }

        .upe-queue-empty-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, rgba(12,68,124,0.04), rgba(59,130,246,0.06));
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #cbd5e1;
          margin-bottom: 14px;
        }

        .upe-queue-empty-title {
          font-size: 14px;
          font-weight: 700;
          color: #334155;
          margin: 0 0 4px;
        }

        .upe-queue-empty-text {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }

        /* ── Queue Item (vertical card) ── */
        .upe-queue-item {
          padding: 14px 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) backwards;
        }

        .upe-queue-item:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .upe-queue-item-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }

        /* ── Status Badge ── */
        .upe-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .upe-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .upe-status-dot.is-scheduled { background: #3b82f6; }
        .upe-status-dot.is-draft { background: #94a3b8; }
        .upe-status-dot.is-published { background: #10b981; }
        .upe-status-dot.is-failed { background: #ef4444; }

        /* ── Queue Time ── */
        .upe-queue-time {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          white-space: nowrap;
        }

        /* ── Queue Caption ── */
        .upe-queue-caption {
          font-size: 13px;
          font-weight: 500;
          color: #334155;
          line-height: 1.5;
          margin: 0 0 12px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-word;
        }

        /* ── Queue Actions ── */
        .upe-queue-actions {
          display: flex;
          gap: 6px;
        }

        .upe-queue-btn {
          flex: 1;
          padding: 7px 0;
          border: none;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          text-align: center;
        }

        .upe-queue-btn-publish {
          background: rgba(12,68,124,0.08);
          color: #0C447C;
        }
        .upe-queue-btn-publish:hover:not(:disabled) {
          background: #0C447C;
          color: #fff;
        }
        .upe-queue-btn-publish:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .upe-queue-btn-edit {
          background: #f1f5f9;
          color: #475569;
        }
        .upe-queue-btn-edit:hover {
          background: #e2e8f0;
          color: #334155;
        }

        .upe-queue-btn-delete {
          background: rgba(239,68,68,0.06);
          color: #dc2626;
        }
        .upe-queue-btn-delete:hover {
          background: rgba(239,68,68,0.12);
          color: #b91c1c;
        }

        /* ── Facebook Connection Card ── */
        .upe-fb-connection-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          border-radius: 12px;
          padding: 12px 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .upe-fb-connection-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .upe-fb-connection-meta img {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .upe-fb-connection-avatar {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1877f2, #42a5f5);
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 12px;
          color: white;
          flex-shrink: 0;
        }

        .upe-fb-connection-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 2px;
        }

        .upe-fb-connection-card strong {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
        }

        .upe-fb-disconnect-btn {
          padding: 7px 14px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          white-space: nowrap;
        }

        .upe-fb-disconnect-btn:hover {
          background: #e2e8f0;
          color: #475569;
        }

        .upe-fb-connect-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: #1877f2;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          box-shadow: 0 2px 8px rgba(24,119,242,0.2);
        }

        .upe-fb-connect-btn:hover:not(:disabled) {
          background: #1565c0;
        }

        .upe-fb-connect-btn:disabled,
        .upe-fb-disconnect-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* ── Modal Styles (light theme) ── */
        .upe-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          padding: 24px;
          z-index: 30;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .upe-modal-card {
          width: min(920px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: #ffffff;
          color: #0f172a;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 24px 48px rgba(15,23,42,0.12), 0 8px 16px rgba(15,23,42,0.06);
          padding: 28px;
          animation: modalSlideUp 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .upe-modal-kicker {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
          color: #0C447C;
          margin-bottom: 4px;
        }

        .upe-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .upe-modal-header h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .upe-modal-close {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .upe-modal-close:hover {
          background: #e2e8f0;
          color: #334155;
        }

        .upe-modal-body {
          display: grid;
          gap: 18px;
          margin-top: 22px;
        }

        .upe-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
        }

        /* ── Form Fields ── */
        .upe-field {
          display: grid;
          gap: 6px;
        }

        .upe-field > span {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .upe-field input,
        .upe-field textarea,
        .upe-field select,
        .upe-datepicker {
          width: 100%;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          background: #f8fafc;
          color: #0f172a;
          padding: 12px 14px;
          font-size: 13px;
          font-family: inherit;
          transition: all 0.15s;
          outline: none;
        }

        .upe-field input:focus,
        .upe-field textarea:focus,
        .upe-field select:focus,
        .upe-datepicker:focus {
          border-color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }

        .upe-field textarea {
          resize: vertical;
          min-height: 100px;
          line-height: 1.6;
        }

        .upe-field input::placeholder,
        .upe-field textarea::placeholder {
          color: #94a3b8;
        }

        .upe-grid-two {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 16px;
        }

        .upe-media-preview-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 180px;
          gap: 16px;
          align-items: end;
        }

        .upe-media-preview {
          height: 120px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }

        .upe-media-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* ── Chip Input ── */
        .upe-chip-input-shell {
          min-height: 50px;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          background: #f8fafc;
          padding: 8px;
          transition: all 0.15s;
        }

        .upe-chip-input-shell:focus-within {
          border-color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }

        .upe-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .upe-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
          border-radius: 8px;
          padding: 5px 10px;
          background: rgba(12,68,124,0.08);
          color: #0C447C;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }

        .upe-chip:hover {
          background: rgba(12,68,124,0.14);
        }

        .upe-chip input {
          flex: 1;
          border: 0;
          background: transparent;
          padding: 5px 4px;
          min-width: 180px;
          font-size: 13px;
          color: #0f172a;
          font-family: inherit;
          outline: none;
        }

        .upe-chip input::placeholder {
          color: #94a3b8;
        }

        /* ── DateTime Panel ── */
        .upe-datetime-panel {
          display: grid;
          gap: 10px;
        }

        .upe-suggested-toggle {
          width: fit-content;
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }

        .upe-suggested-toggle:hover {
          background: #e2e8f0;
        }

        .upe-suggested-toggle.is-active {
          background: rgba(12,68,124,0.08);
          border-color: rgba(12,68,124,0.15);
          color: #0C447C;
        }

        .upe-datetime-hint {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 500;
        }

        .upe-datepicker-wrapper {
          width: 100%;
        }

        /* ── Conflict Banner ── */
        .upe-conflict-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 18px;
          border-radius: 14px;
          background: rgba(245,158,11,0.05);
          border: 1px solid rgba(245,158,11,0.18);
          margin-top: 18px;
        }

        .upe-conflict-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: rgba(245,158,11,0.12);
          color: #b45309;
          font-weight: 800;
          font-size: 14px;
          flex-shrink: 0;
        }

        .upe-conflict-title {
          font-weight: 700;
          font-size: 13px;
          color: #92400e;
          margin-bottom: 4px;
        }

        .upe-conflict-body {
          color: #a16207;
          font-size: 12px;
          line-height: 1.5;
        }

        /* ── Secondary Button ── */
        .upe-secondary-btn {
          padding: 8px 16px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }

        .upe-secondary-btn:hover {
          background: #e2e8f0;
          color: #334155;
        }

        /* ── Primary Button (modal) ── */
        .upe-primary-btn {
          padding: 10px 20px;
          background: #0C447C;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
          box-shadow: 0 2px 8px rgba(12,68,124,0.2);
        }

        .upe-primary-btn:hover:not(:disabled) {
          background: #0a3867;
        }

        .upe-primary-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Responsive ── */
        @media (max-width: 1100px) {
          .upe-layout {
            grid-template-columns: 1fr;
          }

          .upe-grid-two,
          .upe-media-preview-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .upe-page {
            padding: 24px 20px;
          }

          .upe-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .upe-header-actions {
            flex-direction: row;
            align-items: center;
            width: 100%;
          }

          .upe-calendar-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .upe-modal-card {
            padding: 20px;
          }

          .upe-modal-header,
          .upe-modal-footer {
            flex-direction: column;
            align-items: flex-start;
          }

          .upe-modal-footer {
            flex-direction: row;
          }
        }
      `}</style>
    </div>
  );
}