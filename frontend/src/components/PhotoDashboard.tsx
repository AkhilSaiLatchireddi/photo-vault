import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Camera, Upload, Download, Trash2, Image, AlertCircle, LogOut, User, BarChart } from 'lucide-react';
import UserProfile from './UserProfileClean';

// Debug logging helper
const DEBUG = import.meta.env.VITE_DEBUG === 'true' || localStorage.getItem('DEBUG') === 'true';
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log('[PHOTO-DASHBOARD-DEBUG]', new Date().toISOString(), ...args);
  }
};

debugLog('📱 PhotoDashboard component loaded');

interface Photo {
  id: number;
  filename: string;
  s3_key: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  uploaded_at: string;
  downloadUrl?: string;
  metadata?: any;
}

interface PhotoStats {
  totalPhotos: number;
  totalSize: number;
  totalSizeFormatted: string;
  firstUpload?: string;
  lastUpload?: string;
  user: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
debugLog('🌐 API_BASE_URL configured:', API_BASE_URL);

export default function PhotoDashboard() {
  debugLog('🏗️ PhotoDashboard component initializing');
  
  const { user, logout, getAccessTokenSilently } = useAuth0();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  debugLog('👤 Auth0 user data:', {
    hasUser: !!user,
    userSub: user?.sub,
    userEmail: user?.email,
    userName: user?.name
  });

  // Logout function with redirect
  const handleLogout = () => {
    debugLog('🚪 Logout initiated');
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      }
    });
  };

  // Get Auth0 token
  const getToken = async () => {
    debugLog('🎫 Getting Auth0 token...');
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

  // Fetch photos from backend
  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Unable to get authentication token');
      }

      const response = await fetch(`${API_BASE_URL}/api/files`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setPhotos(data.data.photos || []);
      } else {
        setError(data.error || 'Failed to fetch photos');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user statistics
  const fetchStats = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      
      const response = await fetch(`${API_BASE_URL}/api/files/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Upload photo
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Unable to get authentication token');
      }
      
      // Get upload URL from backend
      const uploadResponse = await fetch(`${API_BASE_URL}/api/files/upload-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          metadata: {
            width: null, // Could extract from image
            height: null,
            takenAt: null, // Could extract from EXIF
          },
        }),
      });

      const uploadData = await uploadResponse.json();
      
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Failed to get upload URL');
      }

      // Upload file to S3 using presigned URL
      const s3Response = await fetch(uploadData.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      if (!s3Response.ok) {
        throw new Error(`Failed to upload file to S3: ${s3Response.status} ${s3Response.statusText}`);
      }

      // Refresh photos and stats
      await Promise.all([fetchPhotos(), fetchStats()]);
      
      // Reset file input
      event.target.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error('❌ Error uploading file:', err);
    } finally {
      setUploading(false);
    }
  };  // Download photo
  const downloadPhoto = async (photoId: number, filename: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Unable to get authentication token');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/files/${photoId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (data.success && data.data.url) {
        // Create download link
        const link = document.createElement('a');
        link.href = data.data.url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError('Failed to get download URL');
      }
    } catch (err) {
      setError('Failed to download photo');
      console.error('Error downloading photo:', err);
    }
  };

  // Delete photo
  const deletePhoto = async (photoId: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Unable to get authentication token');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/files/${photoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Remove photo from local state
        setPhotos(photos.filter(photo => photo.id !== photoId));
        // Refresh stats
        fetchStats();
      } else {
        setError(data.error || 'Failed to delete photo');
      }
    } catch (err) {
      setError('Failed to delete photo');
      console.error('Error deleting photo:', err);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (user) {
      fetchPhotos();
      fetchStats();
    }
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showProfile ? (
        <div className="relative">
          {/* Header with back button */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    onClick={() => setShowProfile(false)}
                    className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    ← Back to Photos
                  </button>
                  <Camera className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
          {/* Profile Component */}
          <UserProfile />
        </div>
      ) : (
        <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Camera className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PhotoVault</h1>
                <p className="text-sm text-gray-600">Welcome back, {user?.name || user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Image className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Photos</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalPhotos}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="bg-green-100 p-3 rounded-lg">
                  <BarChart className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Storage</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalSizeFormatted}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <User className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Account</p>
                  <p className="text-lg font-bold text-gray-900">{stats.user}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <Upload className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Last Upload</p>
                  <p className="text-sm font-bold text-gray-900">
                    {stats.lastUpload ? new Date(stats.lastUpload).toLocaleDateString() : 'None'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upload Photos</h2>
            <button
              onClick={fetchPhotos}
              disabled={loading}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
            <label className="cursor-pointer">
              <div className="flex flex-col items-center">
                <div className="bg-blue-100 p-4 rounded-full mb-4">
                  <Upload className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {uploading ? 'Uploading...' : 'Choose photos to upload'}
                </p>
                <p className="text-sm text-gray-600">
                  Drag and drop or click to browse
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*"
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Photos Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Your Photos
            </h2>
            <div className="text-xs text-gray-500 mt-2">
              {photos.length} photos loaded |
              User: {user ? '✓ Authenticated' : '✗ Not authenticated'} | 
              Loading: {loading ? 'Yes' : 'No'} | 
              Error: {error || 'None'}
            </div>
          </div>
          
          <div className="p-6">
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative">
                    <div
                      className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      {photo.downloadUrl && photo.mime_type.startsWith('image/') ? (
                        <img
                          src={photo.downloadUrl}
                          alt={photo.original_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Image className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPhoto(photo.id, photo.original_name);
                        }}
                        className="bg-white/80 backdrop-blur-sm text-gray-800 p-2 rounded-full hover:bg-white transition-colors shadow-md"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePhoto(photo.id, photo.original_name);
                        }}
                        className="bg-red-500/80 backdrop-blur-sm text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-md"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
                      <p className="text-xs font-semibold truncate">{photo.original_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gray-100 p-8 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                  <Camera className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">No photos found</h3>
                <p className="text-gray-500 mt-2">Upload your first photo to see it here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPhoto(null)}>
          <div className="max-w-5xl max-h-full bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 truncate max-w-md">{selectedPhoto.original_name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {formatFileSize(selectedPhoto.file_size)} • {formatDate(selectedPhoto.uploaded_at)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 max-h-[80vh] overflow-auto">
              {selectedPhoto.downloadUrl && selectedPhoto.mime_type.startsWith('image/') ? (
                <div className="text-center">
                  <img 
                    src={selectedPhoto.downloadUrl} 
                    alt={selectedPhoto.original_name}
                    className="max-w-full max-h-[60vh] mx-auto object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="bg-gray-100 p-8 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <Image className="h-12 w-12 text-gray-400" />
                  </div>
                  <p className="text-gray-600 text-lg">Preview not available for this file type</p>
                  <p className="text-gray-500 text-sm mt-2">Use the download button to view this file</p>
                </div>
              )}
              
              {/* File Details */}
              {selectedPhoto.width && selectedPhoto.height && (
                <div className="mt-6 text-center">
                  <div className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                    <span className="font-medium">Dimensions:</span>
                    <span className="ml-2">{selectedPhoto.width} × {selectedPhoto.height}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Actions */}
            <div className="flex justify-center gap-4 p-6 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => downloadPhoto(selectedPhoto.id, selectedPhoto.original_name)}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Download className="h-5 w-5 mr-2" />
                Download
              </button>
              <button
                onClick={() => {
                  deletePhoto(selectedPhoto.id, selectedPhoto.original_name);
                  setSelectedPhoto(null);
                }}
                className="flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
              >
                <Trash2 className="h-5 w-5 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}