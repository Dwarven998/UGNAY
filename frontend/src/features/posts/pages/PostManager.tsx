import { useEffect, useState } from 'react';

import { ApiError } from '../../../api/axiosClient';
import type { Post, PostConflict } from '../../../types';
import { postApi, type PostUpsertPayload } from '../api/postApi';
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [conflict, setConflict] = useState<PostConflict | null>(null);
  const [loading, setLoading] = useState(false);
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

  const openCreate = (date?: Date) => {
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
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save post');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await postApi.delete(id);
    setPosts(current => current.filter(post => post.id !== id));
  };

  return (
    <div className="upe-page">
      <div className="upe-hero">
        <div>
          <div className="upe-section-kicker">Post Scheduler</div>
          <h1>Automated Facebook Publishing</h1>
          <p>Schedule posts, resolve time conflicts before saving, and let the backend publish them exactly at the chosen time.</p>
        </div>

        <button type="button" className="upe-primary-cta" onClick={() => openCreate()}>
          New Post
        </button>
      </div>

      {error && <div className="upe-error-banner">{error}</div>}

      <div className="upe-layout">
        <PostSchedulerCalendar posts={posts} onDateClick={openCreate} onEventClick={openEdit} />

        <div className="upe-sidebar-card">
          <div className="upe-section-kicker">Queue</div>
          <h3>Upcoming Posts</h3>
          <div className="upe-queue-list">
            {posts.slice(0, 6).map(post => (
              <article key={post.id} className="upe-queue-item">
                <div className={`upe-status-dot is-${post.status.toLowerCase()}`} />
                <div className="upe-queue-copy">
                  <strong>{post.caption}</strong>
                  <span>{post.status}</span>
                  {post.scheduledAt && <time>{new Date(post.scheduledAt).toLocaleString()}</time>}
                </div>
                <button type="button" onClick={() => openEdit(post)}>Edit</button>
                <button type="button" className="is-danger" onClick={() => handleDelete(post.id)}>Delete</button>
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

      {loading && <div className="upe-loading-hint">Saving post...</div>}

      <style>{`
        .upe-page {
          padding: 32px;
          background:
            radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%),
            radial-gradient(circle at top right, rgba(16,185,129,0.12), transparent 26%),
            linear-gradient(180deg, #0f172a 0%, #111827 100%);
          min-height: 100vh;
          color: #e5eefc;
        }

        .upe-hero {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-end;
          margin-bottom: 24px;
        }

        .upe-section-kicker {
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 0.72rem;
          color: #93c5fd;
          margin-bottom: 10px;
        }

        .upe-hero h1, .upe-calendar-header h3, .upe-sidebar-card h3, .upe-modal-header h2 {
          margin: 0;
        }

        .upe-hero p {
          max-width: 760px;
          color: #cbd5e1;
          line-height: 1.6;
        }

        .upe-primary-cta, .upe-primary-btn, .upe-secondary-btn, .upe-queue-item button, .upe-suggested-toggle {
          border: 0;
          border-radius: 999px;
          padding: 12px 18px;
          font-weight: 700;
          cursor: pointer;
        }

        .upe-primary-cta, .upe-primary-btn {
          background: linear-gradient(135deg, #38bdf8, #2563eb);
          color: white;
        }

        .upe-secondary-btn {
          background: rgba(148,163,184,0.14);
          color: #e2e8f0;
        }

        .upe-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.8fr) minmax(280px, 0.85fr);
          gap: 24px;
        }

        .upe-calendar-card, .upe-sidebar-card {
          background: rgba(15, 23, 42, 0.82);
          border: 1px solid rgba(148,163,184,0.16);
          border-radius: 28px;
          padding: 22px;
          box-shadow: 0 24px 48px rgba(2, 6, 23, 0.32);
        }

        .upe-calendar-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
        }

        .upe-calendar-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .upe-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #cbd5e1;
          font-size: 0.86rem;
        }

        .upe-legend-item i {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          display: inline-block;
        }

        .upe-error-banner, .upe-loading-hint {
          margin-bottom: 16px;
          border-radius: 16px;
          padding: 14px 16px;
          background: rgba(220,38,38,0.12);
          color: #fecaca;
          border: 1px solid rgba(248,113,113,0.24);
        }

        .upe-queue-list {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .upe-queue-item {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          background: rgba(30,41,59,0.72);
          border: 1px solid rgba(148,163,184,0.14);
          border-radius: 18px;
        }

        .upe-queue-item strong, .upe-queue-item span, .upe-queue-item time {
          display: block;
        }

        .upe-queue-item strong {
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .upe-queue-item span, .upe-queue-item time {
          color: #94a3b8;
          font-size: 0.82rem;
        }

        .upe-queue-item button.is-danger {
          color: #fecaca;
          background: rgba(220,38,38,0.16);
        }

        .upe-status-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
        }

        .upe-status-dot.is-scheduled { background: #3b82f6; }
        .upe-status-dot.is-draft { background: #94a3b8; }
        .upe-status-dot.is-published { background: #10b981; }
        .upe-status-dot.is-failed { background: #ef4444; }

        .upe-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.68);
          display: grid;
          place-items: center;
          padding: 24px;
          z-index: 30;
        }

        .upe-modal-card {
          width: min(920px, 100%);
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 28px;
          border: 1px solid rgba(148,163,184,0.18);
          box-shadow: 0 32px 70px rgba(15,23,42,0.5);
          padding: 24px;
        }

        .upe-modal-header, .upe-modal-footer {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
        }

        .upe-modal-close {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 0;
          background: rgba(148,163,184,0.18);
          color: #e2e8f0;
          font-size: 1.4rem;
          cursor: pointer;
        }

        .upe-modal-body {
          display: grid;
          gap: 16px;
          margin-top: 18px;
        }

        .upe-field {
          display: grid;
          gap: 8px;
        }

        .upe-field > span {
          font-weight: 700;
          color: #cbd5e1;
        }

        .upe-field input,
        .upe-field textarea,
        .upe-field select,
        .upe-datepicker {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(148,163,184,0.18);
          background: rgba(15,23,42,0.72);
          color: #e2e8f0;
          padding: 14px 16px;
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
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.18);
        }

        .upe-media-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .upe-chip-input-shell {
          min-height: 58px;
          border-radius: 16px;
          border: 1px solid rgba(148,163,184,0.18);
          background: rgba(15,23,42,0.72);
          padding: 10px;
        }

        .upe-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .upe-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 0;
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(59,130,246,0.14);
          color: #bfdbfe;
        }

        .upe-chip input {
          flex: 1;
          border: 0;
          background: transparent;
          padding: 8px 6px;
          min-width: 220px;
        }

        .upe-datetime-panel {
          display: grid;
          gap: 10px;
        }

        .upe-suggested-toggle {
          width: fit-content;
          background: rgba(16,185,129,0.16);
          color: #bbf7d0;
        }

        .upe-suggested-toggle.is-active {
          background: rgba(59,130,246,0.24);
          color: #dbeafe;
        }

        .upe-datetime-hint {
          color: #94a3b8;
          font-size: 0.82rem;
        }

        .upe-conflict-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 18px;
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.22);
          color: #fde68a;
          margin-top: 16px;
        }

        .upe-conflict-icon {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(245,158,11,0.2);
          font-weight: 800;
        }

        .upe-conflict-title {
          font-weight: 800;
          margin-bottom: 4px;
        }

        .upe-conflict-body {
          color: #fef3c7;
          line-height: 1.5;
        }

        .upe-calendar-event {
          display: grid;
          gap: 4px;
        }

        .upe-calendar-event-status {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.9;
        }

        .upe-calendar-event-title {
          font-size: 0.84rem;
          line-height: 1.3;
        }

        .upe-datepicker-wrapper {
          width: 100%;
        }

        .upe-flex-1 {
          flex: 1;
        }

        @media (max-width: 1100px) {
          .upe-layout {
            grid-template-columns: 1fr;
          }

          .upe-grid-two,
          .upe-media-preview-row {
            grid-template-columns: 1fr;
          }

          .upe-queue-item {
            grid-template-columns: auto minmax(0, 1fr);
          }
        }

        @media (max-width: 720px) {
          .upe-page {
            padding: 20px;
          }

          .upe-hero,
          .upe-calendar-header,
          .upe-modal-header,
          .upe-modal-footer {
            flex-direction: column;
            align-items: flex-start;
          }

          .upe-calendar-legend {
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}