import axiosClient from '../../../api/axiosClient';

export const authApi = {
  login: (email: string, password: string) =>
    axiosClient.post('/api/auth/login', { email, password }).then(r => r.data),
  register: (email: string, password: string, orgName: string) =>
    axiosClient.post('/api/auth/register', { email, password, orgName }).then(r => r.data),
};