// Location: frontend/src/features/facebook/api/facebookApi.ts
// ACTION: CREATE NEW FILE

import axiosClient from '../../../api/axiosClient';

export interface FacebookPageInfo {
  connected: boolean;
  pageId?: string;
  pageName?: string;
  pageAvatar?: string;
}

export const facebookApi = {
  /**
   * Get Facebook OAuth authorization URL
   */
  getAuthUrl: async (): Promise<{ authUrl: string }> => {
    try {
      const response = await axiosClient.get<{ authUrl: string }>('/api/facebook/auth-url');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get auth URL');
    }
  },

  /**
   * Handle OAuth callback with authorization code
   */
  handleCallback: async (code: string): Promise<any> => {
    try {
      const response = await axiosClient.post('/api/facebook/callback', { code });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to connect Facebook');
    }
  },

  /**
   * Get current user's connected Facebook page info
   */
  getPageInfo: async (): Promise<FacebookPageInfo> => {
    try {
      const response = await axiosClient.get<FacebookPageInfo>('/api/facebook/page-info');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get page info');
    }
  },

  /**
   * Disconnect user's Facebook page
   */
  disconnect: async (): Promise<{ message: string }> => {
    try {
      const response = await axiosClient.post<{ message: string }>('/api/facebook/disconnect', {});
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to disconnect');
    }
  },
};