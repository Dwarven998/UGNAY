// features/posts/pages/PostManager.tsx
import { useState, useEffect } from 'react';
import { postApi } from '../api/postApi.ts';
import type { Post } from '../../../types';

export default function PostManager() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    caption: '', hashtags: [] as string[], tone: 'FORMAL',
    scheduledAt: '', mediaAssetId: '',
  });

  const loadPosts = async () => {
    const data = await postApi.getAll();
    setPosts(data);
  };

  useEffect(() => {
    loadPosts();
    // Check if caption studio sent a draft
    const saved = sessionStorage.getItem('caption_draft');
    if (saved) {
      const data = JSON.parse(saved);
      queueMicrotask(() => setDraft(d => ({
        ...d,
        caption: data.caption,
        hashtags: data.hashtags || [],
        tone: data.tone,
      })));
      sessionStorage.removeItem('caption_draft');
      setShowForm(true);
    }
  }, []);

  const handleCreate = async () => {
    await postApi.create({
      ...draft,
      hashtags: draft.hashtags,
    });
    setShowForm(false);
    loadPosts();
  };

  const handleDelete = async (id: string) => {
    await postApi.delete(id);
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handlePublishNow = async (id: string) => {
    const updated = await postApi.publish(id);
    setPosts(prev => prev.map(p => p.id === id ? updated : p));
  };

  const statusConfig = (s: Post['status']) => ({
    DRAFT:     { dot: '#94a3b8', bg: 'rgba(148,163,184,0.08)', text: '#64748b', border: 'rgba(148,163,184,0.15)', label: 'Draft' },
    SCHEDULED: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)',  text: '#2563eb', border: 'rgba(59,130,246,0.15)',  label: 'Scheduled' },
    PUBLISHED: { dot: '#059669', bg: 'rgba(5,150,105,0.06)',   text: '#059669', border: 'rgba(5,150,105,0.15)',   label: 'Published' },
    FAILED:    { dot: '#dc2626', bg: 'rgba(220,38,38,0.06)',   text: '#dc2626', border: 'rgba(220,38,38,0.15)',   label: 'Failed' },
  }[s]);

  return (
    <>
      <div className="pm-container">
        {/* Header */}
        <div className="pm-header" style={{ animationDelay: '0s' }}>
          <div>
            <div className="pm-breadcrumb">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <span>Post Manager</span>
            </div>
            <h1 className="pm-title">Manage Posts</h1>
            <p className="pm-subtitle">Create, schedule, and publish your organization&apos;s content.</p>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="pm-btn-new">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Post
            </button>
          )}
        </div>

        {/* Post create form */}
        {showForm && (
          <div className="pm-form-card" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
            <div className="pm-form-header">
              <div className="pm-form-header-left">
                <div className="pm-form-header-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h2 className="pm-form-title">Compose Post</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="pm-form-close">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="pm-form-body">
              <div className="pm-field">
                <label className="pm-label">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Caption
                </label>
                <textarea
                  value={draft.caption}
                  onChange={e => setDraft(d => ({ ...d, caption: e.target.value }))}
                  placeholder="Write your post caption..."
                  rows={5}
                  className="pm-textarea"
                />
              </div>

              <div className="pm-fields-grid">
                <div className="pm-field">
                  <label className="pm-label">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    Hashtags
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. event update announcement"
                    value={draft.hashtags.join(' ')}
                    onChange={e => setDraft(d => ({ ...d, hashtags: e.target.value.split(' ').filter(Boolean) }))}
                    className="pm-input"
                  />
                  <p className="pm-hint">Separate tags with a space</p>
                </div>
                <div className="pm-field">
                  <label className="pm-label">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Schedule Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={draft.scheduledAt}
                    onChange={e => setDraft(d => ({ ...d, scheduledAt: e.target.value }))}
                    className="pm-input"
                  />
                </div>
              </div>

              <div className="pm-form-actions">
                <button onClick={() => setShowForm(false)} className="pm-btn-cancel">
                  Cancel
                </button>
                <button onClick={handleCreate} className="pm-btn-save">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Save Post
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Posts list */}
        <div className="pm-posts-list">
          {posts.map((post, i) => {
            const sc = statusConfig(post.status);
            return (
              <div key={post.id} className="pm-post-card" style={{ animationDelay: `${i * 0.06}s` }}>
                {/* Status bar on left */}
                <div className="pm-post-status-bar" style={{ background: sc.dot }}></div>

                <div className="pm-post-inner">
                  {post.mediaUrl && (
                    <div className="pm-post-media">
                      <img src={post.mediaUrl} alt="" />
                    </div>
                  )}
                  <div className="pm-post-content">
                    <div className="pm-post-meta">
                      <span className="pm-post-badge" style={{
                        background: sc.bg,
                        color: sc.text,
                        borderColor: sc.border,
                      }}>
                        <span className="pm-badge-dot" style={{ background: sc.dot }}></span>
                        {sc.label}
                      </span>
                      {post.scheduledAt && (
                        <span className="pm-post-date">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(post.scheduledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                    <p className="pm-post-caption">{post.caption}</p>
                    {post.hashtags?.length > 0 && (
                      <div className="pm-post-tags">
                        {post.hashtags.map((tag, idx) => (
                          <span key={idx} className="pm-tag">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="pm-post-actions">
                    {post.status !== 'PUBLISHED' && (
                      <button onClick={() => handlePublishNow(post.id)} className="pm-btn-publish">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                        </svg>
                        Publish
                      </button>
                    )}
                    <button onClick={() => handleDelete(post.id)} className="pm-btn-delete">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {posts.length === 0 && !showForm && (
            <div className="pm-empty">
              <div className="pm-empty-icon">
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="pm-empty-title">No posts planned yet</h3>
              <p className="pm-empty-text">Create your first post or send one from the Caption Studio.</p>
              <button onClick={() => setShowForm(true)} className="pm-btn-empty-cta">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create First Post
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .pm-container {
          padding: 36px 40px 48px;
          max-width: 960px;
          margin: 0 auto;
        }

        /* Header */
        .pm-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 32px;
          animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1);
        }
        .pm-breadcrumb {
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
        .pm-title {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.03em;
          margin: 0 0 6px;
          line-height: 1.2;
        }
        .pm-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
          font-weight: 400;
        }
        .pm-btn-new {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          background: #0C447C;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          box-shadow: 0 4px 14px rgba(12,68,124,0.2);
          font-family: inherit;
          flex-shrink: 0;
        }
        .pm-btn-new:hover {
          background: #0a3867;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(12,68,124,0.3);
        }

        /* Form card */
        .pm-form-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02);
          overflow: hidden;
          margin-bottom: 32px;
        }
        .pm-form-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 28px;
          background: linear-gradient(135deg, rgba(12,68,124,0.03) 0%, rgba(59,130,246,0.03) 100%);
          border-bottom: 1px solid #f1f5f9;
        }
        .pm-form-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pm-form-header-icon {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #0C447C, #3b82f6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .pm-form-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .pm-form-close {
          width: 32px; height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.15s;
        }
        .pm-form-close:hover { color: #0f172a; background: #f1f5f9; }
        .pm-form-body { padding: 28px; }
        .pm-field { margin-bottom: 20px; }
        .pm-label {
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
        .pm-textarea, .pm-input {
          width: 100%;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 14px;
          color: #0f172a;
          background: #ffffff;
          font-family: inherit;
          outline: none;
          transition: all 0.2s ease;
        }
        .pm-textarea { resize: vertical; min-height: 120px; line-height: 1.6; }
        .pm-input { height: 46px; }
        .pm-textarea:focus, .pm-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.1);
        }
        .pm-textarea::placeholder, .pm-input::placeholder { color: #94a3b8; }
        .pm-hint {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 6px;
        }
        .pm-fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .pm-form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
          margin-top: 8px;
        }
        .pm-btn-cancel {
          padding: 10px 20px;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .pm-btn-cancel:hover { background: #f1f5f9; color: #334155; }
        .pm-btn-save {
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
          box-shadow: 0 2px 8px rgba(12,68,124,0.2);
          font-family: inherit;
        }
        .pm-btn-save:hover { background: #0a3867; box-shadow: 0 4px 14px rgba(12,68,124,0.25); }

        /* Post cards */
        .pm-posts-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pm-post-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          display: flex;
          animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) backwards;
        }
        .pm-post-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 8px 24px rgba(0,0,0,0.06);
          transform: translateY(-1px);
        }
        .pm-post-status-bar {
          width: 4px;
          flex-shrink: 0;
          border-radius: 4px 0 0 4px;
        }
        .pm-post-inner {
          flex: 1;
          display: flex;
          gap: 20px;
          padding: 20px 24px;
          align-items: flex-start;
        }
        .pm-post-media {
          width: 80px; height: 80px;
          border-radius: 12px;
          overflow: hidden;
          flex-shrink: 0;
          border: 1px solid #f1f5f9;
        }
        .pm-post-media img {
          width: 100%; height: 100%;
          object-fit: cover;
        }
        .pm-post-content { flex: 1; min-width: 0; }
        .pm-post-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .pm-post-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .pm-badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .pm-post-date {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }
        .pm-post-caption {
          font-size: 14px;
          color: #334155;
          line-height: 1.65;
          margin: 0 0 10px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          white-space: pre-wrap;
        }
        .pm-post-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .pm-tag {
          font-size: 11px;
          font-weight: 600;
          color: #0C447C;
          background: rgba(12,68,124,0.06);
          padding: 3px 10px;
          border-radius: 6px;
        }
        .pm-post-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }
        .pm-btn-publish {
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
          white-space: nowrap;
        }
        .pm-btn-publish:hover { background: #047857; }
        .pm-btn-delete {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: transparent;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          white-space: nowrap;
        }
        .pm-btn-delete:hover {
          color: #dc2626;
          border-color: #fecaca;
          background: rgba(220,38,38,0.04);
        }

        /* Empty state */
        .pm-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 24px;
          background: #ffffff;
          border-radius: 20px;
          border: 2px dashed #e2e8f0;
          text-align: center;
          animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1);
        }
        .pm-empty-icon {
          width: 72px; height: 72px;
          background: linear-gradient(135deg, rgba(12,68,124,0.06), rgba(59,130,246,0.06));
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          margin-bottom: 20px;
        }
        .pm-empty-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px;
        }
        .pm-empty-text {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 24px;
          max-width: 320px;
        }
        .pm-btn-empty-cta {
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
          box-shadow: 0 2px 8px rgba(12,68,124,0.2);
          font-family: inherit;
        }
        .pm-btn-empty-cta:hover { background: #0a3867; }

        @media (max-width: 768px) {
          .pm-container { padding: 24px 20px; }
          .pm-header { flex-direction: column; gap: 16px; }
          .pm-fields-grid { grid-template-columns: 1fr; }
          .pm-post-inner { flex-direction: column; }
          .pm-post-actions { flex-direction: row; }
        }
      `}</style>
    </>
  );
}