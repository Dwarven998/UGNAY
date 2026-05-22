import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axiosClient from '../api/axiosClient.ts';

interface AuthUser { userId: string; orgName: string; token: string; }

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, orgName: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ugnay_token');
    const userId = localStorage.getItem('ugnay_userId');
    const orgName = localStorage.getItem('ugnay_orgName');
    queueMicrotask(() => {
      if (token && userId && orgName) setUser({ token, userId, orgName });
      setIsLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await axiosClient.post<AuthUser>('/api/auth/login', { email, password });
    localStorage.setItem('ugnay_token', data.token);
    localStorage.setItem('ugnay_userId', data.userId);
    localStorage.setItem('ugnay_orgName', data.orgName);
    setUser({ token: data.token, userId: data.userId, orgName: data.orgName });
  };

  const register = async (email: string, password: string, orgName: string) => {
    const { data } = await axiosClient.post<AuthUser>('/api/auth/register', { email, password, orgName });
    localStorage.setItem('ugnay_token', data.token);
    localStorage.setItem('ugnay_userId', data.userId);
    localStorage.setItem('ugnay_orgName', data.orgName);
    setUser({ token: data.token, userId: data.userId, orgName: data.orgName });
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};