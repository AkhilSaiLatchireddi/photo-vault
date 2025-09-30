import { useAuth0 } from "@auth0/auth0-react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { photoService } from './services/photoService';

// Lazy load page components for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const AlbumsListPage = lazy(() => import('./pages/AlbumsListPage'));
const AlbumDetailPage = lazy(() => import('./pages/AlbumDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PublicAlbumViewer = lazy(() => import('./components/PublicAlbumViewer'));
const AuthPage = lazy(() => import('./components/AuthPage'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

const App = () => {
  const { isLoading, error, isAuthenticated, getAccessTokenSilently } = useAuth0();

  // Initialize photo service with Auth0 token getter
  useEffect(() => {
    const getToken = async () => {
      try {
        const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
        return await getAccessTokenSilently({
          authorizationParams: {
            ...(audience ? { audience } : {})
          }
        });
      } catch (error) {
        console.error('Error getting token:', error);
        return null;
      }
    };

    photoService.initialize(getToken);
  }, [getAccessTokenSilently]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">
          <h1>Error</h1>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/album/public/:token" element={<PublicAlbumViewer />} />
            
            {/* Protected routes */}
            {isAuthenticated ? (
              <>
                <Route path="/" element={<HomePage />} />
                <Route path="/photos" element={<HomePage />} />
                <Route path="/photos/:photoId" element={<HomePage />} />
                <Route path="/albums" element={<AlbumsListPage />} />
                <Route path="/albums/:albumId" element={<AlbumDetailPage />} />
                <Route path="/albums/:albumId/photos/:photoId" element={<AlbumDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </>
            ) : (
              <>
                <Route path="/" element={<AuthPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
            
            {/* Fallback for authenticated users */}
            {isAuthenticated && <Route path="*" element={<Navigate to="/" replace />} />}
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
};

export default App;