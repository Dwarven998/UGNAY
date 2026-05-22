import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './features/auth/pages/AuthPage.tsx';
import Dashboard from './features/pages/Dashboard.tsx';
import PostManager from './features/posts/pages/PostManager.tsx';
import MediaRepository from './features/media/pages/MediaRepository.tsx';
import CaptionStudio from './features/caption/pages/CaptionStudio.tsx';
import Analytics from './features/analytics/pages/Analytics.tsx';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
            <Route index element={<Navigate to="/posts" replace />} />
            <Route path="posts" element={<PostManager />} />
            <Route path="media" element={<MediaRepository />} />
            <Route path="caption" element={<CaptionStudio />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}