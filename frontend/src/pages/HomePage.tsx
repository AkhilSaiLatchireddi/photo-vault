import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Download, Trash2, Image, AlertCircle, BarChart, Film } from 'lucide-react';
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
  photoId: string;
  filename: string;
  s3Key: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  uploadedAt: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
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

// Generate a compressed JPEG thumbnail using canvas (images only, runs in browser)
function generateThumbnail(file: File, maxSize = 400): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.75);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export default function HomePage() {
  debugLog('🏗️ HomePage component initializing');
  
  const { user, getAccessTokenSilently } = useAuth0();
  const { photoId } = useParams<{ photoId: string }>();
  const navigate = useNavigate();
  
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextKey, setNextKey] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  type MediaFilter = 'all' | 'photos' | 'videos';
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  // Sentinel div at bottom of grid — IntersectionObserver triggers next page load
  const sentinelRef = useRef<HTMLDivElement>(null);
  const nextKeyRef = useRef<string | null>(null);

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

  // Fetch one page of photos — appends to existing list when loading more
  const fetchPhotos = useCallback(async (cursor?: string | null, replace = false) => {
    if (replace) setLoading(true); else setLoadingMore(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unable to get authentication token');

      const url = new URL(`${API_BASE_URL}/api/files`);
      if (cursor) url.searchParams.set('nextKey', cursor);

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (data.success) {
        const incoming: Photo[] = data.data.photos || [];
        setPhotos(prev => replace ? incoming : [...prev, ...incoming]);
        const next = data.data.nextKey ?? null;
        setNextKey(next);
        setHasMore(!!next);
      } else {
        setError(data.error || 'Failed to fetch photos');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

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

      // Generate thumbnail and upload original in parallel
      const [thumbBlob] = await Promise.all([
        generateThumbnail(file),
        fetch(uploadData.data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        }).then(r => { if (!r.ok) throw new Error(`S3 upload failed: ${r.status}`); }),
      ]);

      // Upload thumbnail and save its key (fire-and-forget errors — thumbnail is optional)
      if (thumbBlob && uploadData.data.thumbnailUploadUrl) {
        try {
          await fetch(uploadData.data.thumbnailUploadUrl, {
            method: 'PUT',
            body: thumbBlob,
            headers: { 'Content-Type': 'image/jpeg' },
          });
          await fetch(`${API_BASE_URL}/api/files/${uploadData.data.photo.id}/thumbnail`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ thumbnailS3Key: uploadData.data.thumbnailS3Key }),
          });
        } catch (thumbErr) {
          console.warn('Thumbnail upload failed (non-fatal):', thumbErr);
        }
      }

      // Refresh photos and stats
      photoService.invalidatePhotosCache();
      setNextKey(null);
      setHasMore(true);
      await Promise.all([fetchPhotos(null, true), fetchStats()]);
      
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
  const downloadPhoto = async (photoId: string, filename: string) => {
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
  const deletePhoto = async (photoId: string, filename: string) => {
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
        setPhotos(photos.filter(photo => photo.photoId !== photoId));
        fetchStats();
        // Close photo viewer if it's the deleted photo
        if (selectedPhoto?.photoId === photoId) {
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

  // Handle opening a photo — replace so back button doesn't cycle through every photo
  const handleOpenPhoto = (photo: Photo) => {
    setSelectedPhoto(photo);
    navigate(`/photos/${photo.photoId}`, { replace: true });
  };

  // Handle closing photo viewer
  const handleClosePhoto = () => {
    setSelectedPhoto(null);
    navigate('/', { replace: true });
  };

  // Keep refs in sync — observer reads from refs, never from stale closures
  useEffect(() => { nextKeyRef.current = nextKey; }, [nextKey]);
  const loadingMoreRef = useRef(false);
  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);

  // IntersectionObserver — created once, stable via refs
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextKeyRef.current && !loadingMoreRef.current) {
          fetchPhotos(nextKeyRef.current, false);
        }
      },
      { rootMargin: '600px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []); // empty deps — stable via refs, never recreated

  // Load data on component mount
  useEffect(() => {
    if (user) {
      fetchPhotos(null, true); // first page, replace
      fetchStats();
      // Fetch DB profile for display name
      getToken().then(token => {
        if (!token) return;
        fetch(`${API_BASE_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(d => {
            const p = d?.data;
            const name = p?.profile?.displayName || p?.name || p?.username || '';
            setDisplayName(name);
          })
          .catch(() => {});
      });
    }
  }, [user]);

  // Handle photo URL parameter
  useEffect(() => {
    if (photoId && photos.length > 0) {
      const photo = photos.find(p => p.photoId === photoId);
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
                  <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-lg">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {displayName || (user as any)?.given_name || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Your'}'s Gallery
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">Your personal photo collection</p>
                      </div>
                    </div>
                    {/* Media filter toggle */}
                    <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
                      {([
                        ['all',    'All',    <Camera className="h-4 w-4" />],
                        ['photos', 'Photos', <Image className="h-4 w-4" />],
                        ['videos', 'Videos', <Film className="h-4 w-4" />],
                      ] as [MediaFilter, string, React.ReactNode][]).map(([f, label, icon]) => (
                        <button
                          key={f}
                          onClick={() => setMediaFilter(f)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            mediaFilter === f
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {icon}{label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
              ) : photos.filter(p =>
                    mediaFilter === 'photos' ? p.mimeType.startsWith('image/') :
                    mediaFilter === 'videos' ? p.mimeType.startsWith('video/') : true
                  ).length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {photos
                    .filter(p =>
                      mediaFilter === 'photos' ? p.mimeType.startsWith('image/') :
                      mediaFilter === 'videos' ? p.mimeType.startsWith('video/') : true
                    )
                    .map((photo) => (
                    <div key={photo.photoId} className="group relative">
                      <div
                        className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all duration-500 ring-2 ring-transparent hover:ring-indigo-400 hover:scale-110"
                        onClick={() => handleOpenPhoto(photo)}
                      >
                        {(photo.thumbnailUrl || photo.downloadUrl) && photo.mimeType.startsWith('image/') ? (
                          <img
                            src={photo.thumbnailUrl ?? photo.downloadUrl}
                            alt={photo.originalName}
                            loading="lazy" className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-700 ease-out"
                          />
                        ) : photo.downloadUrl && photo.mimeType.startsWith('video/') ? (
                          <div className="w-full h-full bg-gray-900 flex items-center justify-center relative">
                            <video src={photo.downloadUrl} className="w-full h-full object-cover" muted preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="bg-black/50 rounded-full p-2">
                                <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                            <Image className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-500 flex gap-2 transform translate-y-2 group-hover:translate-y-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadPhoto(photo.photoId, photo.originalName); }}
                          className="bg-white text-gray-800 p-2 rounded-full hover:bg-indigo-500 hover:text-white transition-all shadow-lg transform hover:scale-125 hover:rotate-12"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePhoto(photo.photoId, photo.originalName); }}
                          className="bg-white text-gray-800 p-2 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-lg transform hover:scale-125 hover:-rotate-12"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                        <p className="text-xs font-semibold truncate">{photo.originalName}</p>
                        <p className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          {new Date(photo.uploadedAt).toLocaleDateString()}
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
                  <h3 className="text-xl font-semibold text-gray-800">
                    {mediaFilter === 'videos' ? 'No videos found' : mediaFilter === 'photos' ? 'No photos found' : 'No files found'}
                  </h3>
                  <p className="text-gray-500 mt-2">
                    {mediaFilter === 'all' ? 'Upload your first photo or video to see it here.' : `Switch to "All" to see everything.`}
                  </p>
                </div>
              )}

              {/* Infinite scroll sentinel + loading indicator */}
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              )}
              {!hasMore && photos.length > 0 && (
                <p className="text-center text-xs text-gray-400 py-4">All {photos.length} items loaded</p>
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
          onDownload={(photoId, filename) => downloadPhoto(photoId, filename)}
          onDelete={(photoId, filename) => deletePhoto(photoId, filename)}
          showDownloadButton={true}
          showDeleteButton={true}
        />
      )}
    </Layout>
  );
}
