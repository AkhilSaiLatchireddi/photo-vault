import { useAuth } from '../contexts/AuthContext';
import AuthPage from './AuthPage';
import PhotoDashboard from './PhotoDashboard';

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading PhotoVault...</p>
        </div>
      </div>
    );
  }

  return user ? <PhotoDashboard /> : <AuthPage />;
}