import { useAuth0 } from "@auth0/auth0-react";
import PhotoDashboard from './components/PhotoDashboard'
import AuthPage from './components/AuthPage'

const App = () => {
  const { isLoading, error, isAuthenticated } = useAuth0();

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