import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

import axiosClient from '../api/axiosClient.ts';
import { scopedCache } from '../features/posts/postCache';
import { secureStorage } from '../utils/secureStorage';

import type { OrgProfileFields } from '../types';

interface AuthUser extends OrgProfileFields {
  userId: string;
  orgName: string;
  token: string;
  facebookConnected: boolean;
  facebookPageId: string | null;
  facebookPageName: string | null;
  facebookPagePictureUrl: string | null;
}

interface CurrentUserProfile extends OrgProfileFields {
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
  register: (email: string, password: string, orgName: string, turnstileToken: string, profile?: Partial<OrgProfileFields>) => Promise<void>;
  loginWithGoogle: (accessToken: string, orgName?: string, profile?: Partial<OrgProfileFields>) => Promise<GoogleLoginResult>;
  updateUserProfile: (profile: Partial<OrgProfileFields>) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  refreshUserProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Install active storage protection and purge legacy sensitive credentials from localStorage
  useEffect(() => {
    const cleanup = secureStorage.initStorageProtection();
    return cleanup;
  }, []);

  const refreshUserProfile = async () => {
    try {
      const { data } = await axiosClient.get<CurrentUserProfile>('/api/auth/me');
      if (data && data.userId) {
        setUser({
          ...data,
          token: '', // Session is managed via HttpOnly cookie
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshUserProfile();
  }, []);

  const login = async (email: string, password: string, turnstileToken: string) => {
    try {
      await axiosClient.post<AuthUser>('/api/auth/login', { email, password, turnstileToken });
      secureStorage.purgeSensitiveKeys();
      await refreshUserProfile();
    } catch (error) {
      throw error;
    }
  };

  const register = async (
    email: string,
    password: string,
    orgName: string,
    turnstileToken: string,
    profile?: Partial<OrgProfileFields>
  ) => {
    try {
      await axiosClient.post<AuthUser>('/api/auth/register', {
        email,
        password,
        orgName,
        turnstileToken,
        ...profile,
      });
      secureStorage.purgeSensitiveKeys();
      await refreshUserProfile();
    } catch (error) {
      throw error;
    }
  };

  const loginWithGoogle = async (
    accessToken: string,
    orgName?: string,
    profile?: Partial<OrgProfileFields>
  ): Promise<GoogleLoginResult> => {
    const { data } = await axiosClient.post<GoogleAuthResponse>('/api/auth/google', {
      accessToken,
      orgName,
      ...profile,
    });
    secureStorage.purgeSensitiveKeys();
    if (data.userId && data.orgName) {
      await refreshUserProfile();
    }
    return { needsOrgName: data.needsOrgName, newAccount: data.newAccount, email: data.email };
  };

  const updateUserProfile = async (profile: Partial<OrgProfileFields>) => {
    await axiosClient.patch('/api/auth/profile', profile);
    await refreshUserProfile();
  };

  const logout = () => {
    void axiosClient.post('/api/auth/logout').catch(() => { /* ignore */ });
    secureStorage.clear();
    scopedCache.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        loginWithGoogle,
        updateUserProfile,
        logout,
        isLoading,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}