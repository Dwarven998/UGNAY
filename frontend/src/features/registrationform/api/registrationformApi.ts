import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';

export interface RegisterRequest {
  email: string;
  password: string;
  orgName: string;
}

export interface RegisterResponse {
  userId: string;
  orgName: string;
  token: string;
}

export const registrationformApi = {
  register: (data: RegisterRequest) =>
    axiosClient.post<RegisterResponse>('/api/auth/register', data)
      .then((r: ApiResponse<RegisterResponse>) => r.data),
};