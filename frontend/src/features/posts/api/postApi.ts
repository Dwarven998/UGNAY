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
  getAll: (orgId?: string | null) =>
    axiosClient
      .get<Post[]>(orgId ? `/api/posts?orgId=${orgId}` : '/api/posts')
      .then((r: ApiResponse<Post[]>) => r.data),

  create: (data: PostUpsertPayload, orgId?: string | null) =>
    axiosClient.post<Post>('/api/posts', { ...data, orgId: orgId ?? undefined }).then((r: ApiResponse<Post>) => r.data),

  update: (id: string, data: PostUpsertPayload, orgId?: string | null) =>
    axiosClient.put<Post>(`/api/posts/${id}`, { ...data, orgId: orgId ?? undefined }).then((r: ApiResponse<Post>) => r.data),

  delete: (id: string) => axiosClient.delete(`/api/posts/${id}`),

  publish: (id: string) => axiosClient.post<Post>(`/api/posts/${id}/publish`).then((r: ApiResponse<Post>) => r.data),

  getModerationQueue: (orgId: string) =>
    axiosClient.get<Post[]>(`/api/posts/moderation?orgId=${orgId}`).then((r: ApiResponse<Post[]>) => r.data),

  approve: (id: string) => axiosClient.post<Post>(`/api/posts/${id}/approve`).then((r: ApiResponse<Post>) => r.data),

  reject: (id: string) => axiosClient.post<Post>(`/api/posts/${id}/reject`).then((r: ApiResponse<Post>) => r.data),

  // Appeals: a member requests edit/cancel on a SCHEDULED org post; officer/admin resolves it.
  requestAppeal: (id: string, type: 'EDIT' | 'CANCEL') =>
    axiosClient.post<Post>(`/api/posts/${id}/appeal`, { type }).then((r: ApiResponse<Post>) => r.data),

  approveAppeal: (id: string) => axiosClient.post<void>(`/api/posts/${id}/appeal/approve`),

  rejectAppeal: (id: string) => axiosClient.post<void>(`/api/posts/${id}/appeal/reject`),
};
