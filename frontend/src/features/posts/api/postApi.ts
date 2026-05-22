import axiosClient from '../../../api/axiosClient';
import type { Post } from '../../../types';
import type { ApiResponse } from '../../../api/axiosClient';

export const postApi = {
  getAll: () => axiosClient.get<Post[]>('/api/posts').then((r: ApiResponse<Post[]>) => r.data),

  create: (data: {
    caption: string; hashtags: string[]; tone: string;
    mediaAssetId?: string; scheduledAt?: string;
  }) => axiosClient.post<Post>('/api/posts', data).then((r: ApiResponse<Post>) => r.data),

  update: (id: string, data: Partial<Post>) =>
    axiosClient.put<Post>(`/api/posts/${id}`, data).then((r: ApiResponse<Post>) => r.data),

  delete: (id: string) => axiosClient.delete(`/api/posts/${id}`),

  publish: (id: string) => axiosClient.post<Post>(`/api/posts/${id}/publish`).then((r: ApiResponse<Post>) => r.data),
};