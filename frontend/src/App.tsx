import { useAuth0 } from "@auth0/auth0-react";
import PhotoDashboard from './components/PhotoDashboard'
import AuthPage from './components/AuthPage'
import { photoService } from './services/photoService';
import { useEffect } from 'react';

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
    <div className="min-h-screen">
      {isAuthenticated ? <PhotoDashboard /> : <AuthPage />}
    </div>
  );
};

export default App;