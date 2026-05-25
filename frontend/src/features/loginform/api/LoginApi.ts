import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  userId: string;
  orgName: string;
  token: string;
}

export const loginformApi = {
  login: (credentials: LoginRequest) =>
    axiosClient.post<LoginResponse>('/api/auth/login', credentials)
      .then((r: ApiResponse<LoginResponse>) => r.data),
};