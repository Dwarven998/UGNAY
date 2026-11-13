import axiosClient from '../../../api/axiosClient';
import type { UserProfile } from '../../../types';

type MessageResponse = { message: string };

/** Every call acts on the signed-in session only — no user id is ever sent. */
export const profileApi = {
  get: () => axiosClient.get<UserProfile>('/api/profile').then(r => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    axiosClient.post<MessageResponse>('/api/profile/password', { currentPassword, newPassword }).then(r => r.data),

  sendResetLink: () =>
    axiosClient.post<MessageResponse>('/api/profile/password/reset-link').then(r => r.data),
};
