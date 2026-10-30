import type { Recommendation } from '../api/analyticsApi';
import { Icon } from './icons';

export interface RecommendationCardProps {
  recommendation?: Recommendation | null;
  data?: Recommendation | null;
  loading?: boolean;
  error?: string | boolean | null;
}

export default function RecommendationCard({
  recommendation,
  data,
  loading = false,
  error = null,
}: Readonly<RecommendationCardProps>) {
  if (loading) {
    return (
      <section className="an-card an-rec-card" aria-busy="true" aria-label="Loading posting recommendation">
        <div className="an-card-head">
          <div className="an-card-title">
            <span className="an-card-badge">
              <Icon name="sparkles" size={15} />
            </span>
            Posting Recommendation
          </div>
          <div className="an-skel" style={{ width: 130, height: 24, borderRadius: 9999 }} />
        </div>
        <div className="an-card-body">
          <div className="an-skel" style={{ width: '50%', height: 22, marginBottom: 12, borderRadius: 6 }} />
          <div className="an-skel" style={{ width: '80%', height: 16, borderRadius: 6 }} />
        </div>
      </section>
    );
  }

  if (error) {
    const errorMsg = typeof error === 'string' && error.trim().length > 0
      ? error
      : "Couldn't load the posting recommendation.";
    return (
      <div className="an-notice error an-rec-error" role="alert">
        <Icon name="info" size={18} />
        <div>
          <strong>Posting Recommendation</strong>
          <span>{errorMsg}</span>
        </div>
      </div>
    );
  }

  const rec = recommendation ?? data;
  if (!rec) {
    return null;
  }

  const badgeText = rec.personalized ? 'Based on your top 5 posts' : 'General tip';

  return (
    <section className="an-card an-rec-card" style={{ animationDelay: '0.08s' }}>
      <div className="an-card-head">
        <h2 className="an-card-title">
          <span className="an-card-badge">
            <Icon name="sparkles" size={15} />
          </span>
          Posting Recommendation
        </h2>
        <span className={`an-rec-badge ${rec.personalized ? 'personalized' : 'general'}`}>
          {badgeText}
        </span>
      </div>
      <div className="an-card-body">
        <h3 className="an-rec-headline">{rec.headline}</h3>
        <p className="an-rec-detail">{rec.detail}</p>
      </div>
    </section>
  );
}

