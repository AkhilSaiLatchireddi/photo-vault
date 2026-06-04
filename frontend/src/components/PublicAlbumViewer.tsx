import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Image as ImageIcon, AlertCircle, ExternalLink, ArrowLeft, Heart, Users, LayoutGrid, ChevronLeft } from 'lucide-react';
import { photoService } from '../services/photoService';
import PhotoZoomViewer from './PhotoZoomViewer';

interface PublicPhoto {
  photoId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  uploadedAt: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
}

interface ChildAlbum {
  name: string;
  publicUrl: string;
  token: string;
}

interface PublicAlbum {
  albumId: string;
  title: string;
  description?: string;
  createdAt: string;
  photos: PublicPhoto[];
  photoCount: number;
  childAlbums?: ChildAlbum[];
  isMasterAlbum?: boolean;
}

// Event-name → gradient so each card looks unique
const EVENT_GRADIENTS: Record<string, string> = {
  'candid':     'from-pink-500 via-rose-500 to-red-500',
  'marriage':   'from-red-500 via-orange-500 to-yellow-500',
  'outdoor':    'from-green-500 via-teal-500 to-cyan-500',
  'haldi':      'from-yellow-400 via-amber-500 to-orange-500',
  'bride':      'from-purple-500 via-pink-500 to-rose-500',
  'groom':      'from-blue-500 via-indigo-500 to-purple-500',
  'sangeet':    'from-fuchsia-500 via-purple-500 to-indigo-500',
  'drone':      'from-sky-500 via-blue-500 to-indigo-500',
  'after':      'from-emerald-500 via-teal-500 to-cyan-500',
  'completed':  'from-slate-600 via-gray-600 to-zinc-600',
};

function getGradient(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, grad] of Object.entries(EVENT_GRADIENTS)) {
    if (lower.includes(key)) return grad;
  }
  return 'from-indigo-500 via-purple-500 to-pink-500';
}

type ViewMode = 'photos' | 'people';
type PersonGroup = { person: { personId: string; name: string; coverUrl?: string }; photoIds: string[] };

