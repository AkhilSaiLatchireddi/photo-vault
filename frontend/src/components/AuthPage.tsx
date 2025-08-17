import { useAuth0 } from "@auth0/auth0-react";
import { Camera, Shield, Cloud, Heart, Users, Zap } from "lucide-react";

// Debug logging setup
const DEBUG = import.meta.env.VITE_DEBUG === 'true';
const debugLog = (message: string, data?: any) => {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[AUTHPAGE-DEBUG] ${timestamp}: ${message}`, data || '');
  }
};

const AuthPage = () => {
  debugLog('AuthPage component initialized');
  
  const { loginWithRedirect } = useAuth0();
  debugLog('Auth0 hooks retrieved', { hasLoginWithRedirect: !!loginWithRedirect });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="flex items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            {/* Logo and Title */}
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-full mr-4">
                <Camera className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                PhotoVault
              </h1>
            </div>
            
            {/* Hero Text */}
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-4">
              Your memories deserve better protection
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Store, organize, and access your precious photos with enterprise-grade security. 
              Never lose a moment that matters.
            </p>

            {/* CTA Button */}
            <button
              onClick={() => {
                debugLog('Login button clicked, initiating Auth0 redirect');
                loginWithRedirect();
              }}
              className="group relative inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-full text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <Shield className="h-5 w-5 mr-2" />
              Get Started Securely
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Cloud className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Cloud Storage</h3>
              <p className="text-gray-600">
                Upload unlimited photos with automatic organization by date and intelligent categorization.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Bank-Level Security</h3>
              <p className="text-gray-600">
                Your photos are encrypted and protected with the same security standards used by financial institutions.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Lightning Fast</h3>
              <p className="text-gray-600">
                Access your photos instantly from anywhere in the world with our global content delivery network.
              </p>
            </div>
          </div>

          {/* Social Proof */}
          <div className="text-center mt-12">
            <div className="flex items-center justify-center space-x-6 text-gray-500">
              <div className="flex items-center">
                <Heart className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm">Trusted by photographers</span>
              </div>
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm">Growing community</span>
              </div>
              <div className="flex items-center">
                <Shield className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm">Privacy focused</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;