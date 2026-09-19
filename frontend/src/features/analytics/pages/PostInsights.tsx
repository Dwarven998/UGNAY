import { useNavigate, useParams } from 'react-router-dom';
import { analyticsApi } from '../api/analyticsApi.ts';
import type { PostComment, PostDetail } from '../api/analyticsApi.ts';
import { useOrganization } from '../../../context/useOrganization';
import { usePolling } from '../usePolling.ts';
import TimeChart from '../components/TimeChart.tsx';
import { Icon } from '../components/icons.tsx';
import { SyncBadge, SyncingPanel } from '../components/SyncIndicator.tsx';
import { formatClock, formatCount, formatDateTime, timeAgo } from '../format.ts';
import '../analytics.css';

const COMPARISON_TEXT = {
  above: 'This post’s views are above your recent posts.',
  typical: 'This post’s views are typical compared to your recent posts.',
  below: 'This post’s views are below your recent posts.',
} as const;

const initials = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

function Avatar({ name, src, small }: Readonly<{ name: string; src?: string; small?: boolean }>) {
  return (
    <div className={`an-avatar${small ? ' sm' : ''}`}>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : initials(name)}
    </div>
  );
}

function CommentItem({ comment, isReply }: Readonly<{ comment: PostComment; isReply?: boolean }>) {
  const name = comment.authorName || 'Facebook user';
  return (
    <div className="an-comment">
      <Avatar name={name} src={comment.authorPicture} small={isReply} />
      <div className="an-comment-main">
        <div className="an-comment-bubble">
          <b>{name}</b>
          {comment.message && <p>{comment.message}</p>}
          {comment.attachmentUrl && <img src={comment.attachmentUrl} alt="Comment attachment" loading="lazy" />}
        </div>
        <div className="an-comment-meta">
          <span>{timeAgo(comment.createdTime)}</span>
          {comment.likeCount > 0 && <span>{comment.likeCount} {comment.likeCount === 1 ? 'like' : 'likes'}</span>}
          {comment.permalinkUrl && (
            <a href={comment.permalinkUrl} target="_blank" rel="noopener noreferrer">View on Facebook</a>
          )}
        </div>
        {comment.replies.length > 0 && (
          <div className="an-replies">
            {comment.replies.map(reply => <CommentItem key={reply.id} comment={reply} isReply />)}
          </div>
        )}
      </div>
    </div>
  );
}

const POST_STEPS = [
  'Connecting to your Facebook Page',
  'Fetching this post’s views and interactions',
  'Loading every comment and reply',
  'Putting the numbers together',
];

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading post insights">
      <SyncingPanel steps={POST_STEPS} />
      <div className="an-post-layout">
        <div className="an-post-main">
          <div className="an-skel" style={{ height: 150, borderRadius: 20, marginBottom: 24 }} />
          <div className="an-skel" style={{ height: 340, borderRadius: 20, marginBottom: 24 }} />
          <div className="an-skel" style={{ height: 220, borderRadius: 20 }} />
        </div>
        <div className="an-skel" style={{ height: 520, borderRadius: 20 }} />
      </div>
    </div>
  );
}

function ViewOnFacebook({ url, primary }: Readonly<{ url: string; primary?: boolean }>) {
  return (
    <a className={`an-link-btn${primary ? ' primary' : ''}`} href={url} target="_blank" rel="noopener noreferrer">
      <Icon name="external" size={14} /> View post on Facebook
    </a>
  );
}

