import { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Image as ImageIcon,
  X,
  ArrowLeft
} from 'lucide-react';
import { photoService } from '../services/photoService';
import PhotoZoomViewer from '../components/PhotoZoomViewer';
import Layout from '../components/layout/Layout';

interface Album {
  _id: string;
  title: string;
  description?: string;
  photo_ids: string[];
  is_public: boolean;
  public_token?: string;
  public_expires_at?: string;
  shared_with: Array<{
    user_id?: string;
    email?: string;
    permission: 'view' | 'edit';
    shared_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface Photo {
  id?: string | number;
  _id?: string;
  filename?: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  uploaded_at: string;
  downloadUrl?: string;
}

export default function AlbumDetailPage() {
  const { albumId, photoId } = useParams<{ albumId: string; photoId?: string }>();
  const navigate = useNavigate();
  
  const [album, setAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [addingPhotos, setAddingPhotos] = useState(false);

  useEffect(() => {
    if (albumId) {
      fetchAlbum();
      fetchAllPhotos();
    }
  }, [albumId]);

  // Handle photo URL parameter
  useEffect(() => {
    if (photoId && albumPhotos.length > 0) {
      const photo = albumPhotos.find(p => (p.id || p._id)?.toString() === photoId);
      if (photo) {
        setSelectedPhoto(photo);
      }
    } else if (!photoId && selectedPhoto) {
      setSelectedPhoto(null);
    }
  }, [photoId, albumPhotos]);

  const fetchAlbum = async () => {
    if (!albumId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await photoService.getAlbum(albumId);
      if (response.success) {
        setAlbum(response.data);
        setAlbumPhotos(response.data.photos || []);
      } else {
        setError('Failed to load album');
      }
    } catch (err) {
      setError('Failed to load album');
      console.error('Error loading album:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPhotos = async () => {
    try {
      const response = await photoService.getPhotos();
      if (response.success) {
        setAllPhotos(response.data?.photos || []);
      }
    } catch (err) {
      console.error('Error fetching photos:', err);
    }
  };

  const addPhotosToAlbum = async () => {
    if (!album || selectedPhotoIds.length === 0) return;
    
    try {
      setAddingPhotos(true);
      const response = await photoService.addPhotosToAlbum(album._id, selectedPhotoIds);
      
      if (response.success) {
        setSelectedPhotoIds([]);
        setShowAddPhotos(false);
        fetchAlbum(); // Refresh album to show new photos
      } else {
        setError('Failed to add photos to album');
      }
    } catch (err) {
      setError('Failed to add photos to album');
      console.error('Error adding photos:', err);
    } finally {
      setAddingPhotos(false);
    }
  };

  const removePhotoFromAlbum = async (photoId: string) => {
    if (!album) return;
    if (!confirm('Remove this photo from the album?')) return;

    try {
      const response = await photoService.removePhotoFromAlbum(album._id, photoId);
      if (response.success) {
        setAlbumPhotos(albumPhotos.filter(p => (p.id || p._id) !== photoId));
        // Close photo viewer if it's the removed photo
        if ((selectedPhoto?.id || selectedPhoto?._id) === photoId) {
          handleClosePhoto();
        }
      } else {
        setError('Failed to remove photo from album');
      }
    } catch (err) {
      setError('Failed to remove photo from album');
      console.error('Error removing photo:', err);
    }
  };

  const handleOpenPhoto = (photo: Photo) => {
    setSelectedPhoto(photo);
    navigate(`/albums/${albumId}/photos/${photo.id || photo._id}`);
  };

  const handleClosePhoto = () => {
    setSelectedPhoto(null);
    navigate(`/albums/${albumId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading && !album) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-gray-200 border-t-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!album) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">Album not found</h2>
            <button 
              onClick={() => navigate('/albums')} 
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              ← Back to Albums
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Dynamic Animated Background */}
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100">
        {/* Animated Gradient Orbs */}
        <div className="absolute top-10 -left-4 w-80 h-80 bg-cyan-300 rounded-full mix-blend-multiply filter blur-xl opacity-60 animate-blob"></div>
        <div className="absolute top-20 -right-4 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-60 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-60 animate-blob animation-delay-4000"></div>
        
        {/* Content Wrapper */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Page Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/albums')}
              className="mr-4 p-3 bg-white/80 backdrop-blur-sm text-gray-600 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-2xl opacity-20 blur-xl"></div>
              <div className="relative">
                <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {album.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                  <span className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    {albumPhotos.length} photos
                  </span>
                  <span>• Created {formatDate(album.created_at)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-1 text-sm text-red-700">{error}</div>
                <button onClick={() => setError(null)} className="mt-2 text-xs text-red-600 hover:text-red-800">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Album Description */}
        {album.description && (
          <div className="relative mb-6">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl opacity-20 blur"></div>
            <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
              <p className="text-gray-700">{album.description}</p>
            </div>
          </div>
        )}

        {/* Photos Section */}
        <div className="relative">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full opacity-20 blur-2xl animate-float"></div>
          
          <div className="relative bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border-2 border-white/50 overflow-hidden">
            <div className="p-6 border-b border-gray-100/50 flex items-center justify-between bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-xl shadow-md">
                  <ImageIcon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  Photos in Album
                </h3>
              </div>
              <button
                onClick={() => setShowAddPhotos(true)}
                className="relative group"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl opacity-75 group-hover:opacity-100 blur transition duration-300"></div>
                <div className="relative flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-xl transition-all">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Photos
                </div>
              </button>
            </div>
          
          <div className="p-6">
            {albumPhotos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {albumPhotos.map((photo, index) => (
                  <div 
                    key={`album-photo-${photo.id || photo.filename || index}`} 
                    className="group relative cursor-pointer"
                    onClick={() => handleOpenPhoto(photo)}
                  >
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      {photo.downloadUrl && photo.mime_type.startsWith('image/') ? (
                        <img
                          src={photo.downloadUrl}
                          alt={photo.original_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhotoFromAlbum((photo.id || photo._id) as string);
                        }}
                        className="bg-red-500/80 backdrop-blur-sm text-white p-2 rounded-full hover:bg-red-600"
                        title="Remove from album"
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
                  <ImageIcon className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">No photos in album</h3>
                <p className="text-gray-500 mt-2">Add some photos to get started.</p>
                <button
                  onClick={() => setShowAddPhotos(true)}
                  className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-5 w-5 mr-2 inline" />
                  Add Photos
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Photos Modal */}
      {showAddPhotos && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Add Photos to "{album.title}"
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Select photos from your library to add to this album
                </p>
              </div>
              <button 
                className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-200 rounded-full transition-colors"
                onClick={() => {
                  setSelectedPhotoIds([]);
                  setShowAddPhotos(false);
                }}
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-auto">
              {allPhotos.length > 0 ? (
                <div>
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-blue-800">
                        <strong className="font-medium">Tip:</strong> Click on photos to select them for adding to this album
                      </p>
                    </div>
                    <div className="bg-white px-3 py-1 rounded-full shadow-sm border border-blue-200">
                      <span className="text-sm font-semibold text-blue-800">
                        {selectedPhotoIds.length} selected
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {allPhotos
                      .filter((photo) => {
                        const photoId = (photo.id || photo._id) as string;
                        return !photoId || !album.photo_ids?.includes(photoId);
                      })
                      .map((photo, index) => {
                        const photoId = (photo.id || photo._id) as string;
                        const isSelected = selectedPhotoIds.includes(photoId);
                        
                        return (
                          <div
                            key={`modal-photo-${photo.id || photo.filename || index}`}
                            className={`aspect-square rounded-lg overflow-hidden relative cursor-pointer hover:shadow-lg transition-all ${
                              isSelected 
                                ? 'ring-4 ring-blue-500 shadow-lg scale-95' 
                                : 'border-2 border-gray-200 hover:border-gray-300 hover:scale-105'
                            }`}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedPhotoIds(selectedPhotoIds.filter(id => id !== photoId));
                              } else {
                                setSelectedPhotoIds([...selectedPhotoIds, photoId]);
                              }
                            }}
                          >
                            {photo.downloadUrl && photo.mime_type?.startsWith('image/') ? (
                              <img
                                src={photo.downloadUrl}
                                alt={photo.original_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                                <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-lg">
                                  ✓
                                </div>
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="text-xs text-white truncate">{photo.original_name}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-50 rounded-xl">
                  <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No photos available to add</p>
                  <p className="text-sm text-gray-500 mt-2">Upload some photos first</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center">
                {selectedPhotoIds.length > 0 && (
                  <div className="flex items-center space-x-1 bg-blue-100 px-3 py-1.5 rounded-full">
                    <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-xs text-white font-bold">{selectedPhotoIds.length}</span>
                    <span className="text-sm font-medium text-blue-800">
                      {selectedPhotoIds.length === 1 ? 'photo' : 'photos'} selected
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedPhotoIds([]);
                    setShowAddPhotos(false);
                  }}
                  className="px-5 py-2.5 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={addPhotosToAlbum}
                  disabled={selectedPhotoIds.length === 0 || addingPhotos}
                  className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                    selectedPhotoIds.length === 0 || addingPhotos 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                  } flex items-center space-x-2`}
                >
                  {addingPhotos ? (
                    <Fragment>
                      <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                      <span>Adding...</span>
                    </Fragment>
                  ) : (
                    <Fragment>
                      <Plus className="h-4 w-4" />
                      <span>Add {selectedPhotoIds.length > 0 ? selectedPhotoIds.length : ''} to Album</span>
                    </Fragment>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Zoom Viewer */}
      {selectedPhoto && (
        <PhotoZoomViewer
          photo={selectedPhoto}
          isOpen={!!selectedPhoto}
          onClose={handleClosePhoto}
          showDownloadButton={false}
        />
      )}
        </div>
      </div>
    </Layout>
  );
}
