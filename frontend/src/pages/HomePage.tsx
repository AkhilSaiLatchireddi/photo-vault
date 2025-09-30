import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Upload, Download, Trash2, Image, AlertCircle, BarChart, User } from 'lucide-react';
import { config } from '../config/env';
import { photoService } from '../services/photoService';
import PhotoZoomViewer from '../components/PhotoZoomViewer';
import Layout from '../components/layout/Layout';

// Debug logging helper
const DEBUG = import.meta.env.VITE_DEBUG === 'true' || localStorage.getItem('DEBUG') === 'true';
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log('[PHOTO-DASHBOARD-DEBUG]', new Date().toISOString(), ...args);
  }
};

debugLog('📱 HomePage component loaded');

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

const API_BASE_URL = config.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
debugLog('🌐 API_BASE_URL configured:', API_BASE_URL);

export default function HomePage() {
  debugLog('🏗️ HomePage component initializing');
  
  const { user, getAccessTokenSilently } = useAuth0();
  const { photoId } = useParams<{ photoId: string }>();
  const navigate = useNavigate();
  
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  debugLog('👤 Auth0 user data:', {
    hasUser: !!user,
    userSub: user?.sub,
    userEmail: user?.email,
    userName: user?.name
  });

  // Get Auth0 token
  const getToken = async () => {
    debugLog('🎫 Getting Auth0 token...');
    try {
      const audience = config.AUTH0_AUDIENCE;
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
            width: null,
            height: null,
            takenAt: null,
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
      // Clear photos cache to force fresh data after upload
      photoService.invalidatePhotosCache();
      await Promise.all([fetchPhotos(), fetchStats()]);
      
      // Reset file input
      event.target.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error('❌ Error uploading file:', err);
    } finally {
      setUploading(false);
    }
  };

  // Download photo
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
        setPhotos(photos.filter(photo => photo.id !== photoId));
        fetchStats();
        // Close photo viewer if it's the deleted photo
        if (selectedPhoto?.id === photoId) {
          handleClosePhoto();
        }
      } else {
        setError(data.error || 'Failed to delete photo');
      }
    } catch (err) {
      setError('Failed to delete photo');
      console.error('Error deleting photo:', err);
    }
  };

  // Handle opening a photo
  const handleOpenPhoto = (photo: Photo) => {
    setSelectedPhoto(photo);
    navigate(`/photos/${photo.id}`);
  };

  // Handle closing photo viewer
  const handleClosePhoto = () => {
    setSelectedPhoto(null);
    navigate('/');
  };

  // Load data on component mount
  useEffect(() => {
    if (user) {
      fetchPhotos();
      fetchStats();
    }
  }, [user]);

  // Handle photo URL parameter
  useEffect(() => {
    if (photoId && photos.length > 0) {
      const photo = photos.find(p => p.id === parseInt(photoId));
      if (photo) {
        setSelectedPhoto(photo);
      }
    } else if (!photoId && selectedPhoto) {
      setSelectedPhoto(null);
    }
  }, [photoId, photos]);

  return (
    <Layout>
      {/* Dynamic Animated Background */}
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
        {/* Animated Gradient Orbs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        
        {/* Content Wrapper */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          {/* Stats + Upload Section - Single Row */}
          {stats && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
              {/* Mini Stats Cards */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-blue-200/50 hover:shadow-lg hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg shadow-sm">
                    <Image className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">Photos</p>
                    <p className="text-lg font-bold text-gray-900">{stats.totalPhotos}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-green-200/50 hover:shadow-lg hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-lg shadow-sm">
                    <BarChart className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">Storage</p>
                    <p className="text-lg font-bold text-gray-900">{stats.totalSizeFormatted}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-purple-200/50 hover:shadow-lg hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2 rounded-lg shadow-sm">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">Account</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{stats.user}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-orange-200/50 hover:shadow-lg hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 rounded-lg shadow-sm">
                    <Upload className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">Last Upload</p>
                    <p className="text-xs font-bold text-gray-900">
                      {stats.lastUpload ? new Date(stats.lastUpload).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'None'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Button - Highlighted */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl opacity-75 group-hover:opacity-100 blur transition-all duration-300 animate-pulse"></div>
                <label className="relative cursor-pointer block">
                  <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-xl p-3 border border-white/20 hover:shadow-xl transition-all duration-300 hover:scale-105">
                    <div className="flex items-center gap-2">
                      <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <Camera className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          {uploading ? 'Uploading...' : 'Upload Photos'}
                        </p>
                        <p className="text-[10px] text-white/80">
                          Click to select
                        </p>
                      </div>
                    </div>
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
          )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

          {/* Photos Section with Glass Effect and Decorative Elements */}
          <div className="relative">
            {/* Decorative Floating Elements */}
            <div className="absolute -top-10 -left-10 w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full opacity-20 blur-2xl animate-float"></div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full opacity-20 blur-2xl animate-float" style={{ animationDelay: '1s' }}></div>
            
            <div className="relative bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border-2 border-white/50 overflow-hidden">
              {/* Header with Animated Gradient Border */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-glow"></div>
                <div className="relative bg-white/95 backdrop-blur-sm m-0.5 rounded-t-3xl">
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-lg">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {(user as any)?.given_name || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Your'}'s Gallery
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">Your personal photo collection</p>
                      </div>
                    </div>
                    {photos.length > 0 && (
                      <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2 rounded-xl border border-indigo-200">
                        <div className="flex -space-x-2">
                          {photos.slice(0, 3).map((photo, idx) => (
                            <div key={idx} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden">
                              {photo.downloadUrl && (
                                <img src={photo.downloadUrl} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                          ))}
                        </div>
                        <span className="text-sm font-medium text-indigo-700">
                          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
              ) : photos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="group relative">
                      <div
                        className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all duration-500 ring-2 ring-transparent hover:ring-indigo-400 hover:scale-110"
                        onClick={() => handleOpenPhoto(photo)}
                      >
                        {photo.downloadUrl && photo.mime_type.startsWith('image/') ? (
                          <img
                            src={photo.downloadUrl}
                            alt={photo.original_name}
                            className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-700 ease-out"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                            <Image className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        {/* Overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      </div>

                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-500 flex gap-2 transform translate-y-2 group-hover:translate-y-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPhoto(photo.id, photo.original_name);
                          }}
                          className="bg-white text-gray-800 p-2 rounded-full hover:bg-indigo-500 hover:text-white transition-all shadow-lg transform hover:scale-125 hover:rotate-12"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePhoto(photo.id, photo.original_name);
                          }}
                          className="bg-white text-gray-800 p-2 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-lg transform hover:scale-125 hover:-rotate-12"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                        <p className="text-xs font-semibold truncate">{photo.original_name}</p>
                        <p className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          {new Date(photo.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="bg-gradient-to-br from-blue-100 to-indigo-100 p-8 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center animate-pulse">
                    <Camera className="h-12 w-12 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800">No photos found</h3>
                  <p className="text-gray-500 mt-2">Upload your first photo to see it here.</p>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Photo Zoom Viewer */}
      {selectedPhoto && (
        <PhotoZoomViewer
          photo={selectedPhoto}
          isOpen={true}
          onClose={handleClosePhoto}
          onDownload={(photoId, filename) => downloadPhoto(parseInt(photoId), filename)}
          onDelete={(photoId, filename) => deletePhoto(parseInt(photoId), filename)}
          showDownloadButton={true}
          showDeleteButton={true}
        />
      )}
    </Layout>
  );
}
