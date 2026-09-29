import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {useAuth } from './context/useAuth';
import { AuthProvider } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { FacebookConnectionProvider } from './context/FacebookConnectionContext';
import Dashboard from './features/dashboard/UnifiedManagementDashboard.tsx';
import HomeDashboard from './features/dashboard/pages/HomeDashboard.tsx';
import CreatePost from './features/posts/pages/CreatePost.tsx';
import FirstTimeSetup from './features/setup/FirstTimeSetup.tsx';
import LoginPage from './features/loginform/pages/LoginPage.tsx';
import RegistrationForm from './features/registrationform/pages/RegisterPage.tsx';
import ForgotPasswordPage from './features/loginform/pages/ForgotPasswordPage.tsx';
import ResetPasswordPage from './features/loginform/pages/ResetPasswordPage.tsx';
import PostManager from './features/posts/pages/PostManager.tsx';
import MediaRepository from './features/media/pages/MediaRepository.tsx';
import CaptionStudio from './features/caption/pages/CaptionStudio.tsx';
import CaptionToneSelection from './features/caption/pages/CaptionToneSelection.tsx';
import Analytics from './features/analytics/pages/Analytics.tsx';
import PostInsights from './features/analytics/pages/PostInsights.tsx';
import OrganizationsPage from './features/organizations/user/pages/OrganizationsPage.tsx';
import OrganizationAdminPage from './features/organizations/admin/pages/OrganizationAdminPage.tsx';

function ProtectedRoute({ children }: Readonly<{ children: ReactNode }>) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center" role="status">Loading…</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const [splashStage, setSplashStage] = useState<'visible' | 'leaving' | 'hidden'>('visible');

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fadeTimer = window.setTimeout(() => setSplashStage('leaving'), reducedMotion ? 100 : 560);
    const removeTimer = window.setTimeout(() => setSplashStage('hidden'), reducedMotion ? 130 : 820);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  return (
    <AuthProvider>
      <OrganizationProvider>
      <FacebookConnectionProvider>
      <BrowserRouter>
        {splashStage !== 'hidden' && (
          <div
            className={`app-splash${splashStage === 'leaving' ? ' app-splash--leaving' : ''}`}
            role="status"
            aria-label="Loading Ugnay"
          >
            <div className="app-splash__brand">
              <img src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
            </div>
            <div className="app-splash__loader" aria-hidden="true"><span /></div>
          </div>
        )}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationForm />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/setup" element={<ProtectedRoute><FirstTimeSetup /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
            <Route index element={<HomeDashboard />} />
            <Route path="create" element={<CreatePost />} />
            <Route path="posts" element={<PostManager />} />
            <Route path="calendar" element={<PostManager />} />
            <Route path="media" element={<MediaRepository />} />
            <Route path="caption" element={<CaptionStudio />} />
            <Route path="caption/select-tone" element={<CaptionToneSelection />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="analytics/posts/:postId" element={<PostInsights />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="organizations/:orgId/manage" element={<OrganizationAdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </FacebookConnectionProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
}