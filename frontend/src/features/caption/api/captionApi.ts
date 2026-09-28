import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';
import { toCaptionImage } from '../captionImage';

interface RewriteResponse {
  rewritten: string;
}
export const captionApi = {
  generate: async (imageUrl: string, tone: string) => {
    const image = await toCaptionImage(imageUrl);
    return axiosClient.post<string[]>('/api/caption/generate', { imageUrl: image, tone }).then((r: ApiResponse<string[]>) => r.data);
  },

  rewrite: (caption: string, tone: string) =>
    axiosClient
      .post<RewriteResponse>('/api/caption/rewrite', { caption, tone })
      .then((r: ApiResponse<RewriteResponse>) => r.data.rewritten),

  hashtags: (caption: string) =>
    axiosClient.post<string[]>('/api/caption/hashtags', { caption }).then((r: ApiResponse<string[]>) => r.data),
};
