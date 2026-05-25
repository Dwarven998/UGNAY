import axiosClient from '../../../api/axiosClient';
import type { Post } from '../../../types';
import type { ApiResponse } from '../../../api/axiosClient';

export interface PostUpsertPayload {
  caption: string;
  hashtags: string[];
  tone: string;
  mediaAssetId?: string;
  scheduledAt?: string;
}

export const postApi = {
  getAll: () => axiosClient.get<Post[]>('/api/posts').then((r: ApiResponse<Post[]>) => r.data),

  create: (data: PostUpsertPayload) => axiosClient.post<Post>('/api/posts', data).then((r: ApiResponse<Post>) => r.data),

  update: (id: string, data: PostUpsertPayload) =>
    axiosClient.put<Post>(`/api/posts/${id}`, data).then((r: ApiResponse<Post>) => r.data),

  delete: (id: string) => axiosClient.delete(`/api/posts/${id}`),

  publish: (id: string) => axiosClient.post<Post>(`/api/posts/${id}/publish`).then((r: ApiResponse<Post>) => r.data),
};