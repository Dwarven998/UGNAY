import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { analyticsApi } from '../api/analyticsApi.ts';
import type { ContentItem, DayPoint, Dashboard, FormatStat, Trend } from '../api/analyticsApi.ts';
import { useOrganization } from '../../../context/useOrganization';
import { usePolling } from '../usePolling.ts';
import TimeChart from '../components/TimeChart.tsx';
import { Icon } from '../components/icons.tsx';
import { SyncBadge, SyncingPanel } from '../components/SyncIndicator.tsx';
import type { IconName } from '../components/icons.tsx';
import { dayToMs, formatCount, formatDate, formatDay, formatDuration, formatLongDay } from '../format.ts';
import '../analytics.css';

type MetricKey = 'views' | 'threeSecond' | 'interactions' | 'watch';

const RANGES = [{ days: 7, label: 'Last 7 days' }, { days: 28, label: 'Last 28 days' }];

const KPI_CARDS: { label: string; icon: IconName; color: string; pick: (d: Dashboard) => string }[] = [
  { label: 'Total Posts', icon: 'doc', color: '#0C447C', pick: d => d.kpis.totalPosts.toLocaleString() },
  { label: 'Published', icon: 'rocket', color: '#059669', pick: d => d.kpis.publishedPosts.toLocaleString() },
  { label: 'Total Engagement', icon: 'chat', color: '#7c3aed', pick: d => d.kpis.totalEngagement.toLocaleString() },
  { label: 'Avg Engagement', icon: 'trend', color: '#d97706', pick: d => d.kpis.avgEngagement.toFixed(1) },
];

function TrendChip({ trend }: Readonly<{ trend: Trend }>) {
  const pct = trend.changePercent ?? 0;
  const kind = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return (
    <span className={`an-trend ${kind}`} title={`Previous period: ${trend.previous.toLocaleString()}`}>
      {pct > 0 ? '↑' : pct < 0 ? '↓' : ''} {Math.abs(pct)}%
    </span>
  );
}

function CardTitle({ icon, children }: Readonly<{ icon: IconName; children: string }>) {
  return (
    <h2 className="an-card-title">
      <span className="an-card-badge"><Icon name={icon} size={15} /></span>
      {children}
    </h2>
  );
}

function ContentThumb({ item }: Readonly<{ item: ContentItem }>) {
  return (
    <div className="an-thumb">
      {item.imageUrl
        ? <img src={item.imageUrl} alt="" loading="lazy" />
        : <div className="an-thumb-text">{item.message || 'Post'}</div>}
      <span className="an-fmt-chip">{item.format === 'PHOTO' ? 'Photo' : item.format === 'VIDEO' ? 'Video' : item.format === 'LINK' ? 'Link' : item.format === 'TEXT' ? 'Text' : 'Post'}</span>
    </div>
  );
}

