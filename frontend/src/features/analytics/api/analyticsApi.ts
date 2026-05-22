import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const analyticsApi = {
  getSummary: () => axiosClient.get<any>('/api/analytics/summary').then((r: ApiResponse<any>) => r.data),
  getTopPosts: () => axiosClient.get<any[]>('/api/analytics/top-posts').then((r: ApiResponse<any[]>) => r.data),
  getRecommendation: () => axiosClient.get<any>('/api/analytics/recommendation').then((r: ApiResponse<any>) => r.data),
};