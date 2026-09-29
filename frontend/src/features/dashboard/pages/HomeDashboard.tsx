import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '../../../context/useAuth';
import { useOrganization } from '../../../context/useOrganization';
import type { Post } from '../../../types';
import { analyticsApi, type Dashboard as AnalyticsDashboard } from '../../analytics/api/analyticsApi';
import { postApi } from '../../posts/api/postApi';
import { useFacebookConnection } from '../../posts/hooks/useFacebookConnection';
import FacebookPageConnectButton from '../../posts/components/FacebookPageConnectButton';
import PostThumb from '../../posts/components/PostThumb';
import { postCache, postThumbnail, scopedCache } from '../../posts/postCache';
import { isSetupDone } from '../../setup/setupStatus';
import '../../../components/ui/dialog.css';
import '../../posts/posts.css';
import './home.css';

type LoadState = 'loading' | 'ready' | 'error';
const ANALYTICS_CACHE = 'dashboard-analytics-28';
interface Scoped<T> { scopeKey: string; state: LoadState; data: T }

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (isSameDay(date, now)) return { day: 'Today', time };
  if (isSameDay(date, tomorrow)) return { day: 'Tomorrow', time };
  return { day: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), time };
}

const compact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K` : value.toLocaleString();

/** The workspace home: answers "what should I do next?" before anything else. */
export default function HomeDashboard() {
  const { user } = useAuth();
  const { activeOrgId, activeOrg, memberships, loading: orgLoading, loadError: orgLoadError } = useOrganization();
  const facebook = useFacebookConnection();
  const { scopeKey, resolved, connected } = facebook;

  const canModerate = activeOrg?.role === 'ADMIN' || activeOrg?.role === 'OFFICER';
  const canManageFacebook = !activeOrgId || canModerate;
  const workspaceName = activeOrg?.orgName ?? user?.orgName ?? 'Personal Workspace';

  const [posts, setPosts] = useState<Scoped<Post[]>>({ scopeKey: '', state: 'loading', data: [] });
  const [pending, setPending] = useState<Scoped<Post[]>>({ scopeKey: '', state: 'loading', data: [] });
  const [analytics, setAnalytics] = useState<Scoped<AnalyticsDashboard | null>>({ scopeKey: '', state: 'loading', data: null });
  const [postsReload, setPostsReload] = useState(0);
  const [analyticsReload, setAnalyticsReload] = useState(0);

  // Results are only stored once a response lands, tagged with the scope they were loaded for; "loading" is
  // derived from that tag, so switching workspace or Page instantly reads as loading instead of old numbers.
  useEffect(() => {
    if (!resolved) return;
    let current = true;
    const requested = scopeKey;
    postApi.getAll(activeOrgId).then(
      data => {
        postCache.setPosts(requested, data);
        if (current) setPosts({ scopeKey: requested, state: 'ready', data });
      },
      err => {
        console.error('Failed to load posts:', err);
        if (current) setPosts({ scopeKey: requested, state: 'error', data: [] });
      },
    );
    if (activeOrgId && canModerate) {
      postApi.getModerationQueue(activeOrgId).then(
        data => { if (current) setPending({ scopeKey: requested, state: 'ready', data }); },
        err => {
          console.error('Failed to load approval queue:', err);
          if (current) setPending({ scopeKey: requested, state: 'error', data: [] });
        },
      );
    }
    return () => { current = false; };
  }, [resolved, scopeKey, activeOrgId, canModerate, postsReload]);

  useEffect(() => {
    if (!resolved || !connected) return;
    let current = true;
    const requested = scopeKey;
    analyticsApi.getDashboard(activeOrgId, 28).then(
      data => {
        scopedCache.set(ANALYTICS_CACHE, requested, data);
        if (current) setAnalytics({ scopeKey: requested, state: 'ready', data });
      },
      err => {
        console.error('Failed to load analytics:', err);
        if (current) setAnalytics({ scopeKey: requested, state: 'error', data: null });
      },
    );
    return () => { current = false; };
  }, [resolved, connected, scopeKey, activeOrgId, analyticsReload]);

  const retryPosts = () => {
    setPosts(prev => ({ ...prev, scopeKey: '' }));
    setPostsReload(n => n + 1);
  };
  const retryAnalytics = () => {
    setAnalytics(prev => ({ ...prev, scopeKey: '' }));
    setAnalyticsReload(n => n + 1);
  };

  // What was last loaded for this Page shows immediately; a fresh response replaces it. A failed refresh keeps
  // showing the last good data rather than an error.
  const cachedPosts = useMemo(() => (resolved ? postCache.getPosts(scopeKey) : null), [resolved, scopeKey]);
  const cachedAnalytics = useMemo(
    () => (resolved && connected ? scopedCache.get<AnalyticsDashboard>(ANALYTICS_CACHE, scopeKey) : null),
    [resolved, connected, scopeKey],
  );

  const freshPosts = posts.scopeKey === scopeKey ? posts : null;
  const usablePosts = freshPosts?.state === 'ready' ? freshPosts.data : cachedPosts;
  const postList = useMemo(() => usablePosts ?? [], [usablePosts]);
  const postsState: LoadState = !resolved ? 'loading' : usablePosts ? 'ready' : (freshPosts?.state ?? 'loading');
  const pendingList = canModerate && pending.scopeKey === scopeKey ? pending.data : [];

  const freshAnalytics = analytics.scopeKey === scopeKey ? analytics : null;
  const analyticsData = (freshAnalytics?.state === 'ready' ? freshAnalytics.data : null) ?? cachedAnalytics;
  const analyticsState: LoadState = !resolved ? 'loading' : analyticsData ? 'ready' : (freshAnalytics?.state ?? 'loading');

  const summary = useMemo(() => {
    const now = new Date();
    const scheduled = postList
      .filter(p => p.status === 'SCHEDULED' && p.scheduledAt && new Date(p.scheduledAt).getTime() >= now.getTime() - 60_000)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    const awaitingReview = postList
      .filter(p => p.status === 'PENDING_REVIEW' && p.scheduledAt)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    return {
      scheduledToday: scheduled.filter(p => isSameDay(new Date(p.scheduledAt!), now)).length,
      upcomingCount: scheduled.length,
      published: postList.filter(p => p.status === 'PUBLISHED').length,
      drafts: postList.filter(p => p.status === 'DRAFT').length,
      failed: postList.filter(p => p.status === 'FAILED').length,
      rejected: postList.filter(p => p.status === 'REJECTED').length,
      myPending: postList.filter(p => p.status === 'PENDING_REVIEW').length,
      upcoming: [...scheduled, ...awaitingReview]
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
        .slice(0, 5),
    };
  }, [postList]);

  const topContent = useMemo(() => {
    if (!analyticsData) return [];
    return [...analyticsData.content]
      .sort((a, b) => (b.reactions + b.comments + b.shares) - (a.reactions + a.comments + a.shares))
      .slice(0, 3);
  }, [analyticsData]);

  // A brand-new account (no workspace, no Page, setup never seen) gets the short setup flow first.
  if (
    user && !orgLoading && !orgLoadError && memberships.length === 0
    && !user.facebookConnected && !isSetupDone(user.userId)
  ) {
    return <Navigate to="/setup" replace />;
  }

  const attention = [
    summary.failed > 0 && { key: 'failed', tone: 'danger', label: `${summary.failed} post${summary.failed === 1 ? '' : 's'} failed to publish`, to: '/posts?status=FAILED', action: 'Review' },
    canModerate && pendingList.length > 0 && { key: 'approve', tone: 'warn', label: `${pendingList.length} post${pendingList.length === 1 ? '' : 's'} waiting for your approval`, to: '/posts?status=PENDING_REVIEW', action: 'Review' },
    !canModerate && summary.myPending > 0 && { key: 'mine', tone: 'info', label: `${summary.myPending} of your post${summary.myPending === 1 ? ' is' : 's are'} awaiting approval`, to: '/posts?status=PENDING_REVIEW', action: 'View' },
    summary.rejected > 0 && { key: 'rejected', tone: 'danger', label: `${summary.rejected} post${summary.rejected === 1 ? ' was' : 's were'} rejected`, to: '/posts?status=REJECTED', action: 'View' },
    summary.drafts > 0 && { key: 'drafts', tone: 'neutral', label: `${summary.drafts} draft${summary.drafts === 1 ? '' : 's'} to finish`, to: '/posts?status=DRAFT', action: 'Continue' },
  ].filter(Boolean) as { key: string; tone: string; label: string; to: string; action: string }[];

  return (
    <div className="hd-page">
      {/* ── Hero ── */}
      <section className="hd-hero" aria-labelledby="hd-greeting">
        <div className="hd-hero-text">
          <p className="hd-workspace">
            <span className="hd-workspace-dot" aria-hidden="true" />
            {workspaceName}{activeOrg && <span className="hd-role">{activeOrg.role}</span>}
          </p>
          <h1 id="hd-greeting" className="hd-title">{greeting()}</h1>
          <p className="hd-subtitle">
            {postsState === 'ready' && summary.scheduledToday > 0
              ? `You have ${summary.scheduledToday} post${summary.scheduledToday === 1 ? '' : 's'} going out today.`
              : 'What would you like to share today?'}
          </p>
        </div>
        <Link to="/create" className="hd-create">
          <span className="hd-create-icon" aria-hidden="true">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Create Post
        </Link>
      </section>

      {resolved && !connected && (
        <section className="hd-connect" aria-label="Facebook connection">
          <div>
            <h2 className="hd-connect-title">Connect your Facebook Page</h2>
            <p className="hd-connect-text">
              {canManageFacebook
                ? `Connect a Page to start publishing ${activeOrg ? `${workspaceName}’s` : 'your'} content. You can still write drafts in the meantime.`
                : `An officer or admin of ${workspaceName} needs to connect its Facebook Page before posts can be published.`}
            </p>
          </div>
          {canManageFacebook && <FacebookPageConnectButton />}
        </section>
      )}

      {/* ── Today's overview ── */}
      <section className="hd-section" aria-labelledby="hd-overview-title">
        <div className="hd-section-head">
          <h2 id="hd-overview-title" className="hd-section-title">Today’s overview</h2>
        </div>
        {postsState === 'error' ? (
          <ErrorState message="We couldn't load your posts." onRetry={retryPosts} />
        ) : (
          <div className="hd-stats">
            <Stat label="Scheduled today" value={postsState === 'ready' ? summary.scheduledToday.toLocaleString() : null} to="/calendar" />
            <Stat label="Upcoming" value={postsState === 'ready' ? summary.upcomingCount.toLocaleString() : null} to="/posts?status=SCHEDULED" />
            <Stat label="Published" value={postsState === 'ready' ? summary.published.toLocaleString() : null} to="/posts?status=PUBLISHED" />
            <Stat
              label="Engagement · 28 days"
              value={!connected ? '—' : analyticsState === 'ready' && analyticsData ? compact(analyticsData.kpis.totalEngagement) : analyticsState === 'error' ? '—' : null}
              hint={!connected ? 'Connect a Page' : analyticsState === 'error' ? 'Unavailable' : undefined}
              to="/analytics"
            />
          </div>
        )}
      </section>

      {attention.length > 0 && (
        <section className="hd-section" aria-labelledby="hd-attention-title">
          <div className="hd-section-head">
            <h2 id="hd-attention-title" className="hd-section-title">Needs your attention</h2>
          </div>
          <ul className="hd-attention">
            {attention.map(item => (
              <li key={item.key} className={`hd-attention-item is-${item.tone}`}>
                <span className="hd-attention-dot" aria-hidden="true" />
                <span className="hd-attention-label">{item.label}</span>
                <Link to={item.to} className="hd-attention-link">{item.action}<span className="hd-sr-only">: {item.label}</span></Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="hd-grid">
        {/* ── Upcoming posts ── */}
        <section className="hd-card" aria-labelledby="hd-upcoming-title">
          <div className="hd-card-head">
            <h2 id="hd-upcoming-title" className="hd-section-title">Upcoming posts</h2>
            <Link to="/calendar" className="hd-card-link">View Calendar</Link>
          </div>
          {postsState === 'loading' && <SkeletonRows />}
          {postsState === 'error' && <ErrorState message="Upcoming posts couldn't be loaded." onRetry={retryPosts} />}
          {postsState === 'ready' && summary.upcoming.length === 0 && (
            <EmptyState
              title={postList.length === 0 ? 'Create your first post' : 'Nothing scheduled'}
              text={postList.length === 0 ? 'Add media, let AI help with the caption, and schedule it — all in one place.' : 'Schedule a post and it will show up here.'}
              action={<Link to="/create" className="ug-btn ug-btn-primary ug-btn-sm">Create Post</Link>}
            />
          )}
          {postsState === 'ready' && summary.upcoming.length > 0 && (
            <ul className="hd-upcoming">
              {summary.upcoming.map(post => {
                const when = formatWhen(post.scheduledAt!);
                const thumb = postThumbnail(post);
                return (
                  <li key={post.id}>
                    <Link to={`/posts?status=${post.status}&highlight=${encodeURIComponent(post.id)}`} className="hd-upcoming-item">
                      <span className="hd-upcoming-when">
                        <span className="hd-upcoming-time">{when.time}</span>
                        <span className="hd-upcoming-day">{when.day}</span>
                      </span>
                      <PostThumb src={thumb} className="hd-upcoming-thumb" fallbackClassName="hd-upcoming-thumb-text" />
                      <span className="hd-upcoming-body">
                        <span className="hd-upcoming-caption">{post.caption || 'Untitled post'}</span>
                        {post.status === 'PENDING_REVIEW' && <span className="hd-pill is-warn">Awaiting approval</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Recent performance ── */}
        <section className="hd-card" aria-labelledby="hd-performance-title">
          <div className="hd-card-head">
            <h2 id="hd-performance-title" className="hd-section-title">Recent performance</h2>
            {connected && <Link to="/analytics" className="hd-card-link">View Full Insights</Link>}
          </div>
          {!connected && resolved && (
            <EmptyState title="No performance data yet" text="Once a Facebook Page is connected and posts are published, their reach and engagement appear here." />
          )}
          {connected && analyticsState === 'loading' && <SkeletonRows count={2} />}
          {connected && analyticsState === 'error' && (
            <ErrorState message="Performance data couldn't be loaded from Facebook." onRetry={retryAnalytics} />
          )}
          {connected && analyticsState === 'ready' && analyticsData && (
            <>
              <div className="hd-kpis">
                <div className="hd-kpi"><span className="hd-kpi-value">{analyticsData.kpis.publishedPosts.toLocaleString()}</span><span className="hd-kpi-label">Published</span></div>
                <div className="hd-kpi"><span className="hd-kpi-value">{compact(analyticsData.kpis.totalEngagement)}</span><span className="hd-kpi-label">Engagement</span></div>
                <div className="hd-kpi"><span className="hd-kpi-value">{analyticsData.kpis.avgEngagement.toFixed(1)}</span><span className="hd-kpi-label">Avg / post</span></div>
              </div>
              {topContent.length === 0 ? (
                <EmptyState
                  title="No published posts in the last 28 days"
                  text="Publish a post and check back to see how it performs."
                  action={<Link to="/create" className="ug-btn ug-btn-secondary ug-btn-sm">Create Post</Link>}
                />
              ) : (
                <>
                  <h3 className="hd-subtitle-sm">Top posts · last 28 days</h3>
                  <ul className="hd-top">
                    {topContent.map(item => (
                      <li key={item.id}>
                        <Link to={`/analytics/posts/${encodeURIComponent(item.id)}`} className="hd-top-item">
                          <PostThumb src={item.imageUrl} className="hd-top-thumb" fallbackClassName="hd-upcoming-thumb-text" />
                          <span className="hd-top-caption">{item.message || 'Untitled post'}</span>
                          <span className="hd-top-stats">
                            <span title="Reactions">👍 {item.reactions}</span>
                            <span title="Comments">💬 {item.comments}</span>
                            <span title="Shares">↗ {item.shares}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, to }: Readonly<{ label: string; value: string | null; hint?: string; to: string }>) {
  return (
    <Link to={to} className="hd-stat">
      <span className="hd-stat-label">{label}</span>
      {value === null
        ? <span className="hd-skeleton hd-skeleton-stat" aria-label="Loading" />
        : <span className="hd-stat-value">{value}</span>}
      {hint && <span className="hd-stat-hint">{hint}</span>}
    </Link>
  );
}

function SkeletonRows({ count = 3 }: Readonly<{ count?: number }>) {
  return (
    <div className="hd-skeleton-rows" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => <span key={i} className="hd-skeleton hd-skeleton-row" />)}
    </div>
  );
}

function EmptyState({ title, text, action }: Readonly<{ title: string; text: string; action?: ReactNode }>) {
  return (
    <div className="hd-empty">
      <p className="hd-empty-title">{title}</p>
      <p className="hd-empty-text">{text}</p>
      {action}
    </div>
  );
}

function ErrorState({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <div className="hd-error" role="alert">
      <span>{message}</span>
      <button type="button" className="ug-btn ug-btn-secondary ug-btn-sm" onClick={onRetry}>Try again</button>
    </div>
  );
}
