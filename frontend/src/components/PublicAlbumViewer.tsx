import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, Image as ImageIcon, AlertCircle, ExternalLink } from 'lucide-react';
import { photoService } from '../services/photoService';
import PhotoZoomViewer from './PhotoZoomViewer';

interface PublicPhoto {
  _id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  uploaded_at: string;
  downloadUrl?: string;
}

interface PublicAlbum {
  _id: string;
  title: string;
  description?: string;
  created_at: string;
  photos: PublicPhoto[];
  photoCount: number;
}

export default function PublicAlbumViewer() {
  const { token } = useParams<{ token: string }>();
  const [album, setAlbum] = useState<PublicAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PublicPhoto | null>(null);

  useEffect(() => {
    if (token) {
      fetchPublicAlbum(token);
    }
  }, [token]);

  const fetchPublicAlbum = async (publicToken: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await photoService.getPublicAlbum(publicToken);
      
      if (response.success) {
        setAlbum(response.data);
      } else {
        setError('Failed to load album');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        setError('Album not found or link has expired');
      } else {
        setError('Failed to load album');
      }
      console.error('Error fetching public album:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading album...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Album Not Available</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            This link may have expired or been removed by the owner.
          </p>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Album not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Camera className="h-12 w-12 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{album.title}</h1>
                <div className="flex items-center justify-center mt-2 text-gray-600 text-sm">
                  <span>{album.photoCount} photos</span>
                  <span className="mx-2">•</span>
                  <span>Created {new Date(album.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            {album.description && (
              <p className="text-lg text-gray-700 max-w-2xl mx-auto">{album.description}</p>
            )}

            <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg text-blue-700 text-sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Shared Album
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Photos Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6">
            {album.photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {album.photos.map((photo) => (
                  <div 
                    key={photo._id} 
                    className="group relative cursor-pointer"
                    onClick={() => setSelectedPhoto(photo)}
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
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
                <h3 className="text-xl font-semibold text-gray-800">No photos in this album</h3>
                <p className="text-gray-500 mt-2">This album doesn't contain any photos yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Zoom Viewer */}
      {selectedPhoto && (
        <PhotoZoomViewer
          photo={selectedPhoto}
          isOpen={true}
          onClose={() => setSelectedPhoto(null)}
          showDownloadButton={false}
        />
      )}

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="text-center text-sm text-gray-600">
            <p>Powered by PhotoVault • <span className="text-blue-600">Create your own albums</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
