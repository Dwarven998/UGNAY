import axiosClient from '../../../api/axiosClient';
import type { MediaFolder, MediaAsset, MediaBulkDeleteResult, MediaRecommendation } from '../../../types';
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
  uploadAsset: async (folderId: string, file: File, onProgress?: (fraction: number) => void): Promise<MediaAsset> => {
    const path = `${folderId}/${Date.now()}_${file.name}`;
    const fileUrl = await uploadToSupabase(file, path, onProgress);
    return axiosClient.post<MediaAsset>('/api/media/assets', {
      folderId, fileName: file.name, fileUrl, fileType: file.type, fileSize: file.size,
    }).then((r: ApiResponse<MediaAsset>) => r.data);
  },

  deleteAsset: (id: string) => axiosClient.delete(`/api/media/assets/${id}`),

  /** Deletes what it can; files in use by a post (or not the caller's to delete) come back in `skipped`. */
  deleteAssets: (assetIds: string[]) =>
    axiosClient
      .post<MediaBulkDeleteResult>('/api/media/assets/bulk-delete', { assetIds })
      .then((r: ApiResponse<MediaBulkDeleteResult>) => r.data),

  renameFolder: (id: string, name: string) =>
    axiosClient
      .patch<MediaFolder>(`/api/media/folders/${id}`, { name })
      .then((r: ApiResponse<MediaFolder>) => r.data),

  recommend: (folderId: string, description: string) =>
    axiosClient
      .post<MediaRecommendation[]>(`/api/media/folders/${folderId}/recommend`, { description })
      .then((r: ApiResponse<MediaRecommendation[]>) => r.data),

  // Caption Studio: multi-image selection made in Media Repository
  generateCaptionFromAssets: (assetIds: string[], tone: string, orgId?: string | null, notes?: string) =>
    axiosClient
      .post<string[]>('/api/media/assets/generate-caption', {
        assetIds,
        tone,
        orgId: orgId ?? null,
        notes: notes?.trim() || undefined,
      })
      .then((r: ApiResponse<string[]>) => r.data),
};