function PostBody({ post, pageName }: Readonly<{ post: PostDetail; pageName: string }>) {
  const commentTotal = post.comments;
  const chartPoints = post.series.map(p => ({ x: p.t, y: p.views }));
  const baseline = post.typicalViews !== null
    ? { value: post.typicalViews, label: `Typical post: ${post.typicalViews.toLocaleString()}` }
    : null;

  return (
    <div className="an-post-layout">
      <div className="an-post-main">
        <section className="an-card">
          <div className="an-card-head">
            <h2 className="an-card-title">Overview</h2>
          </div>
          <div className="an-card-body">
            <div className="an-stat-row">
              <div className="an-stat"><span>Views</span><b>{formatCount(post.views)}</b></div>
              <div className="an-stat"><span>Viewers</span><b>{formatCount(post.viewers)}</b></div>
              <div className="an-stat"><span>Interactions</span><b>{post.interactions.toLocaleString()}</b></div>
              <div className="an-stat"><span>Link clicks</span><b>{formatCount(post.linkClicks)}</b></div>
            </div>
          </div>
        </section>

        <section className="an-card" style={{ animationDelay: '0.05s' }}>
          <div className="an-card-head">
            <h2 className="an-card-title">Views over time</h2>
            <span className="an-card-sub">Live · updates every few seconds</span>
          </div>
          <div className="an-card-body">
            {!post.viewsAvailable && (
              <div className="an-empty">
                <p className="an-empty-title">View counts aren’t available for this post</p>
                <p>Reconnect your Page in Post Creator to grant insights access.</p>
              </div>
            )}
            {post.viewsAvailable && (
              <>
                {post.comparison && <p className={`an-compare ${post.comparison}`}><i />{COMPARISON_TEXT[post.comparison]}</p>}
                <TimeChart
                  points={chartPoints}
                  step
                  baseline={baseline}
                  formatX={formatClock}
                  valueLabel="views"
                  ariaLabel={`Views of this post over time, currently ${post.views ?? 0}`}
                />
                <p className="an-note">
                  {post.trackingSince
                    ? `History recorded since ${formatClock(new Date(post.trackingSince).getTime())}; Facebook reports only a running total, so earlier views appear as the starting value.`
                    : 'Tracking starts now — the graph fills in as views come in.'}
                </p>
              </>
            )}
          </div>
        </section>

        <section className="an-card" style={{ animationDelay: '0.1s' }}>
          <div className="an-card-head">
            <h2 className="an-card-title">Interactions</h2>
          </div>
          <div className="an-card-body">
            <div className="an-stat-row">
              <div className="an-stat"><span>Likes and reactions</span><b>{post.reactions.toLocaleString()}</b></div>
              <div className="an-stat"><span>Comments</span><b>{commentTotal.toLocaleString()}</b></div>
              <div className="an-stat"><span>Shares</span><b>{post.shares.toLocaleString()}</b></div>
            </div>
          </div>
        </section>

        <section className="an-card" style={{ animationDelay: '0.15s' }}>
          <div className="an-card-head">
            <h2 className="an-card-title">Comments <span className="an-count-pill">{commentTotal.toLocaleString()}</span></h2>
          </div>
          <div className="an-card-body">
            {post.commentList.length === 0 && (
              <div className="an-empty">
                <div className="an-empty-icon"><Icon name="chat" size={26} stroke={1.4} /></div>
                <p className="an-empty-title">No comments yet</p>
                <p>New comments appear here within a few seconds.</p>
              </div>
            )}
            <div className="an-comments">
              {[...post.commentList].reverse().map(comment => <CommentItem key={comment.id} comment={comment} />)}
            </div>
            {!post.commentsComplete && (
              <p className="an-note">Some comments couldn’t be loaded. <a href={post.permalinkUrl} target="_blank" rel="noopener noreferrer">View all on Facebook</a></p>
            )}
          </div>
        </section>
      </div>

      <aside className="an-post-side">
        <section className="an-card" style={{ animationDelay: '0.05s' }}>
          <div className="an-card-head"><h2 className="an-card-title">Feed preview</h2></div>
          <div className="an-preview">
            <div className="an-preview-author">
              <Avatar name={pageName} />
              <div>
                <b>{pageName}</b>
                <small>{formatDateTime(post.createdTime)}</small>
              </div>
            </div>
            {post.message && <p className="an-preview-text">{post.message}</p>}
            {post.imageUrl && <img className="an-preview-img" src={post.imageUrl} alt="Post media" referrerPolicy="no-referrer" />}
            <div className="an-preview-counts">
              <span>👍 {post.reactions}</span>
              <span>💬 {commentTotal}</span>
              <span>↗ {post.shares}</span>
            </div>
          </div>
          <div className="an-preview-foot">
            <ViewOnFacebook url={post.permalinkUrl} primary />
          </div>
        </section>
      </aside>
    </div>
  );
}

export default function PostInsights() {
  const { postId = '' } = useParams();
  const navigate = useNavigate();
  const { activeOrgId, activeOrg, loading: orgLoading, memberships } = useOrganization();
  const isResolvingOrg = orgLoading || (memberships.length > 0 && !activeOrgId);

  const { data, error, syncedAt, syncing } = usePolling(
    `${activeOrgId ?? 'personal'}|post|${postId}`,
    !isResolvingOrg && postId !== '',
    () => analyticsApi.getPostDetail(activeOrgId, postId),
  );

  const title = data?.message ? data.message : 'Post insights';
  const notFound = !data && error !== null && /not found|404/i.test(error);

  return (
    <div className="an-container">
      <div className="an-post-head">
        <button className="an-back" onClick={() => navigate('/analytics')} aria-label="Back to analytics">
          <Icon name="left" size={18} />
        </button>
        {data?.imageUrl && <img className="an-post-thumb" src={data.imageUrl} alt="" referrerPolicy="no-referrer" />}
        <div className="an-post-titles">
          <h1>{title}</h1>
          <p>{data ? `Facebook post · Published ${formatDateTime(data.createdTime)}` : 'Loading…'}</p>
        </div>
        <SyncBadge syncing={syncing} syncedAt={syncedAt} />
        {data && <ViewOnFacebook url={data.permalinkUrl} />}
      </div>

      {notFound && (
        <div className="an-empty">
          <div className="an-empty-icon"><Icon name="lock" size={26} stroke={1.4} /></div>
          <p className="an-empty-title">This post isn’t on your Page</p>
          <p>It may have been deleted, or it belongs to a different organization.</p>
          <button className="an-link-btn" style={{ marginTop: 16 }} onClick={() => navigate('/analytics')}>Back to analytics</button>
        </div>
      )}
      {error && !notFound && (
        <div className="an-notice error" role="alert">
          <Icon name="info" size={18} />
          <div><strong>Couldn't refresh this post</strong>Retrying automatically. {data ? 'Showing the last synced numbers.' : ''}</div>
        </div>
      )}
      {!data && !error && <Skeleton />}
      {data && <PostBody post={data} pageName={activeOrg?.orgName ?? 'Your Page'} />}
    </div>
  );
}
