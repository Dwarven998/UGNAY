import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/analyticsApi.ts';
import { useOrganization } from '../../../context/OrganizationContext';

// Keeps the panel in sync with live Facebook engagement without a manual refresh.
const REFRESH_INTERVAL_MS = 30_000;

export default function Analytics() {
  const { activeOrgId, activeOrg, loading: orgLoading, memberships } = useOrganization();
  const [summary, setSummary] = useState<any>(null);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // If the user has memberships, ensure we don't query until activeOrgId is fully resolved
  const isResolvingOrg = orgLoading || (memberships.length > 0 && !activeOrgId);

  useEffect(() => {
    if (isResolvingOrg) return;

    let cancelled = false;

    const fetchAll = (forceSync = false) => {
      analyticsApi.getSummary(activeOrgId, forceSync).then((data) => {
        if (!cancelled) {
          setSummary(data);
          setLastSyncedAt(new Date());
        }
      });
      analyticsApi.getTopPosts(activeOrgId).then((posts) => {
        if (!cancelled) setTopPosts(posts);
      });
      analyticsApi.getRecommendation(activeOrgId).then((rec) => {
        if (!cancelled) setRecommendation(rec);
      });
    };

    setSummary(null);
    setTopPosts([]);
    setRecommendation(null);
    fetchAll();

    const interval = setInterval(() => fetchAll(false), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeOrgId, isResolvingOrg]);

  const handleSyncNow = async () => {
    if (isSyncing || isResolvingOrg) return;
    setIsSyncing(true);
    try {
      const [newSummary, newTopPosts, newRec] = await Promise.all([
        analyticsApi.sync(activeOrgId),
        analyticsApi.getTopPosts(activeOrgId),
        analyticsApi.getRecommendation(activeOrgId),
      ]);
      setSummary(newSummary);
      setTopPosts(newTopPosts);
      setRecommendation(newRec);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to sync analytics:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const kpiCards = summary ? [
    { label: 'Total Posts',       value: summary.totalPosts,              icon: '📋', color: '#0C447C' },
    { label: 'Published',         value: summary.publishedPosts,          icon: '🚀', color: '#059669' },
    { label: 'Total Engagement',  value: summary.totalEngagement,         icon: '💬', color: '#7c3aed' },
    { label: 'Avg Engagement',    value: summary.avgEngagement.toFixed(1),icon: '📈', color: '#f59e0b' },
  ] : [];

  return (
    <>
      <div className="an-container">
        {/* Header */}
        <div className="an-header" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="an-header-left">
            <div className="an-breadcrumb">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Analytics {activeOrg ? `• ${activeOrg.orgName}` : ''}</span>
            </div>
            <h1 className="an-title">Insights &amp; Performance</h1>
            <p className="an-subtitle">
              {activeOrg
                ? `Real-time social media performance and smart recommendations for ${activeOrg.orgName}.`
                : 'Track your organization\'s social media performance and get smart recommendations.'}
            </p>
          </div>

          <div className="an-header-right">
            <div className="an-sync-meta">
              <span className="an-pulse-badge">
                <span className="an-pulse-dot" />
                Live Sync Active
              </span>
              <span className="an-sync-time">
                {lastSyncedAt
                  ? `Updated ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Auto-syncing (30s)'}
              </span>
            </div>
            <button
              type="button"
              className="an-sync-btn"
              onClick={handleSyncNow}
              disabled={isSyncing || isResolvingOrg}
              title="Fetch latest live reactions and comments from Facebook"
            >
              <svg
                className={`an-sync-icon ${isSyncing ? 'spinning' : ''}`}
                width="16"
                height="16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* Loading placeholder while organization context or summary initializes */}
        {(isResolvingOrg || !summary) && (
          <div className="an-loading-state" style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="an-pulse-badge" style={{ padding: '8px 18px', fontSize: '13px' }}>
              <span className="an-pulse-dot" />
              Loading {activeOrg ? activeOrg.orgName : 'organization'} analytics...
            </div>
          </div>
        )}

        {/* Notice if published posts exist but engagement is 0 */}
        {!isResolvingOrg && summary && summary.publishedPosts > 0 && summary.totalEngagement === 0 && (
          <div className="an-reconnect-notice">
            <div className="an-notice-icon">💬</div>
            <div className="an-notice-text">
              <strong>Reactions or Comments Not Appearing?</strong>
              <span>
                If members recently reacted to your Facebook post, make sure your Facebook Page connection has granted the updated reaction permissions.
                You can quickly reconnect your Page in <Link to="/posts">Post Creator</Link> to ensure all live reaction insights sync.
              </span>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {!isResolvingOrg && summary && (
          <div className="an-kpi-grid">
            {kpiCards.map((card, i) => (
              <div key={card.label} className="an-kpi-card" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="an-kpi-top">
                  <div className="an-kpi-icon" style={{ background: `${card.color}10`, color: card.color }}>
                    <span>{card.icon}</span>
                  </div>
                  <span className="an-kpi-label">{card.label}</span>
                </div>
                <p className="an-kpi-value" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recommendation */}
        {!isResolvingOrg && summary && recommendation && (
          <div className="an-rec-card" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s backwards' }}>
            <div className="an-rec-glow"></div>
            <div className="an-rec-content">
              <div className="an-rec-icon">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="an-rec-text">
                <h3 className="an-rec-headline">{recommendation.headline}</h3>
                <p className="an-rec-detail">{recommendation.detail}</p>
                {!recommendation.personalized && (
                  <div className="an-rec-unlock">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Publish at least 5 posts to unlock personalized recommendations.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top Posts */}
        {!isResolvingOrg && summary && (
          <div className="an-top-card" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.25s backwards' }}>
            <div className="an-top-header">
              <div className="an-top-header-left">
                <div className="an-top-header-icon">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h2 className="an-top-title">Top Performing Posts</h2>
              </div>
            </div>
            <div className="an-top-body">
              {topPosts.map((post, i) => (
                <div key={post.id} className="an-top-row" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="an-top-rank">
                    <span className={`an-rank-badge ${i === 0 ? 'gold' : i === 1 ? 'silver' : 'bronze'}`}>
                      {i + 1}
                    </span>
                  </div>
                  <div className="an-top-info">
                    <p className="an-top-caption">{post.captionPreview}...</p>
                    <p className="an-top-date">
                      {post.publishedAt && new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="an-top-engagement">
                    <span className="an-engagement-value">{post.totalEngagement}</span>
                    <span className="an-engagement-label">engagements</span>
                  </div>
                </div>
              ))}
              {topPosts.length === 0 && (
                <div className="an-top-empty">
                  <div className="an-top-empty-icon">
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="an-top-empty-title">No published posts yet</p>
                  <p className="an-top-empty-text">Publish some posts to see your analytics here.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .an-container {
          padding: 36px 40px 48px;
          max-width: 1060px;
          margin: 0 auto;
        }

        /* Header */
        .an-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .an-header-left {
          flex: 1;
          min-width: 260px;
        }
        .an-header-right {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 4px;
        }
        .an-sync-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .an-pulse-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #059669;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 9999px;
          letter-spacing: 0.02em;
        }
        .an-pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: anPulse 1.8s infinite;
        }
        @keyframes anPulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .an-sync-time {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }
        .an-sync-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          background: #0C447C;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(12, 68, 124, 0.18);
        }
        .an-sync-btn:hover:not(:disabled) {
          background: #093561;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(12, 68, 124, 0.28);
        }
        .an-sync-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .an-sync-icon.spinning {
          animation: anSpin 0.9s linear infinite;
        }
        @keyframes anSpin {
          100% { transform: rotate(360deg); }
        }

        /* Notice Banner */
        .an-reconnect-notice {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 14px;
          padding: 14px 18px;
          margin-bottom: 24px;
          color: #1e3a8a;
          font-size: 13px;
          line-height: 1.5;
          animation: fadeUp 0.35s ease;
        }
        .an-notice-icon {
          font-size: 20px;
          line-height: 1;
        }
        .an-notice-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .an-notice-text strong {
          color: #1e40af;
          font-size: 13px;
          font-weight: 700;
        }
        .an-notice-text span {
          color: #1e3a8a;
        }
        .an-notice-text a {
          color: #0C447C;
          font-weight: 700;
          text-decoration: underline;
        }

        .an-breadcrumb {
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
        .an-title {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.03em;
          margin: 0 0 6px;
        }
        .an-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        /* KPI Grid */
        .an-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .an-kpi-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 22px;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) backwards;
        }
        .an-kpi-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 8px 24px rgba(0,0,0,0.06);
          transform: translateY(-2px);
        }
        .an-kpi-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        .an-kpi-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }
        .an-kpi-label {
          font-size: 13px;
          font-weight: 500;
          color: #64748b;
        }
        .an-kpi-value {
          font-size: 36px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        /* Recommendation */
        .an-rec-card {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          padding: 24px 28px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }
        .an-rec-glow {
          position: absolute;
          top: -40px; right: -40px;
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .an-rec-content {
          display: flex;
          gap: 18px;
          position: relative;
          z-index: 1;
        }
        .an-rec-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, rgba(12,68,124,0.08), rgba(59,130,246,0.08));
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0C447C;
          flex-shrink: 0;
        }
        .an-rec-text { flex: 1; }
        .an-rec-headline {
          font-size: 16px;
          font-weight: 700;
          color: #0C447C;
          margin: 0 0 6px;
        }
        .an-rec-detail {
          font-size: 13px;
          color: #475569;
          line-height: 1.6;
          margin: 0;
        }
        .an-rec-unlock {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 8px 14px;
          background: rgba(12,68,124,0.04);
          border: 1px solid rgba(12,68,124,0.08);
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          color: #0C447C;
        }

        /* Top Posts */
        .an-top-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .an-top-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 28px;
          background: linear-gradient(135deg, rgba(12,68,124,0.03) 0%, rgba(59,130,246,0.02) 100%);
          border-bottom: 1px solid #f1f5f9;
        }
        .an-top-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .an-top-header-icon {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #0C447C, #3b82f6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .an-top-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .an-top-body {
          padding: 8px 16px;
        }
        .an-top-row {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 16px 12px;
          border-radius: 12px;
          transition: all 0.15s;
          animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) backwards;
        }
        .an-top-row:hover {
          background: #f8fafc;
        }
        .an-top-row + .an-top-row {
          border-top: 1px solid #f8fafc;
        }
        .an-top-rank {
          flex-shrink: 0;
        }
        .an-rank-num {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px; height: 32px;
          border-radius: 10px;
          background: #f1f5f9;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 700;
        }
        .an-rank-top {
          background: linear-gradient(135deg, #0C447C, #3b82f6);
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(12,68,124,0.2);
        }
        .an-top-info {
          flex: 1;
          min-width: 0;
        }
        .an-top-caption {
          font-size: 14px;
          font-weight: 500;
          color: #334155;
          margin: 0 0 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .an-top-date {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }
        .an-top-engagement {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          flex-shrink: 0;
          padding-left: 16px;
          border-left: 1px solid #f1f5f9;
        }
        .an-engagement-value {
          font-size: 22px;
          font-weight: 800;
          color: #059669;
          line-height: 1;
        }
        .an-engagement-label {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-top: 2px;
        }

        /* Empty state */
        .an-top-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 56px 24px;
          text-align: center;
        }
        .an-top-empty-icon {
          width: 64px; height: 64px;
          background: linear-gradient(135deg, rgba(12,68,124,0.04), rgba(59,130,246,0.06));
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #cbd5e1;
          margin-bottom: 16px;
        }
        .an-top-empty-title {
          font-size: 16px;
          font-weight: 700;
          color: #334155;
          margin: 0 0 6px;
        }
        .an-top-empty-text {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        @media (max-width: 1024px) {
          .an-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .an-container { padding: 24px 20px; }
          .an-kpi-grid { grid-template-columns: 1fr; }
          .an-top-row { flex-direction: column; align-items: flex-start; }
          .an-top-engagement { border-left: none; padding-left: 0; border-top: 1px solid #f1f5f9; padding-top: 10px; align-items: flex-start; }
          .an-rec-content { flex-direction: column; }
        }
      `}</style>
    </>
  );
}