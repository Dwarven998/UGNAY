import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/axiosClient';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useAuth } from '../../../context/useAuth';
import { useOrganization } from '../../../context/useOrganization';
import type { Post, PostConflict } from '../../../types';
import { SETUP_FACEBOOK_RETURN_KEY } from '../../setup/setupStatus';
import { postApi, type PostUpsertPayload } from '../api/postApi';
import { prefillFromPost } from '../composerHandoff';
import FacebookPageConnectButton from '../components/FacebookPageConnectButton';
import { useFacebookConnection } from '../hooks/useFacebookConnection';
import PostEditorModal, { type PostEditorDraft } from '../components/PostEditorModal';
import PostPreviewModal from '../components/PostPreviewModal';
import PostSchedulerCalendar from '../components/PostSchedulerCalendar';
import PostThumb from '../components/PostThumb';
import { postCache, postThumbnail } from '../postCache';
import '../../../components/ui/dialog.css';
import '../posts.css';
import './postList.css';

type EditorState = {
  mode: 'create' | 'edit';
  post?: Post | null;
  draft?: Partial<PostEditorDraft> | null;
};

type StatusFilter = 'ALL' | Post['status'];
type SortOrder = 'soonest' | 'latest';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'PENDING_REVIEW', label: 'Pending' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'REJECTED', label: 'Rejected' },
];
const isStatusFilter = (value: string | null): value is StatusFilter =>
  STATUS_TABS.some(tab => tab.key === value);