export default function PublicAlbumViewer() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<PublicAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PublicPhoto | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('photos');
  const [peopleGroups, setPeopleGroups] = useState<PersonGroup[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonGroup | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const tokenRef = useRef<string | undefined>(undefined);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) { tokenRef.current = token; fetchPublicAlbum(token); }
  }, [token]);

  // IntersectionObserver for public album infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && tokenRef.current) {
          const nextPage = pageRef.current + 1;
          hasMoreRef.current = false; // prevent double-fire
          setLoadingMore(true);
          photoService.getPublicAlbumPage(tokenRef.current, nextPage, 20)
            .then(r => {
              if (r.success) {
                setAlbum(prev => prev ? { ...prev, photos: [...prev.photos, ...(r.data.photos || [])] } : prev);
                const more = r.data.hasMore ?? false;
                hasMoreRef.current = more;
                setHasMore(more);
                pageRef.current = nextPage;
              }
            })
            .catch(() => {})
            .finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: '600px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const fetchPublicAlbum = async (publicToken: string) => {
    try {
      setLoading(true);
      setError(null);
      // First page only — fast load
      const response = await photoService.getPublicAlbumPage(publicToken, 1, 20);
      if (response.success) {
        setAlbum(response.data);
        const more = response.data.hasMore ?? false;
        setHasMore(more);
        hasMoreRef.current = more;
        pageRef.current = 1;
      } else {
        setError('Failed to load album');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        setError('Album not found or link has expired');
      } else {
        setError('Failed to load album');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPeople = async (publicToken: string) => {
    if (peopleGroups.length > 0) return;
    try {
      setPeopleLoading(true);
      const response = await photoService.getPublicAlbumPeople(publicToken);
      if (response.success) setPeopleGroups(response.data);
    } catch (err) {
      console.error('Error fetching album people:', err);
    } finally {
      setPeopleLoading(false);
    }
  };

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedPerson(null);
    if (mode === 'people' && token) fetchPeople(token);
  };

  const openChildAlbum = (child: ChildAlbum) => {
    // Navigate within the SPA to the child album token
    navigate(`/album/public/${child.token}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-pink-200 border-t-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading album…</p>
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
          <p className="text-sm text-gray-500">This link may have expired or been removed by the owner.</p>
        </div>
      </div>
    );
  }

  if (!album) return null;

  // ── Master album view: Events / People / All Photos tabs ───────────────────
  if (album.isMasterAlbum && album.childAlbums && album.childAlbums.length > 0) {
    type MasterTab = 'events' | 'people' | 'photos';
    const activeMasterTab: MasterTab =
      viewMode === 'people' ? 'people'
      : (window as any).__masterTab__ || 'events';

    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-100">
        {/* Hero header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-5xl mx-auto px-6 py-14 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Heart className="h-8 w-8 text-pink-200 fill-pink-200" />
              <Camera className="h-10 w-10 text-white" />
              <Heart className="h-8 w-8 text-pink-200 fill-pink-200" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3">{album.title}</h1>
            <p className="text-pink-100 text-lg">{album.photoCount} photos & videos across {album.childAlbums.length} events</p>

            {/* Tab strip inside hero */}
            <div className="mt-6 inline-flex items-center bg-white/20 backdrop-blur-sm rounded-2xl p-1 gap-1">
              {([['events','Events', <LayoutGrid className="h-4 w-4" />], ['people','People', <Users className="h-4 w-4" />], ['photos','All Photos', <ImageIcon className="h-4 w-4" />]] as [MasterTab, string, React.ReactNode][]).map(([tab, label, icon]) => (
                <button
                  key={tab}
                  onClick={() => {
                    (window as any).__masterTab__ = tab;
                    if (tab === 'people') handleViewMode('people');
                    else { setViewMode('photos'); setSelectedPerson(null); }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeMasterTab === tab
                      ? 'bg-white text-rose-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Events tab */}
          {activeMasterTab === 'events' && (
            <>
              <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">Browse by Event</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {album.childAlbums.map((child) => (
                  <button
                    key={child.token}
                    onClick={() => openChildAlbum(child)}
                    className="group text-left bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                  >
                    <div className={`h-32 bg-gradient-to-br ${getGradient(child.name)} relative`}>
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-all"></div>
                      <div className="absolute bottom-3 left-4 right-4">
                        <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-700 rounded-full">Open album →</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 group-hover:text-pink-600 transition-colors line-clamp-2">{child.name}</h3>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* People tab */}
          {activeMasterTab === 'people' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              {peopleLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"></div>
                </div>
              ) : selectedPerson ? (
                <div>
                  <button onClick={() => setSelectedPerson(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-pink-600 mb-5 transition-colors">
                    <ChevronLeft className="h-4 w-4" />Back to People
                  </button>
                  <div className="flex items-center gap-3 mb-5">
                    {selectedPerson.person.coverUrl ? (
                      <img src={selectedPerson.person.coverUrl} alt={selectedPerson.person.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-pink-400" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-bold text-lg">
                        {selectedPerson.person.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900">{selectedPerson.person.name}</p>
                      <p className="text-sm text-gray-500">{selectedPerson.photoIds.length} photos</p>
                    </div>
                  </div>
                  <PhotoGrid photos={album.photos.filter(p => selectedPerson.photoIds.includes(p.photoId))} onSelect={setSelectedPhoto} />
                </div>
              ) : peopleGroups.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  {peopleGroups.map(group => (
                    <button key={group.person.personId} onClick={() => setSelectedPerson(group)} className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-pink-50 transition-all hover:shadow-md">
                      <div className="relative">
                        {group.person.coverUrl ? (
                          <img src={group.person.coverUrl} alt={group.person.name} className="w-20 h-20 rounded-full object-cover ring-4 ring-white group-hover:ring-pink-300 shadow-md transition-all" />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-bold text-2xl ring-4 ring-white shadow-md">
                            {group.person.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 bg-pink-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">{group.photoIds.length}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-pink-700 text-center">{group.person.name}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-700">No people tagged yet</h3>
                </div>
              )}
            </div>
          )}

          {/* All Photos tab */}
          {activeMasterTab === 'photos' && album.photos.length > 0 && (
            <PhotoGrid photos={album.photos} onSelect={setSelectedPhoto} />
          )}
        </div>

        <Footer />
        {selectedPhoto && <PhotoZoomViewer photo={selectedPhoto} isOpen={true} onClose={() => setSelectedPhoto(null)} showDownloadButton={false} />}
      </div>
    );
  }

  // ── Regular album view ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Camera className="h-12 w-12 text-pink-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{album.title}</h1>
                <div className="flex items-center justify-center mt-2 text-gray-600 text-sm">
                  <span>{album.photoCount} photos & videos</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(album.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center px-4 py-2 bg-pink-50 rounded-lg text-pink-700 text-sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Shared Album
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-pink-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />Back
        </button>
        {/* View toggle */}
        <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
          <button
            onClick={() => handleViewMode('photos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'photos' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <LayoutGrid className="h-4 w-4" />Photos
          </button>
          <button
            onClick={() => handleViewMode('people')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'people' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Users className="h-4 w-4" />People
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Photos view */}
          {viewMode === 'photos' && (
            <>
              <PhotoGrid photos={album.photos} onSelect={setSelectedPhoto} />
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-pink-500" />
                </div>
              )}
              {!hasMore && album.photos.length > 0 && (
                <p className="text-center text-xs text-gray-400 py-3">All {album.photos.length} photos loaded</p>
              )}
            </>
          )}

          {/* People view */}
          {viewMode === 'people' && (
            peopleLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"></div>
              </div>
            ) : selectedPerson ? (
              <div>
                <button onClick={() => setSelectedPerson(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-pink-600 mb-5 transition-colors">
                  <ChevronLeft className="h-4 w-4" />Back to People
                </button>
                <div className="flex items-center gap-3 mb-5">
                  {selectedPerson.person.coverUrl ? (
                    <img src={selectedPerson.person.coverUrl} alt={selectedPerson.person.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-pink-400" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-bold text-lg">
                      {selectedPerson.person.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-gray-900">{selectedPerson.person.name}</p>
                    <p className="text-sm text-gray-500">{selectedPerson.photoIds.length} photos in this album</p>
                  </div>
                </div>
                <PhotoGrid
                  photos={album.photos.filter(p => selectedPerson.photoIds.includes(p.photoId))}
                  onSelect={setSelectedPhoto}
                />
              </div>
            ) : peopleGroups.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {peopleGroups.map(group => (
                  <button
                    key={group.person.personId}
                    onClick={() => setSelectedPerson(group)}
                    className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-pink-50 transition-all hover:shadow-md"
                  >
                    <div className="relative">
                      {group.person.coverUrl ? (
                        <img src={group.person.coverUrl} alt={group.person.name} className="w-20 h-20 rounded-full object-cover ring-4 ring-white group-hover:ring-pink-300 shadow-md transition-all" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-bold text-2xl ring-4 ring-white shadow-md">
                          {group.person.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 bg-pink-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                        {group.photoIds.length}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-pink-700 text-center transition-colors leading-tight">
                      {group.person.name}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-700">No people tagged yet</h3>
                <p className="text-sm text-gray-500 mt-1">Face detection hasn't run on these photos.</p>
              </div>
            )
          )}
        </div>
      </div>

      {selectedPhoto && (
        <PhotoZoomViewer photo={selectedPhoto} isOpen={true} onClose={() => setSelectedPhoto(null)} showDownloadButton={false} />
      )}
      <Footer />
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function PhotoGrid({ photos, onSelect }: { photos: PublicPhoto[]; onSelect: (p: PublicPhoto) => void }) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="bg-gray-100 p-8 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
          <ImageIcon className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800">No photos in this album</h3>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {photos.map((photo) => (
        <div
          key={photo.photoId}
          className="group relative cursor-pointer"
          onClick={() => onSelect(photo)}
        >
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {(photo.thumbnailUrl || photo.downloadUrl) && photo.mimeType?.startsWith('image/') ? (
              <img
                src={photo.thumbnailUrl ?? photo.downloadUrl}
                alt={photo.originalName}
                loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-b-lg">
            <p className="text-xs font-semibold truncate">{photo.originalName}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <div className="bg-white border-t border-gray-200 mt-8">
      <div className="max-w-7xl mx-auto px-6 py-4 text-center text-sm text-gray-500">
        Powered by PhotoVault
      </div>
    </div>
  );
}
