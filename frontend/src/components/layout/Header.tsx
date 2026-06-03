import { useAuth0 } from '@auth0/auth0-react';
import { Link, useLocation } from 'react-router-dom';
import { Grid, User, LogOut, Home, HelpCircle, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { photoService } from '../../services/photoService';
import { config } from '../../config/env';

interface HeaderProps {
  showNavigation?: boolean;
}

const API_BASE_URL = config.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function Header({ showNavigation = true }: HeaderProps) {
  const { user, logout, getAccessTokenSilently } = useAuth0();
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Fetch the DB profile picture (may differ from Auth0's picture after user uploads own avatar)
  useEffect(() => {
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
    getAccessTokenSilently({ authorizationParams: audience ? { audience } : {} })
      .then(token =>
        fetch(`${API_BASE_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      )
      .then(r => r.json())
      .then(d => { if (d?.data?.picture) setAvatarUrl(d.data.picture); })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    photoService.clearAllCaches();
    // Build the correct return URL including the /photo-vault base path on GitHub Pages
    const base = window.location.hostname === 'akhilsailatchireddi.github.io'
      ? `${window.location.origin}/photo-vault`
      : window.location.origin;
    logout({ logoutParams: { returnTo: base } });
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleReportIssue = () => {
    const issueUrl = 'https://github.com/AkhilSaiLatchireddi/photo-vault/issues/new?title=Issue%20Report&body=**Describe%20the%20issue:**%0A%0A**Steps%20to%20reproduce:**%0A%0A**Expected%20behavior:**%0A%0A**Actual%20behavior:**';
    window.open(issueUrl, '_blank');
    setShowHelp(false);
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 border-b border-blue-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center group">
            <div className="mr-3 ring-2 ring-white/50 group-hover:ring-white rounded-full transition-all shadow-md">
              {avatarUrl || user?.picture ? (
                <img
                  src={avatarUrl ?? user?.picture}
                  alt="avatar"
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">PhotoVault</h1>
              <p className="text-xs text-blue-100">
                {user?.name || user?.email}
              </p>
            </div>
          </Link>
          
          {showNavigation && (
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className={`flex items-center px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                  isActive('/') || isActive('/photos')
                    ? 'bg-white text-indigo-700 shadow-md'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                <Home className="h-4 w-4 mr-2" />
                Photos
              </Link>
              <Link
                to="/albums"
                className={`flex items-center px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                  isActive('/albums')
                    ? 'bg-white text-indigo-700 shadow-md'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                <Grid className="h-4 w-4 mr-2" />
                Albums
              </Link>
              <Link
                to="/people"
                className={`flex items-center px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                  location.pathname.startsWith('/people')
                    ? 'bg-white text-indigo-700 shadow-md'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                <Users className="h-4 w-4 mr-2" />
                People
              </Link>
              <Link
                to="/profile"
                className={`flex items-center px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                  isActive('/profile')
                    ? 'bg-white text-indigo-700 shadow-md'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </Link>
              
              {/* Help Button with Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowHelp(!showHelp)}
                  className="flex items-center px-4 py-2 text-white hover:bg-white/20 rounded-lg transition-all font-medium text-sm"
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help
                </button>
                
                {showHelp && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowHelp(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Report bugs or request features
                        </p>
                        <button
                          onClick={handleReportIssue}
                          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                        >
                          Report an Issue
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-white hover:bg-white/20 rounded-lg transition-all font-medium text-sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
