import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';
import { toCaptionImage } from '../captionImage';

interface RewriteResponse {
  rewritten: string;
}
export const captionApi = {
  generate: async (imageUrl: string, tone: string, orgId?: string | null, notes?: string) => {
    const image = await toCaptionImage(imageUrl);
    return axiosClient
      .post<string[]>('/api/caption/generate', {
        imageUrl: image,
        tone,
        orgId: orgId ?? null,
        notes: notes?.trim() || undefined,
      })
      .then((r: ApiResponse<string[]>) => r.data);
  },

  rewrite: async (caption: string, tone: string, orgId?: string | null, notes?: string, imageUrl?: string) => {
    const image = imageUrl ? await toCaptionImage(imageUrl) : undefined;
    return axiosClient
      .post<RewriteResponse>('/api/caption/rewrite', {
        caption,
        tone,
        orgId: orgId ?? null,
        notes: notes?.trim() || undefined,
        imageUrl: image,
      })
      .then((r: ApiResponse<RewriteResponse>) => r.data.rewritten);
  },

  hashtags: async (caption: string, orgId?: string | null, imageUrl?: string) => {
    const image = imageUrl ? await toCaptionImage(imageUrl) : undefined;
    return axiosClient
      .post<string[]>('/api/caption/hashtags', {
        caption,
        orgId: orgId ?? null,
        imageUrl: image,
      })
      .then((r: ApiResponse<string[]>) => r.data);
  },
};
