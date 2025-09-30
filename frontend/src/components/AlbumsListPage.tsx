import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Camera, 
  Plus, 
  Grid, 
  Share2, 
  Trash2, 
  Eye, 
  Users,
  Lock,
  ExternalLink
} from 'lucide-react';
import { photoService } from '../services/photoService';

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

export default function AlbumsListPage() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<{ userAlbums: Album[]; sharedAlbums: Album[] }>({
    userAlbums: [],
    sharedAlbums: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showShareForm, setShowShareForm] = useState<Album | null>(null);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareUsername, setShareUsername] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, []);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await photoService.getAlbums();
      if (response.success) {
        setAlbums(response.data);
      } else {
        setError('Failed to fetch albums');
      }
    } catch (err) {
      setError('Failed to fetch albums');
      console.error('Error fetching albums:', err);
    } finally {
      setLoading(false);
    }
  };

  const createAlbum = async () => {
    if (!newAlbumTitle.trim()) return;
    try {
      const response = await photoService.createAlbum({
        title: newAlbumTitle.trim(),
        description: newAlbumDescription.trim() || undefined
      });
      if (response.success) {
        setNewAlbumTitle('');
        setNewAlbumDescription('');
        setShowCreateForm(false);
        fetchAlbums();
      } else {
        setError('Failed to create album');
      }
    } catch (err) {
      setError('Failed to create album');
      console.error('Error creating album:', err);
    }
  };

  const deleteAlbum = async (album: Album) => {
    if (!confirm(`Are you sure you want to delete "${album.title}"?`)) return;
    try {
      const response = await photoService.deleteAlbum(album._id);
      if (response.success) {
        fetchAlbums();
      } else {
        setError('Failed to delete album');
      }
    } catch (err) {
      setError('Failed to delete album');
      console.error('Error deleting album:', err);
    }
  };

  const shareAlbum = async () => {
    if (!showShareForm || (!shareEmail && !shareUsername)) return;
    try {
      const response = await photoService.shareAlbum(showShareForm._id, {
        email: shareEmail || undefined,
        username: shareUsername || undefined,
        permission: sharePermission
      });
      if (response.success) {
        setShowShareForm(null);
        setShareEmail('');
        setShareUsername('');
        setSharePermission('view');
        fetchAlbums();
      } else {
        setError('Failed to share album');
      }
    } catch (err) {
      setError('Failed to share album');
      console.error('Error sharing album:', err);
    }
  };

  const generatePublicLink = async (album: Album) => {
    try {
      const response = await photoService.generatePublicLink(album._id);
      if (response.success) {
        const publicUrl = response.data.publicUrl;
        navigator.clipboard.writeText(publicUrl);
        alert(`Public link copied to clipboard!\n\n${publicUrl}`);
        fetchAlbums();
      } else {
        setError('Failed to generate public link');
      }
    } catch (err) {
      setError('Failed to generate public link');
      console.error('Error generating public link:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {!isOnline && (
            <div className="mb-3 py-1.5 px-3 bg-yellow-100 rounded-lg border border-yellow-300 text-sm font-medium text-yellow-800 flex items-center justify-center">
              <svg className="h-5 w-5 text-yellow-600 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              You are currently offline. Some features may not work properly.
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Camera className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Photo Albums</h1>
                <p className="text-sm text-gray-600">
                  Organize and share your photos
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/photos" className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                ← Back to Photos
              </Link>
              <Link to="/profile" className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Profile
              </Link>
              <button onClick={() => setShowCreateForm(true)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                New Album
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
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

        {/* User Albums */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Albums</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {albums.userAlbums.map((album) => (
              <div key={album._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{album.title}</h3>
                    {album.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{album.description}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {album.photo_ids.length} photos • {formatDate(album.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    {album.is_public && <span title="Public"><ExternalLink className="h-4 w-4 text-green-600" /></span>}
                    {album.shared_with.length > 0 && <span title="Shared"><Users className="h-4 w-4 text-blue-600" /></span>}
                    <span title="Private"><Lock className="h-4 w-4 text-gray-400" /></span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => navigate(`/albums/${album._id}`)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowShareForm(album)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Share">
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => generatePublicLink(album)} className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Generate public link">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteAlbum(album)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shared Albums */}
        {albums.sharedAlbums.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shared with Me</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {albums.sharedAlbums.map((album) => (
                <div key={album._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{album.title}</h3>
                      {album.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{album.description}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {album.photo_ids.length} photos • Shared {formatDate(album.created_at)}
                      </p>
                    </div>
                    <span title="Shared with you"><Users className="h-5 w-5 text-blue-600 ml-4" /></span>
                  </div>
                  <button
                    onClick={() => navigate(`/albums/${album._id}`)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {albums.userAlbums.length === 0 && albums.sharedAlbums.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="bg-gray-100 p-8 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
              <Grid className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800">No albums yet</h3>
            <p className="text-gray-500 mt-2">Create your first album to organize your photos.</p>
            <button onClick={() => setShowCreateForm(true)} className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Create Album
            </button>
          </div>
        )}
      </div>

      {/* Create Album Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Album</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newAlbumTitle}
                  onChange={(e) => setNewAlbumTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter album title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={newAlbumDescription}
                  onChange={(e) => setNewAlbumDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Enter album description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewAlbumTitle('');
                  setNewAlbumDescription('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createAlbum}
                disabled={!newAlbumTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Album
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Album Modal */}
      {showShareForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Share "{showShareForm.title}"</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email or Username</label>
                <input
                  type="text"
                  value={shareEmail || shareUsername}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.includes('@')) {
                      setShareEmail(value);
                      setShareUsername('');
                    } else {
                      setShareUsername(value);
                      setShareEmail('');
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email or username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="view">View only</option>
                  <option value="edit">Can edit</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowShareForm(null);
                  setShareEmail('');
                  setShareUsername('');
                  setSharePermission('view');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={shareAlbum}
                disabled={!shareEmail && !shareUsername}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Share Album
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}