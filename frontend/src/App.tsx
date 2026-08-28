import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';
import Dashboard from './features/dashboard/UnifiedManagementDashboard.tsx';
import LoginPage from './features/loginform/pages/LoginPage.tsx';
import RegistrationForm from './features/registrationform/pages/RegisterPage.tsx';
import PostManager from './features/posts/pages/PostManager.tsx';
import MediaRepository from './features/media/pages/MediaRepository.tsx';
import CaptionStudio from './features/caption/pages/CaptionStudio.tsx';
import CaptionToneSelection from './features/caption/pages/CaptionToneSelection.tsx';
import Analytics from './features/analytics/pages/Analytics.tsx';
import OrganizationsPage from './features/organizations/user/pages/OrganizationsPage.tsx';
import OrganizationAdminPage from './features/organizations/admin/pages/OrganizationAdminPage.tsx';

function ProtectedRoute({ children }: Readonly<{ children: ReactNode }>) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationForm />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
            <Route index element={<Navigate to="/posts" replace />} />
            <Route path="posts" element={<PostManager />} />
            <Route path="media" element={<MediaRepository />} />
            <Route path="caption" element={<CaptionStudio />} />
            <Route path="caption/select-tone" element={<CaptionToneSelection />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="organizations/:orgId/manage" element={<OrganizationAdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </OrganizationProvider>
    </AuthProvider>
  );
}