import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import ProfilePage from './features/profile/pages/ProfilePage.tsx';
import { NetworkStatusBanner } from './components/errors/NetworkStatusBanner';
import './components/ui/dialog.css';
import './components/errors/errors.css';

function SessionCheckScreen() {
  // The hosted backend sleeps when idle and can take a while to wake; say so instead of a bare "Loading…".
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 text-center" role="status">
      <p>Checking your session…</p>
      {slow && <p className="text-sm opacity-70">The server is waking up. This can take up to a minute.</p>}
    </div>
  );
}

/** The session could not be checked (offline, server down or still waking up): retry instead of signing out. */
function SessionUnavailableScreen({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    setRetrying(true);
    void Promise.resolve(onRetry()).finally(() => setRetrying(false));
  };
  return (
    <div className="ug-session-unavailable" role="alert">
      <p>{message}</p>
      <p className="text-sm opacity-70">You are still signed in. Check your connection, then try again.</p>
      <button type="button" className="ug-btn ug-btn-primary" onClick={retry} disabled={retrying}>
        {retrying ? 'Checking…' : 'Try again'}
      </button>
    </div>
  );
}

function ProtectedRoute({ children }: Readonly<{ children: ReactNode }>) {
  const { user, isLoading, sessionError, refreshUserProfile } = useAuth();
  const location = useLocation();
  if (isLoading) return <SessionCheckScreen />;
  if (user) return <>{children}</>;
  if (sessionError) return <SessionUnavailableScreen message={sessionError} onRetry={refreshUserProfile} />;
  // Remember where the user was so signing in brings them back there.
  return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
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
        <NetworkStatusBanner />
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
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </FacebookConnectionProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
}