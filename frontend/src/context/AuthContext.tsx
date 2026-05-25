import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

import axiosClient from '../api/axiosClient.ts';

interface AuthUser {
  userId: string;
  orgName: string;
  token: string;
  facebookConnected: boolean;
  facebookPageId: string | null;
  facebookPageName: string | null;
  facebookPagePictureUrl: string | null;
}

interface CurrentUserProfile {
  userId: string;
  orgName: string;
  facebookConnected: boolean;
  facebookPageId: string | null;
  facebookPageName: string | null;
  facebookPagePictureUrl: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, orgName: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserProfile = async () => {
    const token = localStorage.getItem('ugnay_token');
    const userId = localStorage.getItem('ugnay_userId');
    const orgName = localStorage.getItem('ugnay_orgName');

    if (!token || !userId || !orgName) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const baseUser: AuthUser = {
      token,
      userId,
      orgName,
      facebookConnected: false,
      facebookPageId: null,
      facebookPageName: null,
      facebookPagePictureUrl: null,
    };

    try {
      const { data } = await axiosClient.get<CurrentUserProfile>('/api/auth/me');
      setUser({ ...baseUser, ...data, token });
    } catch {
      setUser(baseUser);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshUserProfile();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await axiosClient.post<AuthUser>('/api/auth/login', { email, password });
    localStorage.setItem('ugnay_token', data.token);
    localStorage.setItem('ugnay_userId', data.userId);
    localStorage.setItem('ugnay_orgName', data.orgName);
    await refreshUserProfile();
  };

  const register = async (email: string, password: string, orgName: string) => {
    const { data } = await axiosClient.post<AuthUser>('/api/auth/register', { email, password, orgName });
    localStorage.setItem('ugnay_token', data.token);
    localStorage.setItem('ugnay_userId', data.userId);
    localStorage.setItem('ugnay_orgName', data.orgName);
    await refreshUserProfile();
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};