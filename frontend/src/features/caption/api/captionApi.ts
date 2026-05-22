import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';

export const captionApi = {
  generate: (imageUrl: string, tone: string) =>
    axiosClient.post<string[]>('/api/caption/generate', { imageUrl, tone }).then((r: ApiResponse<string[]>) => r.data),

  rewrite: (caption: string, tone: string) =>
    axiosClient.post<string>('/api/caption/rewrite', { caption, tone }).then((r: ApiResponse<string>) => r.data),

  hashtags: (caption: string) =>
    axiosClient.post<string[]>('/api/caption/hashtags', { caption }).then((r: ApiResponse<string[]>) => r.data),
};