function ContentCarousel({ items }: Readonly<{ items: ContentItem[] }>) {
  const railRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => railRef.current?.scrollBy({ left: dir * 380, behavior: 'smooth' });
  return (
    <div className="an-carousel-wrap">
      <button className="an-carousel-btn left" onClick={() => scroll(-1)} aria-label="Scroll left"><Icon name="left" /></button>
      <div className="an-carousel" ref={railRef}>
        {items.map(item => (
          <Link key={item.id} to={`/analytics/posts/${encodeURIComponent(item.id)}`} className="an-content-card">
            <ContentThumb item={item} />
            <div className="an-content-body">
              <p className="an-content-caption">{item.message || 'Untitled post'}</p>
              <p className="an-content-date">{formatDate(item.createdTime)}</p>
              <div className="an-content-stats">
                <span title="Views"><Icon name="eye" size={13} /> {formatCount(item.views)}</span>
                <span title="Reactions"><Icon name="heart" size={13} /> {item.reactions}</span>
                <span title="Comments"><Icon name="chat" size={13} /> {item.comments}</span>
                <span title="Shares"><Icon name="share" size={13} /> {item.shares}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <button className="an-carousel-btn right" onClick={() => scroll(1)} aria-label="Scroll right"><Icon name="right" /></button>
    </div>
  );
}

function ContentTable({ items }: Readonly<{ items: ContentItem[] }>) {
  const navigate = useNavigate();
  return (
    <div className="an-table-wrap">
      <table className="an-table">
        <thead>
          <tr><th>Post</th><th>Views</th><th>Reactions</th><th>Comments</th><th>Shares</th></tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="an-row" onClick={() => navigate(`/analytics/posts/${encodeURIComponent(item.id)}`)}>
              <td>
                <div className="an-table-post">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <div className="ph" />}
                  <div>
                    <p>{item.message || 'Untitled post'}</p>
                    <small>{formatDate(item.createdTime)}</small>
                  </div>
                </div>
              </td>
              <td>{formatCount(item.views)}</td>
              <td>{item.reactions}</td>
              <td>{item.comments}</td>
              <td>{item.shares}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormatCard({ title, stats, pick }: Readonly<{ title: string; stats: FormatStat[]; pick: (s: FormatStat) => number }>) {
  const max = Math.max(1, ...stats.map(pick));
  return (
    <div className="an-format-card">
      <h3>{title}</h3>
      {stats.map(stat => (
        <div className="an-bar-row" key={stat.key}>
          <span>{stat.label}</span>
          <div className="an-bar-track"><div className="an-bar-fill" style={{ width: `${(pick(stat) / max) * 100}%` }} /></div>
          <b>{pick(stat).toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading analytics">
      <SyncingPanel />
      <div className="an-kpi-grid">{[0, 1, 2, 3].map(i => <div key={i} className="an-skel" style={{ height: 104 }} />)}</div>
      <div className="an-skel" style={{ height: 420, marginBottom: 24, borderRadius: 20 }} />
      <div className="an-skel" style={{ height: 300, borderRadius: 20 }} />
    </div>
  );
}

function OverviewCard({ data }: Readonly<{ data: Dashboard }>) {
  const [metric, setMetric] = useState<MetricKey>('views');
  const o = data.overview;

  const tiles: { key: MetricKey; label: string; value: string; trend: Trend }[] = [
    { key: 'views', label: 'Views', value: data.viewsAvailable ? o.views.value.toLocaleString() : '--', trend: o.views },
    { key: 'threeSecond', label: '3-second views', value: o.threeSecondViews.value.toLocaleString(), trend: o.threeSecondViews },
    { key: 'interactions', label: 'Content interactions', value: o.interactions.value.toLocaleString(), trend: o.interactions },
    { key: 'watch', label: 'Watch time', value: formatDuration(o.watchTimeSeconds.value), trend: o.watchTimeSeconds },
  ];
  const series: Record<MetricKey, { points: DayPoint[]; label: string }> = {
    views: { points: o.viewsSeries, label: 'views' },
    threeSecond: { points: o.threeSecondViewsSeries, label: '3-second views' },
    interactions: { points: o.interactionsSeries, label: 'interactions (by publish day)' },
    watch: { points: o.watchTimeSeries, label: 'seconds watched' },
  };
  const active = series[metric];
  const chartPoints = active.points.map(p => ({ x: dayToMs(p.date), y: p.value }));
  const best = o.viewsSeries.reduce<DayPoint | null>((top, p) => (!top || p.value > top.value ? p : top), null);

  return (
    <section className="an-card" style={{ animationDelay: '0.1s' }}>
      <div className="an-card-head">
        <CardTitle icon="chart">Content overview</CardTitle>
        <span className="an-card-sub">{formatDay(dayToMs(o.periodStart))} – {formatDay(dayToMs(o.periodEnd))}</span>
      </div>
      <div className="an-card-body">
        <div className="an-tiles" role="group" aria-label="Choose a metric to chart">
          {tiles.map(tile => (
            <button key={tile.key} className="an-tile" aria-pressed={metric === tile.key} onClick={() => setMetric(tile.key)}>
              <div className="an-tile-label">{tile.label}</div>
              <div className="an-tile-row">
                <span className="an-tile-value">{tile.value}</span>
                <TrendChip trend={tile.trend} />
              </div>
            </button>
          ))}
        </div>

        <div className="an-overview-grid">
          <TimeChart
            points={chartPoints}
            snapTicks
            formatX={formatDay}
            formatTooltipX={formatLongDay}
            valueLabel={active.label}
            ariaLabel={`Daily ${active.label} from ${o.periodStart} to ${o.periodEnd}`}
          />
          <aside className="an-side">
            <div>
              <h3>Views breakdown</h3>
              <small>{formatDay(dayToMs(o.periodStart))} – {formatDay(dayToMs(o.periodEnd))}</small>
            </div>
            <div className="an-side-stat">
              <span>Total views</span>
              <b>{data.viewsAvailable ? o.views.value.toLocaleString() : '--'}</b>
              {data.viewsAvailable && <TrendChip trend={o.views} />}
            </div>
            <div className="an-side-stat"><span>Viewers</span><b>{formatCount(o.viewers)}</b></div>
            <div className="an-side-stat">
              <span>Best day</span>
              <b>{best && best.value > 0 ? formatDay(dayToMs(best.date)) : '--'}</b>
              {best && best.value > 0 && <small style={{ margin: 0 }}>{best.value.toLocaleString()} views</small>}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function Analytics() {
  const { activeOrgId, activeOrg, loading: orgLoading, memberships } = useOrganization();
  const [days, setDays] = useState(28);
  const [showAll, setShowAll] = useState(false);

  // If the user has memberships, ensure we don't query until activeOrgId is fully resolved
  const isResolvingOrg = orgLoading || (memberships.length > 0 && !activeOrgId);

  const { data, error, syncedAt, syncing } = usePolling(
    `${activeOrgId ?? 'personal'}|${days}`,
    !isResolvingOrg,
    () => analyticsApi.getDashboard(activeOrgId, days),
  );

  const scopeName = activeOrg ? activeOrg.orgName : 'your Page';
  const loading = isResolvingOrg || !data;
  const carouselItems = data ? data.content.slice(0, 12) : [];

  return (
    <div className="an-container">
      <div className="an-header">
        <div className="an-header-left">
          <div className="an-breadcrumb">
            <Icon name="chart" />
            <span>Analytics {activeOrg ? `• ${activeOrg.orgName}` : ''}</span>
          </div>
          <h1 className="an-title">Insights &amp; Performance</h1>
          <p className="an-subtitle">
            Live Facebook performance for {scopeName}, synced every few seconds.
          </p>
        </div>
        <div className="an-header-right">
          <div className="an-segment" role="group" aria-label="Date range">
            {RANGES.map(range => (
              <button key={range.days} aria-pressed={days === range.days} onClick={() => setDays(range.days)}>{range.label}</button>
            ))}
          </div>
          <SyncBadge syncing={syncing} syncedAt={syncedAt} />
        </div>
      </div>

      {error && (
        <div className="an-notice error" role="alert">
          <Icon name="info" size={18} />
          <div><strong>Couldn't refresh analytics</strong>Retrying automatically. {data ? 'Showing the last synced numbers.' : ''}</div>
        </div>
      )}

      {loading && !error && <DashboardSkeleton />}

      {!loading && data && (
        <>
          {!data.connected && (
            <div className="an-notice info">
              <Icon name="info" size={18} />
              <div>
                <strong>Facebook Page not connected</strong>
                Connect the Page for {scopeName} in <Link to="/posts">Post Creator</Link> to see views, interactions and comments.
              </div>
            </div>
          )}
          {data.warnings.length > 0 && (
            <div className="an-notice warn">
              <Icon name="info" size={18} />
              <div>
                <strong>Some Facebook data is unavailable</strong>
                {data.warnings.join(' · ')}. If this mentions permissions, reconnect your Page in <Link to="/posts">Post Creator</Link> to grant insights access.
              </div>
            </div>
          )}

          <div className="an-kpi-grid">
            {KPI_CARDS.map((card, i) => (
              <div key={card.label} className="an-kpi-card" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="an-kpi-top">
                  <div className="an-kpi-icon" style={{ background: `${card.color}14`, color: card.color }}>
                    <Icon name={card.icon} size={17} />
                  </div>
                  <span className="an-kpi-label">{card.label}</span>
                </div>
                <p className="an-kpi-value" style={{ color: card.color }}>{card.pick(data)}</p>
              </div>
            ))}
          </div>

          {data.connected && <OverviewCard data={data} />}

          {data.connected && (
            <section className="an-card" style={{ animationDelay: '0.15s' }}>
              <div className="an-card-head">
                <CardTitle icon="trend">Top content by views</CardTitle>
                {data.content.length > 0 && (
                  <button className="an-link-btn" onClick={() => setShowAll(v => !v)}>
                    {showAll ? 'Show top content' : `See all content (${data.content.length})`}
                  </button>
                )}
              </div>
              <div className="an-card-body">
                {data.content.length === 0 && (
                  <div className="an-empty">
                    <div className="an-empty-icon"><Icon name="chart" size={28} stroke={1.3} /></div>
                    <p className="an-empty-title">No posts in this period</p>
                    <p>Posts published to your Facebook Page in the last {days} days will appear here.</p>
                  </div>
                )}
                {data.content.length > 0 && (showAll ? <ContentTable items={data.content} /> : <ContentCarousel items={carouselItems} />)}
              </div>
            </section>
          )}

          {data.connected && data.formats.length > 0 && (
            <section className="an-card" style={{ animationDelay: '0.2s' }}>
              <div className="an-card-head">
                <CardTitle icon="doc">Top content formats</CardTitle>
                <span className="an-card-sub">Posts published in this period</span>
              </div>
              <div className="an-card-body">
                <div className="an-format-grid">
                  <FormatCard title="Published content" stats={data.formats} pick={s => s.published} />
                  <FormatCard title="Views" stats={data.formats} pick={s => s.views} />
                  <FormatCard title="Content interactions" stats={data.formats} pick={s => s.interactions} />
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
