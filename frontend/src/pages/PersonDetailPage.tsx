import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, Edit2, Check, X } from 'lucide-react';
import Layout from '../components/layout/Layout';
import PhotoZoomViewer from '../components/PhotoZoomViewer';
import { config } from '../config/env';
import { useAuth0 } from '@auth0/auth0-react';

const API = config.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface Photo {
  photoId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  s3Key: string;
  thumbnailUrl?: string | null;
  downloadUrl?: string | null;
}

interface Person {
  personId: string;
  name: string;
  photoCount: number;
}

export default function PersonDetailPage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();

  const [person, setPerson] = useState<Person | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<() => void>(() => {});

  const getToken = async () => {
    try {
      return await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE } });
    } catch { return null; }
  };

  const fetchPage = async (page: number, append = false) => {
    try {
      if (page === 1) setLoading(true); else setLoadingMore(true);
      const token = await getToken();
      const res = await fetch(`${API}/api/people/${personId}/photos?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        if (page === 1) {
          setPerson(data.data.person);
          setEditName(data.data.person.name);
        }
        setPhotos(prev => append ? [...prev, ...data.data.photos] : data.data.photos);
        setTotalCount(data.data.totalCount ?? data.data.photos.length);
        setHasMore(data.data.hasMore ?? false);
        hasMoreRef.current = data.data.hasMore ?? false;
        pageRef.current = page;
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!personId) return;
    fetchPage(1);
  }, [personId]);

  const loadMore = () => {
    if (!hasMoreRef.current || loadingMore) return;
    hasMoreRef.current = false;
    fetchPage(pageRef.current + 1, true);
  };
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMoreRef.current(); },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [personId, loading]);

  // When opening a photo that only has thumbnailUrl, fetch the full downloadUrl on demand
  const openPhoto = async (photo: Photo) => {
    if (photo.downloadUrl) {
      setSelectedPhoto(photo);
      return;
    }
    try {
      setLoadingFull(true);
      const token = await getToken();
      const res = await fetch(`${API}/api/files/${photo.photoId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const full = { ...photo, downloadUrl: data.data.downloadUrl };
        // Cache it in the photos list
        setPhotos(prev => prev.map(p => p.photoId === photo.photoId ? full : p));
        setSelectedPhoto(full);
      } else {
        setSelectedPhoto(photo); // fallback — viewer will show thumbnail
      }
    } catch {
      setSelectedPhoto(photo);
    } finally {
      setLoadingFull(false);
    }
  };

  const saveName = async () => {
    if (!editName.trim() || !personId) return;
    const token = await getToken();
    const res = await fetch(`${API}/api/people/${personId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    const data = await res.json();
    if (data.success) {
      setPerson(p => p ? { ...p, name: editName.trim() } : p);
      setEditingName(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-6 py-8">

          {/* Back + name header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/people')}
              className="p-2 rounded-xl bg-white shadow-sm border border-gray-100 text-gray-600 hover:text-purple-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="text-2xl font-bold border-b-2 border-purple-400 bg-transparent focus:outline-none text-gray-800 w-48"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                />
                <button onClick={saveName} className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditingName(false)} className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900">{person?.name ?? '…'}</h2>
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {person && (
              <span className="ml-auto text-sm text-gray-500 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-gray-100">
                {totalCount} photo{totalCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin h-10 w-10 rounded-full border-4 border-purple-200 border-t-purple-600" />
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-24">
              <ImageIcon className="h-16 w-16 mx-auto text-gray-200 mb-4" />
              <p className="text-gray-500">No photos found for this person</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {photos.map(photo => (
                  <div
                    key={photo.photoId}
                    className="aspect-square rounded-xl overflow-hidden cursor-pointer bg-gray-100 hover:scale-[1.02] transition-transform shadow-sm relative"
                    onClick={() => openPhoto(photo)}
                  >
                    {(photo.thumbnailUrl || photo.downloadUrl) && photo.mimeType.startsWith('image/') ? (
                      <img
                        src={photo.thumbnailUrl ?? photo.downloadUrl ?? undefined}
                        alt={photo.originalName}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-4 mt-4" />
              {loadingMore && (
                <div className="flex justify-center py-6">
                  <div className="animate-spin h-8 w-8 rounded-full border-4 border-purple-200 border-t-purple-600" />
                </div>
              )}
              {!hasMore && photos.length > 0 && (
                <p className="text-center text-xs text-gray-400 py-4">All {totalCount} photos loaded</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Full-res loading overlay */}
      {loadingFull && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="animate-spin h-10 w-10 rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {selectedPhoto && (
        <PhotoZoomViewer
          photo={{ ...selectedPhoto, downloadUrl: selectedPhoto.downloadUrl ?? undefined }}
          isOpen
          onClose={() => setSelectedPhoto(null)}
          showDownloadButton={false}
        />
      )}
    </Layout>
  );
}
