import { useAuth0 } from '@auth0/auth0-react';
import { Link, useLocation } from 'react-router-dom';
import { Camera, Grid, User, LogOut, Home, HelpCircle } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  showNavigation?: boolean;
}

export default function Header({ showNavigation = true }: HeaderProps) {
  const { user, logout } = useAuth0();
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      }
    });
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
            <div className="bg-white p-2 rounded-lg shadow-md group-hover:shadow-xl transition-all mr-3">
              <Camera className="h-7 w-7 text-indigo-600" />
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
