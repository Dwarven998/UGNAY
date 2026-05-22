// features/analytics/pages/Analytics.tsx
import { useEffect, useState } from 'react';
import { analyticsApi } from '../api/analyticsApi.ts';

export default function Analytics() {
  const [summary, setSummary] = useState<any>(null);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<any>(null);

  useEffect(() => {
    analyticsApi.getSummary().then(setSummary);
    analyticsApi.getTopPosts().then(setTopPosts);
    analyticsApi.getRecommendation().then(setRecommendation);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics & Insights</h1>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Posts', value: summary.totalPosts },
            { label: 'Published', value: summary.publishedPosts },
            { label: 'Total Engagement', value: summary.totalEngagement },
            { label: 'Avg Engagement', value: summary.avgEngagement.toFixed(1) },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl shadow p-5">
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="font-semibold text-blue-800">💡 {recommendation.headline}</p>
          <p className="text-sm text-blue-700 mt-1">{recommendation.detail}</p>
          {!recommendation.personalized && (
            <p className="text-xs text-blue-500 mt-2">
              Publish at least 5 posts to unlock personalized recommendations.
            </p>
          )}
        </div>
      )}

      {/* Top posts */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-lg mb-4">🏆 Top Performing Posts</h2>
        <div className="space-y-3">
          {topPosts.map((post, i) => (
            <div key={post.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-2xl font-bold text-gray-300">#{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm">{post.captionPreview}...</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {post.publishedAt && new Date(post.publishedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-700">{post.totalEngagement}</p>
                <p className="text-xs text-gray-400">engagement</p>
              </div>
            </div>
          ))}
          {topPosts.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">
              No published posts yet. Publish some posts to see analytics!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}