function getDefaultDraft(date?: Date | null, initial?: Partial<PostEditorDraft> | null): Partial<PostEditorDraft> {
  return {
    caption: initial?.caption ?? '',
    hashtags: initial?.hashtags ?? [],
    tone: initial?.tone ?? 'FORMAL',
    mediaAssetId: initial?.mediaAssetId ?? '',
    mediaAssetIds: initial?.mediaAssetIds ?? [],
    scheduledAt: date ? date.toISOString() : initial?.scheduledAt,
    mediaPreviewUrl: initial?.mediaPreviewUrl,
    mediaPreviewUrls: initial?.mediaPreviewUrls ?? [],
    fromCaptionStudio: initial?.fromCaptionStudio,
  };
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

function dayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return 'Today';
  if (dayKey(date) === dayKey(tomorrow)) return 'Tomorrow';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

interface ScopedPosts { scopeKey: string; items: Post[] }
const NO_POSTS: Post[] = [];

type PendingAction = { kind: 'delete' | 'publish'; post: Post } | null;

export default function PostManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: 'list' | 'calendar' = location.pathname.startsWith('/calendar') ? 'calendar' : 'list';
  const { user } = useAuth();
  const { activeOrgId, activeOrg } = useOrganization();
  const {
    connected: facebookConnected,
    pageName,
    refresh: refreshFacebookConnection,
    resolved: facebookResolved,
    scopeKey,
  } = useFacebookConnection();
  /* Every list is tagged with the workspace + Facebook Page it was loaded for and only shown while that
     Page is still the connected one, so switching or disconnecting a Page instantly empties the calendar
     instead of leaving the previous Page's posts on screen until the next fetch lands. */
  const [postsState, setPostsState] = useState<ScopedPosts>({ scopeKey: '', items: [] });
  const [pendingState, setPendingState] = useState<ScopedPosts>({ scopeKey: '', items: [] });
  const [picturesState, setPicturesState] = useState<{ scopeKey: string; items: Record<string, string> }>({ scopeKey: '', items: {} });
  // The last list seen for this Page is shown right away while the fresh one loads.
  const cachedPosts = useMemo(() => (facebookResolved ? postCache.getPosts(scopeKey) : null), [facebookResolved, scopeKey]);
  const cachedPictures = useMemo(() => (facebookResolved ? postCache.getPictures(scopeKey) : null), [facebookResolved, scopeKey]);
  const posts = postsState.scopeKey === scopeKey ? postsState.items : (cachedPosts ?? NO_POSTS);
  const pendingPosts = pendingState.scopeKey === scopeKey ? pendingState.items : NO_POSTS;
  const pictures = picturesState.scopeKey === scopeKey ? picturesState.items : cachedPictures;
  const postsLoaded = postsState.scopeKey === scopeKey || cachedPosts !== null;
  const scopeKeyRef = useRef(scopeKey);
  useEffect(() => { scopeKeyRef.current = scopeKey; }, [scopeKey]);
  const setPosts = useCallback((update: Post[] | ((current: Post[]) => Post[])) => {
    setPostsState(prev => {
      const base = prev.scopeKey === scopeKey ? prev.items : (postCache.getPosts(scopeKey) ?? NO_POSTS);
      return { scopeKey, items: typeof update === 'function' ? update(base) : update };
    });
  }, [scopeKey]);
  // Every change to the list (load, create, delete, publish) refreshes the cached copy.
  useEffect(() => {
    if (postsState.scopeKey) postCache.setPosts(postsState.scopeKey, postsState.items);
  }, [postsState]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [conflict, setConflict] = useState<PostConflict | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [moderatingPostId, setModeratingPostId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editorError, setEditorError] = useState('');
  const [info, setInfo] = useState('');
  const [loadError, setLoadError] = useState('');
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealError, setAppealError] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const statusParam = searchParams.get('status');
  const statusFilter: StatusFilter = isStatusFilter(statusParam) ? statusParam : 'ALL';
  const highlightId = searchParams.get('highlight');
  const [search, setSearch] = useState('');
  const [sortOverride, setSortOverride] = useState<SortOrder | null>(null);
  const sortOrder: SortOrder = sortOverride
    ?? (statusFilter === 'SCHEDULED' || statusFilter === 'PENDING_REVIEW' ? 'soonest' : 'latest');

  // Anything opened for a post of the previous Page must not stay open once the Page changes
  // (adjusted during render, so the old Page's post is never painted for the new one).
  const [openedForScope, setOpenedForScope] = useState(scopeKey);
  if (openedForScope !== scopeKey) {
    setOpenedForScope(scopeKey);
    setPreviewPost(null);
    setPendingAction(null);
    setEditor(current => (current?.mode === 'edit' ? null : current));
  }

  const canModerate = activeOrg?.role === 'ADMIN' || activeOrg?.role === 'OFFICER';
  // Personal workspace: the user manages their own connection. Inside an org: officer/admin only.
  const canManageFacebook = !activeOrgId || canModerate;
  // Personal workspace: the user manages their own posts directly. Inside an org: officer/admin
  // only — members' posts go through the approval queue above instead of direct publish/edit/delete.
  const canManagePosts = !activeOrgId || canModerate;

  const loadPosts = useCallback(async () => {
    if (!facebookResolved) return;
    const requestedScope = scopeKey;
    try {
      const data = await postApi.getAll(activeOrgId);
      // A slow response for a Page that has since been switched away from must not land on the new Page.
      if (scopeKeyRef.current === requestedScope) {
        setPostsState({ scopeKey: requestedScope, items: data });
        setLoadError('');
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      if (scopeKeyRef.current === requestedScope) {
        setLoadError(err instanceof Error && err.message ? err.message : 'Posts could not be loaded.');
      }
    }
  }, [activeOrgId, facebookResolved, scopeKey]);

  const loadPendingPosts = useCallback(async () => {
    if (!facebookResolved) return;
    const requestedScope = scopeKey;
    if (!activeOrgId || !canModerate) {
      setPendingState({ scopeKey: requestedScope, items: NO_POSTS });
      return;
    }
    try {
      const data = await postApi.getModerationQueue(activeOrgId);
      if (scopeKeyRef.current === requestedScope) setPendingState({ scopeKey: requestedScope, items: data });
    } catch (err) {
      console.error('Failed to fetch moderation queue:', err);
    }
  }, [activeOrgId, canModerate, facebookResolved, scopeKey]);

  useEffect(() => {
    loadPosts();
    loadPendingPosts();

    // Auto-refresh post lists every 15 seconds so scheduled posts transition to published smoothly
    const intervalId = setInterval(() => {
      loadPosts();
      loadPendingPosts();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [loadPosts, loadPendingPosts]);

  /* Published posts no longer keep their uploaded files, so their picture is looked up on Facebook. Only
     refetched when the set of such posts changes, not on every 15-second refresh. */
  const pictureTargets = useMemo(
    () => posts
      .filter(post => post.status === 'PUBLISHED' && !post.mediaUrl && !(post.mediaUrls && post.mediaUrls.length > 0))
      .map(post => post.id)
      .join(','),
    [posts],
  );
  useEffect(() => {
    if (!facebookResolved || !facebookConnected || !pictureTargets) return;
    let current = true;
    const requestedScope = scopeKey;
    postApi.getPublishedPictures(activeOrgId).then(
      items => {
        if (!current || scopeKeyRef.current !== requestedScope) return;
        setPicturesState({ scopeKey: requestedScope, items });
        postCache.setPictures(requestedScope, items);
      },
      err => console.error('Failed to load published post pictures:', err),
    );
    return () => { current = false; };
  }, [activeOrgId, facebookConnected, facebookResolved, pictureTargets, scopeKey]);

  // Facebook OAuth always returns to /posts?facebook=…; hand it back to first-time setup if that started it.
  useEffect(() => {
    const facebookState = searchParams.get('facebook');
    if (!facebookState) {
      return;
    }

    const message = searchParams.get('message');
    let returnToSetup = false;
    try {
      returnToSetup = sessionStorage.getItem(SETUP_FACEBOOK_RETURN_KEY) === '1';
      sessionStorage.removeItem(SETUP_FACEBOOK_RETURN_KEY);
    } catch {
      // ignore
    }
    if (returnToSetup) {
      const query = new URLSearchParams({ facebook: facebookState });
      if (message) query.set('message', message);
      navigate(`/setup?${query.toString()}`, { replace: true });
      return;
    }

    void refreshFacebookConnection();
    if (facebookState === 'failed') {
      setError(message || 'Facebook connection failed.');
    } else {
      setError('');
      setInfo('Facebook Page connected. You can now publish and schedule posts.');
    }

    navigate('/posts', { replace: true });
  }, [navigate, refreshFacebookConnection, searchParams]);

  // Arriving from the composer ("View Post"): bring that post into view and mark it briefly.
  useEffect(() => {
    if (!highlightId || !postsLoaded || view !== 'list') return;
    const el = document.getElementById(`post-${highlightId}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightId, postsLoaded, view]);

  const setStatusFilter = (next: StatusFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'ALL') params.delete('status');
    else params.set('status', next);
    params.delete('highlight');
    setSearchParams(params, { replace: true });
    setSortOverride(null);
  };

  /** The composer is the one place posts are created; a calendar day pre-fills its schedule. */
  const openCreate = (date?: Date) => {
    if (!date) {
      navigate('/create');
      return;
    }
    const when = new Date(date);
    // Month cells report midnight — use the evening slot the composer suggests by default.
    if (when.getHours() === 0 && when.getMinutes() === 0) when.setHours(19, 0, 0, 0);
    navigate(when.getTime() > Date.now() ? `/create?date=${encodeURIComponent(when.toISOString())}` : '/create');
  };

  const duplicatePost = (post: Post) => {
    prefillFromPost(post);
    navigate('/create');
  };

  const openEdit = (post: Post) => {
    setConflict(null);
    setEditorError('');
    const postUrls = post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : (post.mediaUrl ? [post.mediaUrl] : []);
    setEditor({
      mode: 'edit',
      post,
      draft: getDefaultDraft(post.scheduledAt ? new Date(post.scheduledAt) : null, {
        caption: post.caption,
        hashtags: post.hashtags,
        tone: post.tone,
        mediaAssetId: post.mediaAssetIds?.[0],
        mediaAssetIds: post.mediaAssetIds ?? [],
        mediaPreviewUrl: postUrls[0],
        mediaPreviewUrls: postUrls,
      }),
    });
  };

  const closeEditor = () => {
    setEditor(null);
    setConflict(null);
    setEditorError('');
  };

  /* A SCHEDULED org post is locked from direct editing — clicking it opens a read-only preview
     with appeal (member) or appeal-review (officer/admin) actions instead of the editor. Any other
     post (drafts, personal-workspace posts, etc.) keeps the previous direct-edit behavior. */
  const handleEventClick = (post: Post) => {
    if (post.orgId && post.status === 'SCHEDULED') {
      setAppealError('');
      setPreviewPost(post);
      return;
    }
    openEdit(post);
  };

  const closePreview = () => {
    setPreviewPost(null);
    setAppealError('');
  };

  const submitAppeal = async (type: 'EDIT' | 'CANCEL') => {
    if (!previewPost) return;
    try {
      setAppealBusy(true);
      setAppealError('');
      const updated = await postApi.requestAppeal(previewPost.id, type);
      setPreviewPost(updated);
      await loadPosts();
    } catch (caughtError) {
      setAppealError(caughtError instanceof Error ? caughtError.message : 'Unable to submit appeal');
    } finally {
      setAppealBusy(false);
    }
  };

  const resolveAppeal = async (approve: boolean) => {
    if (!previewPost) return;
    try {
      setAppealBusy(true);
      setAppealError('');
      await (approve ? postApi.approveAppeal(previewPost.id) : postApi.rejectAppeal(previewPost.id));
      closePreview();
      await Promise.all([loadPosts(), loadPendingPosts()]);
    } catch (caughtError) {
      setAppealError(caughtError instanceof Error ? caughtError.message : 'Unable to resolve appeal');
    } finally {
      setAppealBusy(false);
    }
  };

  const editNowFromPreview = () => {
    if (!previewPost) return;
    const post = previewPost;
    setPreviewPost(null);
    openEdit(post);
  };

  const saveDraft = async (draft: PostEditorDraft) => {
    const payload: PostUpsertPayload = {
      caption: draft.caption,
      hashtags: draft.hashtags,
      tone: draft.tone,
      mediaAssetId: draft.mediaAssetId || undefined,
      mediaAssetIds: draft.mediaAssetIds && draft.mediaAssetIds.length > 0 ? draft.mediaAssetIds : undefined,
      scheduledAt: draft.scheduledAt || undefined,
    };

    try {
      setLoading(true);
      setEditorError('');
      setInfo('');
      const saved = editor?.mode === 'edit' && editor.post
        ? await postApi.update(editor.post.id, payload, activeOrgId)
        : await postApi.create(payload, activeOrgId);
      setInfo(saved.status === 'PENDING_REVIEW'
        ? 'Submitted for officer/admin approval before it can be scheduled.'
        : 'Post updated.');
      await loadPosts();
      closeEditor();
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 409) {
        setConflict(caughtError.data as PostConflict);
        return;
      }
      setEditorError(caughtError instanceof Error ? caughtError.message : 'Unable to save post');
    } finally {
      setLoading(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction || actionBusy) return;
    const { kind, post } = pendingAction;
    setActionBusy(true);
    setActionError('');
    try {
      if (kind === 'delete') {
        await postApi.delete(post.id);
        setPosts(current => current.filter(item => item.id !== post.id));
        setInfo('Post deleted.');
      } else {
        setPublishingPostId(post.id);
        const published = await postApi.publish(post.id);
        setPosts(current => current.map(item => (item.id === post.id ? published : item)));
        if (published.status === 'PUBLISHED') {
          setInfo(`Published to ${pageName ?? 'Facebook'}.`);
          setError('');
        } else {
          setError('Facebook did not accept the post. It is marked Failed — check the Page connection and try again.');
        }
        void loadPosts();
      }
      setPendingAction(null);
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : `Unable to ${kind} post`);
    } finally {
      setActionBusy(false);
      setPublishingPostId(null);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setModeratingPostId(id);
      await postApi.approve(id);
      await Promise.all([loadPosts(), loadPendingPosts()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to approve post');
    } finally {
      setModeratingPostId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setModeratingPostId(id);
      await postApi.reject(id);
      await Promise.all([loadPosts(), loadPendingPosts()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to reject post');
    } finally {
      setModeratingPostId(null);
    }
  };

  const isOwner = (post: Post) => Boolean(user?.userId) && post.ownerId === user?.userId;
  const canEditPost = (post: Post) => post.status !== 'PUBLISHED' && (canManagePosts || isOwner(post));
  const canPublishPost = (post: Post) =>
    canManagePosts && isOwner(post) && (post.status === 'DRAFT' || post.status === 'SCHEDULED' || post.status === 'FAILED');
  const canDeletePost = (post: Post) =>
    post.status !== 'PUBLISHED' && (canManagePosts || (isOwner(post) && !(post.orgId && post.status === 'SCHEDULED')));

  /* Filter upcoming posts: only show non-published posts in the queue sidebar */
  const upcomingPosts = posts.filter(p => p.status !== 'PUBLISHED').slice(0, 6);

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: posts.length };
    for (const post of posts) result[post.status] = (result[post.status] ?? 0) + 1;
    return result;
  }, [posts]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = posts.filter(post => {
      if (statusFilter !== 'ALL' && post.status !== statusFilter) return false;
      if (!term) return true;
      return post.caption.toLowerCase().includes(term)
        || post.hashtags.some(tag => tag.toLowerCase().includes(term));
    });
    const time = (post: Post) => (post.scheduledAt ? new Date(post.scheduledAt).getTime() : null);
    filtered.sort((a, b) => {
      const ta = time(a);
      const tb = time(b);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return sortOrder === 'soonest' ? ta - tb : tb - ta;
    });
    const result: { key: string; label: string; items: Post[] }[] = [];
    for (const post of filtered) {
      const date = post.scheduledAt ? new Date(post.scheduledAt) : null;
      const key = date ? dayKey(date) : 'none';
      const label = date ? dayLabel(date) : 'No date set';
      const last = result[result.length - 1];
      if (last && last.key === key) last.items.push(post);
      else result.push({ key, label, items: [post] });
    }
    return { total: filtered.length, groups: result };
  }, [posts, search, sortOrder, statusFilter]);

  const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    DRAFT: { bg: 'rgba(148,163,184,0.12)', color: '#64748b', label: 'Draft' },
    SCHEDULED: { bg: 'rgba(59,130,246,0.10)', color: '#2563eb', label: 'Scheduled' },
    PUBLISHED: { bg: 'rgba(16,185,129,0.10)', color: '#059669', label: 'Published' },
    FAILED: { bg: 'rgba(239,68,68,0.10)', color: '#dc2626', label: 'Failed' },
    PENDING_REVIEW: { bg: 'rgba(245,158,11,0.10)', color: '#b45309', label: 'Pending Review' },
    REJECTED: { bg: 'rgba(239,68,68,0.10)', color: '#dc2626', label: 'Rejected' },
  };

  const pendingApprovalCard = canModerate && (
    <div className="upe-sidebar-card" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s backwards' }}>
      <div className="upe-sidebar-header">
        <div className="upe-sidebar-header-left">
          <div className="upe-sidebar-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="upe-sidebar-title">Pending Approval</h2>
        </div>
        <span className="upe-sidebar-count">{pendingPosts.length}</span>
      </div>

      <div className="upe-queue-list">
        {pendingPosts.length === 0 && (
          <div className="upe-queue-empty">
            <p className="upe-queue-empty-title">Nothing to review</p>
            <p className="upe-queue-empty-text">Posts from members awaiting approval will show up here</p>
          </div>
        )}
        {pendingPosts.map((post, i) => (
          <article key={post.id} className="upe-queue-item" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="upe-queue-caption">{post.caption}</p>
            {post.scheduledAt && (
              <time className="upe-queue-time" dateTime={post.scheduledAt}>
                {new Date(post.scheduledAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </time>
            )}
            <div className="upe-queue-actions">
              <button
                type="button"
                className="upe-queue-btn upe-queue-btn-publish"
                onClick={() => handleApprove(post.id)}
                disabled={moderatingPostId === post.id}
              >
                {moderatingPostId === post.id ? 'Working…' : 'Approve'}
              </button>
              <button
                type="button"
                className="upe-queue-btn upe-queue-btn-delete"
                onClick={() => handleReject(post.id)}
                disabled={moderatingPostId === post.id}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );

  return (
    <div className="upe-page">
      {/* ── Header ── */}
      <div className="upe-header" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
        <div>
          <div className="upe-breadcrumb">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{view === 'calendar' ? 'Calendar' : 'Post Manager'}</span>
          </div>
          <h1 className="upe-title">{view === 'calendar' ? 'Post Calendar' : 'Posts'}</h1>
          <p className="upe-subtitle">
            {view === 'calendar'
              ? 'See everything scheduled at a glance. Click a day to plan a post for it.'
              : 'Schedule posts, resolve time conflicts before saving, and let the backend publish them exactly at the chosen time.'}
          </p>
          {!facebookConnected && facebookResolved && (
            <div className="upe-connection-notice" role="note">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {canManageFacebook
                ? 'Connect your Facebook Page to enable post scheduling.'
                : `Waiting for an officer or admin to connect ${activeOrg?.orgName ?? 'the organization'}'s Facebook Page before posts can be scheduled.`}
            </div>
          )}
        </div>

        <div className="upe-header-actions">
          {canManageFacebook && <FacebookPageConnectButton />}
          <div className="upe-header-buttons">
            <div className="pl-view-toggle" role="group" aria-label="View">
              <Link to="/posts" className={`pl-view-btn${view === 'list' ? ' is-active' : ''}`} aria-current={view === 'list' ? 'page' : undefined}>
                <i className="fi fi-rr-list" aria-hidden="true"></i> List
              </Link>
              <Link to="/calendar" className={`pl-view-btn${view === 'calendar' ? ' is-active' : ''}`} aria-current={view === 'calendar' ? 'page' : undefined}>
                <i className="fi fi-rr-calendar" aria-hidden="true"></i> Calendar
              </Link>
            </div>
            <button
              type="button"
              className="upe-btn-primary"
              onClick={() => openCreate()}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Post
            </button>
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="upe-error-banner" role="alert" style={{ animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button type="button" className="pl-banner-dismiss" onClick={() => setError('')} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* ── Info banner ── */}
      {info && (
        <div className="upe-info-banner" role="status" style={{ animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{info}</span>
          <button type="button" className="pl-banner-dismiss" onClick={() => setInfo('')} aria-label="Dismiss message">×</button>
        </div>
      )}

      {loadError && (
        <div className="upe-error-banner" role="alert">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {postsLoaded ? 'Showing the last posts we could load. ' : ''}Couldn’t refresh posts: {loadError}
          </span>
          <button type="button" className="ug-btn ug-btn-secondary ug-btn-sm pl-retry" onClick={() => void loadPosts()}>Try again</button>
        </div>
      )}

      {view === 'calendar' ? (
        /* ── Calendar view ── */
        <div className="upe-layout">
          <PostSchedulerCalendar posts={posts} onDateClick={openCreate} onEventClick={handleEventClick} />

          <div className="upe-sidebar-stack">
          {pendingApprovalCard}

          {/* ── Upcoming Posts sidebar ── */}
          <div className="upe-sidebar-card" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s backwards' }}>
            <div className="upe-sidebar-header">
              <div className="upe-sidebar-header-left">
                <div className="upe-sidebar-icon">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h2 className="upe-sidebar-title">Upcoming Posts</h2>
              </div>
              <span className="upe-sidebar-count">{upcomingPosts.length}</span>
            </div>

            <div className="upe-queue-list">
              {upcomingPosts.length === 0 && (
                <div className="upe-queue-empty">
                  <div className="upe-queue-empty-icon">
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} aria-hidden="true">
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
                    {post.mediaUrls && post.mediaUrls.length > 1 && (
                      <span style={{ fontSize: '11px', color: '#0C447C', background: 'rgba(12,68,124,0.08)', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>
                        📷 {post.mediaUrls.length} photos
                      </span>
                    )}
                    {post.scheduledAt && (
                      <time className="upe-queue-time" dateTime={post.scheduledAt}>
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
                  {canManagePosts && (
                    <div className="upe-queue-actions">
                      <button
                        type="button"
                        className="upe-queue-btn upe-queue-btn-publish"
                        onClick={() => { setActionError(''); setPendingAction({ kind: 'publish', post }); }}
                        disabled={publishingPostId === post.id || !canPublishPost(post)}
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
                        onClick={() => { setActionError(''); setPendingAction({ kind: 'delete', post }); }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>

          </div>
        </div>
      ) : (
        /* ── List view ── */
        <div className={`pl-layout${canModerate ? ' has-aside' : ''}`}>
          <section className="pl-main" aria-label="Posts">
            <div className="pl-toolbar">
              <div className="pl-search">
                <i className="fi fi-rr-search" aria-hidden="true"></i>
                <label htmlFor="pl-search-input" className="pl-sr-only">Search posts</label>
                <input
                  id="pl-search-input"
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search captions and hashtags…"
                />
              </div>
              <div className="pl-sort">
                <label htmlFor="pl-sort-select" className="pl-sort-label">Sort</label>
                <select id="pl-sort-select" value={sortOrder} onChange={e => setSortOverride(e.target.value as SortOrder)}>
                  <option value="latest">Latest date first</option>
                  <option value="soonest">Earliest date first</option>
                </select>
              </div>
            </div>

            <div className="pl-tabs" role="group" aria-label="Filter by status">
              {STATUS_TABS.filter(tab => tab.key !== 'REJECTED' || (counts.REJECTED ?? 0) > 0 || statusFilter === 'REJECTED').map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`pl-tab${statusFilter === tab.key ? ' is-active' : ''}`}
                  aria-pressed={statusFilter === tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                >
                  {tab.label}
                  <span className="pl-tab-count">{counts[tab.key] ?? 0}</span>
                </button>
              ))}
            </div>

            <div aria-live="polite" className="pl-sr-only">
              {postsLoaded ? `${groups.total} post${groups.total === 1 ? '' : 's'} shown` : ''}
            </div>

            {!postsLoaded && !loadError && (
              <div className="pl-skeletons" role="status" aria-label="Loading posts">
                {[0, 1, 2].map(i => <div key={i} className="pl-skeleton" />)}
              </div>
            )}

            {postsLoaded && groups.total === 0 && (
              <div className="pl-empty">
                <div className="upe-queue-empty-icon" aria-hidden="true">
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                {posts.length === 0 ? (
                  <>
                    <p className="pl-empty-title">No posts yet</p>
                    <p className="pl-empty-text">Create your first post — add media, get AI caption help, and schedule it in one flow.</p>
                    <button type="button" className="ug-btn ug-btn-primary" onClick={() => openCreate()}>Create Post</button>
                  </>
                ) : (
                  <>
                    <p className="pl-empty-title">No posts match</p>
                    <p className="pl-empty-text">Try another status or clear the search.</p>
                    <button type="button" className="ug-btn ug-btn-secondary" onClick={() => { setSearch(''); setStatusFilter('ALL'); }}>Show all posts</button>
                  </>
                )}
              </div>
            )}

            {groups.groups.map(group => (
              <div key={group.key} className="pl-group">
                <h2 className="pl-group-title">{group.label}</h2>
                <ul className="pl-list">
                  {group.items.map(post => {
                    const badge = STATUS_BADGE[post.status];
                    const thumb = postThumbnail(post, pictures);
                    const mediaCount = post.mediaUrls?.length ?? (post.mediaUrl ? 1 : 0);
                    const editable = canEditPost(post);
                    const lockedForMember = Boolean(post.orgId) && post.status === 'SCHEDULED' && !canManagePosts;
                    return (
                      <li
                        key={post.id}
                        id={`post-${post.id}`}
                        className={`pl-item${highlightId === post.id ? ' is-highlighted' : ''}`}
                      >
                        <PostThumb src={thumb} className="pl-thumb" fallbackClassName="pl-thumb-text" />
                        <div className="pl-body">
                          <div className="pl-meta">
                            <span className="upe-status-badge" style={{ background: badge?.bg, color: badge?.color }}>
                              <span className={`upe-status-dot is-${post.status.toLowerCase()}`} />
                              {badge?.label ?? post.status}
                            </span>
                            {post.scheduledAt && (
                              <time className="pl-time" dateTime={post.scheduledAt}>
                                {new Date(post.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                              </time>
                            )}
                            {mediaCount > 0 && (
                              <span className="pl-media-count">
                                <i className="fi fi-rr-images" aria-hidden="true"></i> {mediaCount} image{mediaCount === 1 ? '' : 's'}
                              </span>
                            )}
                            {post.appealType && (
                              <span className="pl-appeal">Appeal: {post.appealType === 'EDIT' ? 'edit' : 'cancel'} requested</span>
                            )}
                          </div>
                          <p className="pl-caption">{post.caption || <em>No caption</em>}</p>
                          {post.hashtags.length > 0 && (
                            <p className="pl-tags">{post.hashtags.slice(0, 5).map(tag => `#${tag.replace(/^#/, '')}`).join(' ')}{post.hashtags.length > 5 ? ` +${post.hashtags.length - 5}` : ''}</p>
                          )}
                        </div>
                        <div className="pl-actions">
                          {post.status === 'PUBLISHED' && post.fbPostId && (
                            <Link to={`/analytics/posts/${encodeURIComponent(post.fbPostId)}`} className="ug-btn ug-btn-secondary ug-btn-sm">
                              <i className="fi fi-rr-chart-histogram" aria-hidden="true"></i> Insights
                            </Link>
                          )}
                          {(editable || lockedForMember) && (
                            <button type="button" className="ug-btn ug-btn-secondary ug-btn-sm" onClick={() => handleEventClick(post)}>
                              <i className="fi fi-rr-edit" aria-hidden="true"></i> {lockedForMember ? 'View' : 'Edit'}
                              <span className="pl-sr-only"> post: {post.caption.slice(0, 40)}</span>
                            </button>
                          )}
                          {canPublishPost(post) && (
                            <button
                              type="button"
                              className="ug-btn ug-btn-primary ug-btn-sm"
                              onClick={() => { setActionError(''); setPendingAction({ kind: 'publish', post }); }}
                              disabled={publishingPostId === post.id}
                            >
                              {publishingPostId === post.id ? 'Publishing…' : post.status === 'FAILED' ? 'Retry' : 'Publish'}
                            </button>
                          )}
                          <button type="button" className="ug-btn ug-btn-ghost ug-btn-sm" onClick={() => duplicatePost(post)}>
                            <i className="fi fi-rr-copy-alt" aria-hidden="true"></i> Duplicate
                          </button>
                          {canDeletePost(post) && (
                            <button
                              type="button"
                              className="ug-btn ug-btn-ghost ug-btn-sm pl-delete"
                              onClick={() => { setActionError(''); setPendingAction({ kind: 'delete', post }); }}
                              aria-label={`Delete post: ${post.caption.slice(0, 40)}`}
                            >
                              <i className="fi fi-rr-trash" aria-hidden="true"></i>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>

          {canModerate && <aside className="pl-aside" aria-label="Approval queue">{pendingApprovalCard}</aside>}
        </div>
      )}

      <PostEditorModal
        open={Boolean(editor)}
        initialPost={editor?.post ?? null}
        initialDraft={editor?.draft ?? null}
        conflict={conflict}
        loading={loading}
        error={editorError}
        onClose={closeEditor}
        onSubmit={saveDraft}
        onClearConflict={() => setConflict(null)}
      />

      <PostPreviewModal
        open={Boolean(previewPost)}
        post={previewPost}
        currentUserId={user?.userId}
        canModerate={canModerate}
        loading={appealBusy}
        error={appealError}
        onClose={closePreview}
        onRequestAppeal={submitAppeal}
        onApproveAppeal={() => resolveAppeal(true)}
        onRejectAppeal={() => resolveAppeal(false)}
        onEditNow={editNowFromPreview}
      />

      <ConfirmDialog
        open={pendingAction !== null}
        tone={pendingAction?.kind === 'delete' ? 'danger' : 'primary'}
        title={pendingAction?.kind === 'delete' ? 'Delete this post?' : `Publish now to ${pageName ?? 'Facebook'}?`}
        description={pendingAction?.kind === 'delete'
          ? (pendingAction.post.status === 'SCHEDULED'
            ? 'It will be removed from the calendar and will not be published. This can’t be undone.'
            : 'This permanently removes the post from Ugnay. This can’t be undone.')
          : 'The post goes live on your Facebook Page immediately and replaces any scheduled time.'}
        confirmLabel={pendingAction?.kind === 'delete' ? 'Delete Post' : 'Publish Now'}
        busyLabel={pendingAction?.kind === 'delete' ? 'Deleting…' : 'Publishing…'}
        busy={actionBusy}
        error={actionError}
        onCancel={() => { if (!actionBusy) setPendingAction(null); }}
        onConfirm={() => void confirmPendingAction()}
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

        .upe-sidebar-stack {
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-width: 0;
        }

        .upe-info-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding: 14px 18px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-left: 4px solid #3b82f6;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          color: #1d4ed8;
        }
        .upe-info-banner svg { color: #3b82f6; flex-shrink: 0; }

        /* ── Calendar Card ── */
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

        /* ── Queue Item ── */
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
        .upe-status-dot.is-pending_review { background: #f59e0b; }
        .upe-status-dot.is-rejected { background: #ef4444; }

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
            padding: 20px 16px 32px;
          }

          .upe-title {
            font-size: 24px;
          }

          .upe-header {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }

          .upe-header-actions {
            align-items: stretch;
            width: 100%;
          }

          .upe-header-buttons {
            justify-content: space-between;
          }

          .upe-calendar-card {
            padding: 16px 12px;
          }

          .upe-calendar-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
}