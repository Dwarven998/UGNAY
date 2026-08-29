import axiosClient from '../../../api/axiosClient';
import type { MediaFolder, MediaAsset, MediaRecommendation } from '../../../types';
import type { ApiResponse } from '../../../api/axiosClient';
import { uploadToSupabase } from '../../../api/supabaseClient';

export const mediaApi = {
  getFolders: (orgId?: string | null) =>
    axiosClient
      .get<MediaFolder[]>(orgId ? `/api/media/folders?orgId=${orgId}` : '/api/media/folders')
      .then((r: ApiResponse<MediaFolder[]>) => r.data),

  createFolder: (name: string, orgId?: string | null) =>
    axiosClient
      .post<MediaFolder>('/api/media/folders', { name, orgId: orgId ?? undefined })
      .then((r: ApiResponse<MediaFolder>) => r.data),

  deleteFolder: (id: string) => axiosClient.delete(`/api/media/folders/${id}`),

  getAssets: (folderId: string) =>
    axiosClient.get<MediaAsset[]>(`/api/media/folders/${folderId}/assets`).then((r: ApiResponse<MediaAsset[]>) => r.data),

  // Upload to Supabase first, then save metadata to backend
  uploadAsset: async (folderId: string, file: File): Promise<MediaAsset> => {
    const path = `${folderId}/${Date.now()}_${file.name}`;
    const fileUrl = await uploadToSupabase(file, path);
    return axiosClient.post<MediaAsset>('/api/media/assets', {
      folderId, fileName: file.name, fileUrl, fileType: file.type,
    }).then((r: ApiResponse<MediaAsset>) => r.data);
  },

  deleteAsset: (id: string) => axiosClient.delete(`/api/media/assets/${id}`),

  recommend: (folderId: string, description: string) =>
    axiosClient
      .post<MediaRecommendation[]>(`/api/media/folders/${folderId}/recommend`, { description })
      .then((r: ApiResponse<MediaRecommendation[]>) => r.data),
};