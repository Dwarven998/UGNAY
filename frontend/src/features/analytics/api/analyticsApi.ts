import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const analyticsApi = {
  getSummary: (orgId?: string | null) =>
    axiosClient
      .get<any>(orgId ? `/api/analytics/summary?orgId=${orgId}` : '/api/analytics/summary')
      .then((r: ApiResponse<any>) => r.data),
  getTopPosts: (orgId?: string | null) =>
    axiosClient
      .get<any[]>(orgId ? `/api/analytics/top-posts?orgId=${orgId}` : '/api/analytics/top-posts')
      .then((r: ApiResponse<any[]>) => r.data),
  getRecommendation: (orgId?: string | null) =>
    axiosClient
      .get<any>(orgId ? `/api/analytics/recommendation?orgId=${orgId}` : '/api/analytics/recommendation')
      .then((r: ApiResponse<any>) => r.data),
};
