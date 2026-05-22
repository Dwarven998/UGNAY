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

  const statusColor = (s: Post['status']) => ({
    DRAFT: 'bg-gray-100 text-gray-700',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    PUBLISHED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  }[s]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Post Manager</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium"
        >
          + New Post
        </button>
      </div>

      {/* Post create form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-lg">Create Post</h2>

          <textarea
            value={draft.caption}
            onChange={e => setDraft(d => ({ ...d, caption: e.target.value }))}
            placeholder="Caption..."
            rows={4}
            className="w-full border rounded-lg px-4 py-2 text-sm"
          />

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Hashtags (space-separated)</label>
              <input
                type="text"
                value={draft.hashtags.join(' ')}
                onChange={e => setDraft(d => ({ ...d, hashtags: e.target.value.split(' ').filter(Boolean) }))}
                className="w-full border rounded-lg px-4 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Schedule (optional)</label>
              <input
                type="datetime-local"
                value={draft.scheduledAt}
                onChange={e => setDraft(d => ({ ...d, scheduledAt: e.target.value }))}
                className="border rounded-lg px-4 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleCreate}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">
              Save Post
            </button>
            <button onClick={() => setShowForm(false)}
              className="border px-6 py-2 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Posts list */}
      <div className="space-y-3">
        {posts.map(post => (
          <div key={post.id}
            className="bg-white rounded-xl shadow p-5 flex gap-4">
            {post.mediaUrl && (
              <img src={post.mediaUrl} alt=""
                className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
            )}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(post.status)}`}>
                  {post.status}
                </span>
                {post.scheduledAt && (
                  <span className="text-xs text-gray-400">
                    📅 {new Date(post.scheduledAt).toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-sm line-clamp-2">{post.caption}</p>
              {post.hashtags?.length > 0 && (
                <p className="text-xs text-blue-600">{post.hashtags.join(' ')}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {post.status !== 'PUBLISHED' && (
                <button
                  onClick={() => handlePublishNow(post.id)}
                  className="text-xs bg-green-600 text-white px-3 py-1.5 rounded"
                >
                  Publish Now
                </button>
              )}
              <button
                onClick={() => handleDelete(post.id)}
                className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            No posts yet. Create your first post!
          </div>
        )}
      </div>
    </div>
  );
}