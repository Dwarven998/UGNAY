import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

import axiosClient from '../api/axiosClient.ts';
import { scopedCache } from '../features/posts/postCache';

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

interface GoogleAuthResponse {
  token: string | null;
  userId: string | null;
  orgName: string | null;
  needsOrgName: boolean;
  newAccount: boolean;
  email: string;
}

/** needsOrgName: no account exists for this Google email yet; call again with an organization name to create it. */
export interface GoogleLoginResult {
  needsOrgName: boolean;
  newAccount: boolean;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string, turnstileToken: string) => Promise<void>;
  register: (email: string, password: string, orgName: string, turnstileToken: string) => Promise<void>;
  loginWithGoogle: (accessToken: string, orgName?: string) => Promise<GoogleLoginResult>;
  logout: () => void;
  isLoading: boolean;
  refreshUserProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

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

  const login = async (email: string, password: string, turnstileToken: string) => {
    try {
      const { data } = await axiosClient.post<AuthUser>('/api/auth/login', { email, password, turnstileToken });
      localStorage.setItem('ugnay_token', data.token);
      localStorage.setItem('ugnay_userId', data.userId);
      localStorage.setItem('ugnay_orgName', data.orgName);
      await refreshUserProfile();
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, orgName: string, turnstileToken: string) => {
    try {
      const { data } = await axiosClient.post<AuthUser>('/api/auth/register', { email, password, orgName, turnstileToken });
      localStorage.setItem('ugnay_token', data.token);
      localStorage.setItem('ugnay_userId', data.userId);
      localStorage.setItem('ugnay_orgName', data.orgName);
      await refreshUserProfile();
    } catch (error) {
      throw error;
    }
  };

  const loginWithGoogle = async (accessToken: string, orgName?: string): Promise<GoogleLoginResult> => {
    const { data } = await axiosClient.post<GoogleAuthResponse>('/api/auth/google', { accessToken, orgName });
    if (data.token && data.userId && data.orgName) {
      localStorage.setItem('ugnay_token', data.token);
      localStorage.setItem('ugnay_userId', data.userId);
      localStorage.setItem('ugnay_orgName', data.orgName);
      await refreshUserProfile();
    }
    return { needsOrgName: data.needsOrgName, newAccount: data.newAccount, email: data.email };
  };

  const logout = () => {
    localStorage.clear();
    scopedCache.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, loginWithGoogle, logout, isLoading, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}