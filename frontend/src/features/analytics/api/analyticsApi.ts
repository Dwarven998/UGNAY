import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';

export interface Trend { value: number; previous: number; changePercent: number | null }
export interface DayPoint { date: string; value: number }

export interface Kpis {
  totalPosts: number;
  publishedPosts: number;
  totalEngagement: number;
  avgEngagement: number;
}

export interface Overview {
  views: Trend;
  threeSecondViews: Trend;
  interactions: Trend;
  watchTimeSeconds: Trend;
  viewers: number | null;
  viewsSeries: DayPoint[];
  threeSecondViewsSeries: DayPoint[];
  interactionsSeries: DayPoint[];
  watchTimeSeries: DayPoint[];
  periodStart: string;
  periodEnd: string;
}

export interface ContentItem {
  id: string;
  message: string;
  createdTime: string | null;
  permalinkUrl: string;
  imageUrl: string;
  format: string;
  views: number | null;
  reactions: number;
  comments: number;
  shares: number;
}

export interface FormatStat { key: string; label: string; published: number; views: number; interactions: number }

export interface Dashboard {
  connected: boolean;
  days: number;
  kpis: Kpis;
  overview: Overview;
  content: ContentItem[];
  formats: FormatStat[];
  viewsAvailable: boolean;
  warnings: string[];
  fetchedAt: number;
}

export interface PostComment {
  id: string;
  message: string;
  createdTime: string | null;
  authorName: string;
  authorId: string;
  authorPicture: string;
  likeCount: number;
  permalinkUrl: string;
  attachmentUrl: string;
  replies: PostComment[];
}

export interface PostDetail {
  id: string;
  message: string;
  createdTime: string | null;
  permalinkUrl: string;
  imageUrl: string;
  format: string;
  views: number | null;
  viewers: number | null;
  linkClicks: number | null;
  interactions: number;
  reactions: number;
  comments: number;
  shares: number;
  series: { t: number; views: number }[];
  trackingSince: string | null;
  typicalViews: number | null;
  comparison: 'above' | 'typical' | 'below' | null;
  commentList: PostComment[];
  commentsComplete: boolean;
  viewsAvailable: boolean;
  fetchedAt: number;
}

const withOrg = (path: string, orgId?: string | null, extra = '') => {
  const params = [orgId ? `orgId=${encodeURIComponent(orgId)}` : '', extra].filter(Boolean).join('&');
  return params ? `${path}?${params}` : path;
};

export const analyticsApi = {
  getDashboard: (orgId: string | null | undefined, days: number) =>
    axiosClient
      .get<Dashboard>(withOrg('/api/analytics/dashboard', orgId, `days=${days}`))
      .then((r: ApiResponse<Dashboard>) => r.data),
  getPostDetail: (orgId: string | null | undefined, fbPostId: string) =>
    axiosClient
      .get<PostDetail>(withOrg(`/api/analytics/posts/${encodeURIComponent(fbPostId)}`, orgId))
      .then((r: ApiResponse<PostDetail>) => r.data),
};
