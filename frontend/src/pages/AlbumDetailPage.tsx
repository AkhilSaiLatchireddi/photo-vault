import { useState, useEffect, Fragment, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  X,
  ArrowLeft,
  Users,
  LayoutGrid,
  ChevronLeft,
  FolderOpen,
  Settings2,
  Pencil,
  Check,
} from 'lucide-react';
import { photoService } from '../services/photoService';
import PhotoZoomViewer from '../components/PhotoZoomViewer';
import Layout from '../components/layout/Layout';
interface SubAlbumMeta { albumId: string; title: string; publicToken?: string; }

interface Album {
  albumId: string;
  title: string;
  description?: string;
  photoIds: string[];
  subAlbumIds?: string[];
  subAlbums?: SubAlbumMeta[];
  isPublic: boolean;
  publicToken?: string;
  publicExpiresAt?: string;
  sharedWith: Array<{
    userId?: string;
    email?: string;
    permission: 'view' | 'edit';
    sharedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
interface Photo {
  photoId?: string;
  
  filename?: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  uploadedAt: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
}
export default function AlbumDetailPage() {
  const { albumId, photoId } = useParams<{ albumId: string; photoId?: string }>();
  const navigate = useNavigate();
  
  const [album, setAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPhotoPage] = useState(1);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [hasMorePhotos, setHasMorePhotos] = useState(false);
  const photoPageRef = useRef(1);
  const hasMoreRef = useRef(false);
  // For aggregated parent albums: per-sub-album page cursors
  const subAlbumPagesRef = useRef<Record<string, number>>({}); // albumId -> last page fetched
  const subAlbumHasMoreRef = useRef<Record<string, boolean>>({}); // albumId -> hasMore
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [addingPhotos, setAddingPhotos] = useState(false);

  // Description inline edit
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  // Sub-albums / Sections
  const [showManageSections, setShowManageSections] = useState(false);
  const [selectedSubAlbumIds, setSelectedSubAlbumIds] = useState<string[]>([]);
  const [savingSections, setSavingSections] = useState(false);
  const [allUserAlbums, setAllUserAlbums] = useState<{albumId:string;title:string;subAlbumIds?:string[]}[]>([]);
  const [forbiddenSubAlbumIds, setForbiddenSubAlbumIds] = useState<Set<string>>(new Set());

  // View mode
  type ViewMode = 'photos' | 'videos' | 'people' | 'sections';
  type PersonGroup = { person: { personId: string; name: string; coverUrl?: string; photoCount: number }; photoIds: string[] };
  const [viewMode, setViewMode] = useState<ViewMode>('photos');
  // People view
  const [peopleGroups, setPeopleGroups] = useState<PersonGroup[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonGroup | null>(null);
  // Sections — inline expanded view with pagination
  const [expandedSection, setExpandedSection] = useState<{ sub: SubAlbumMeta; photos: Photo[]; page: number; hasMore: boolean } | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionLoadingMore, setSectionLoadingMore] = useState(false);
  const sectionSentinelRef = useRef<HTMLDivElement>(null);
  const sectionLoadMoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (albumId) {
      fetchAlbum();
      fetchAllPhotos();
    }
  }, [albumId]);
  // Handle photo URL parameter
  useEffect(() => {
    if (photoId && albumPhotos.length > 0) {
      const photo = albumPhotos.find(p => p.photoId === photoId);
      if (photo) {
        setSelectedPhoto(photo);
      }
    } else if (!photoId && selectedPhoto) {
      setSelectedPhoto(null);
    }
  }, [photoId, albumPhotos]);
  // Load first page — fast (20 photos only)
  const fetchAlbum = async () => {
    if (!albumId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await photoService.getAlbum(albumId);
      if (response.success) {
        const albumData = response.data;
        setAlbum(albumData);

        // If this album has no direct photos but has sub-albums, aggregate first page
        // from all sub-albums so the Photos tab isn't empty
        const directPhotos: Photo[] = albumData.photos || [];
        const subAlbums: SubAlbumMeta[] = albumData.subAlbums ?? [];
        if (directPhotos.length === 0 && subAlbums.length > 0) {
          // No direct photos — aggregate first page from each sub-album
          const pages = await Promise.all(
            subAlbums.map(sub =>
              photoService.getAlbumPage(sub.albumId, 1, 20).catch(() => null)
            )
          );
          const merged: Photo[] = [];
          let mergedTotal = 0;
          let anyMore = false;
          const newSubPages: Record<string, number> = {};
          const newSubHasMore: Record<string, boolean> = {};
          subAlbums.forEach((sub, i) => {
            const p = pages[i];
            newSubPages[sub.albumId] = 1;
            if (!p) { newSubHasMore[sub.albumId] = false; return; }
            merged.push(...(p.data.photos ?? []));
            mergedTotal += p.data.totalPhotos ?? 0;
            newSubHasMore[sub.albumId] = p.data.hasMore ?? false;
            if (p.data.hasMore) anyMore = true;
          });
          subAlbumPagesRef.current = newSubPages;
          subAlbumHasMoreRef.current = newSubHasMore;
          const seen = new Set<string>();
          const deduped = merged.filter(ph => {
            const k = ph.photoId ?? ph.filename ?? '';
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          setAlbumPhotos(deduped);
          setTotalPhotos(mergedTotal || (albumData.totalPhotos ?? 0));
          setHasMorePhotos(anyMore);
          hasMoreRef.current = anyMore;
        } else {
          setAlbumPhotos(directPhotos);
          setTotalPhotos(albumData.totalPhotos ?? (albumData.photoIds?.length ?? 0));
          const more = albumData.hasMore ?? false;
          setHasMorePhotos(more);
          hasMoreRef.current = more;
        }
        photoPageRef.current = 1;
        setPhotoPage(1);
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

  // Stable ref so the IntersectionObserver never captures a stale closure
  const loadMorePhotos = () => {
    if (!albumId || !hasMoreRef.current) return;
    hasMoreRef.current = false; // prevent double-fire immediately
    setLoadingMore(true);

    const subPages = subAlbumPagesRef.current;
    const subHasMore = subAlbumHasMoreRef.current;
    const isAggregated = Object.keys(subPages).length > 0;

    if (isAggregated) {
      // Aggregated parent: advance each sub-album that still has more pages
      const subIds = Object.keys(subPages).filter(id => subHasMore[id]);
      if (subIds.length === 0) { setLoadingMore(false); return; }
      Promise.all(
        subIds.map(id =>
          photoService.getAlbumPage(id, subPages[id] + 1, 20).catch(() => null)
        )
      ).then(results => {
        const newPhotos: Photo[] = [];
        let anyMore = false;
        subIds.forEach((id, i) => {
          const p = results[i];
          subAlbumPagesRef.current[id] = subPages[id] + 1;
          if (!p) { subAlbumHasMoreRef.current[id] = false; return; }
          newPhotos.push(...(p.data.photos ?? []));
          subAlbumHasMoreRef.current[id] = p.data.hasMore ?? false;
          if (p.data.hasMore) anyMore = true;
        });
        // Also check remaining sub-albums still have more
        const stillAny = anyMore || Object.values(subAlbumHasMoreRef.current).some(Boolean);
        setAlbumPhotos(prev => {
          const seen = new Set(prev.map(p => p.photoId));
          return [...prev, ...newPhotos.filter(p => !seen.has(p.photoId))];
        });
        hasMoreRef.current = stillAny;
        setHasMorePhotos(stillAny);
      }).catch(err => console.error('Error loading more photos:', err))
        .finally(() => setLoadingMore(false));
    } else {
      // Direct album pagination
      const nextPage = photoPageRef.current + 1;
      photoService.getAlbumPage(albumId, nextPage, 20)
        .then(response => {
          if (!response.success) return;
          const newPhotos: Photo[] = response.data.photos || [];
          setAlbumPhotos(prev => {
            const seen = new Set(prev.map(p => p.photoId));
            return [...prev, ...newPhotos.filter(p => !seen.has(p.photoId))];
          });
          const more = response.data.hasMore ?? false;
          hasMoreRef.current = more;
          setHasMorePhotos(more);
          photoPageRef.current = nextPage;
          setPhotoPage(nextPage);
        })
        .catch(err => console.error('Error loading more photos:', err))
        .finally(() => setLoadingMore(false));
    }
  };
  loadMoreRef.current = loadMorePhotos;

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

  // IntersectionObserver — re-create after album finishes loading (sentinel enters DOM)
  useEffect(() => {
    if (loading) return; // sentinel not in DOM yet
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current(); },
      { rootMargin: '600px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [albumId, loading]); // re-run once loading flips to false

  const fetchPeople = async () => {
    if (!albumId || peopleGroups.length > 0) return; // lazy — only fetch once
    try {
      setPeopleLoading(true);
      const response = await photoService.getAlbumPeople(albumId);
      if (response.success) setPeopleGroups(response.data);
    } catch (err) {
      console.error('Error fetching album people:', err);
    } finally {
      setPeopleLoading(false);
    }
  };

  const openManageSections = async () => {
    const currentIds = (album?.subAlbums ?? []).map((s: SubAlbumMeta) => s.albumId);
    setSelectedSubAlbumIds(currentIds);

    let albums = allUserAlbums;
    if (allUserAlbums.length === 0) {
      const r = await photoService.getAlbums();
      if (r.success) {
        albums = (r.data?.userAlbums ?? []).filter((a: any) => a.albumId !== albumId);
        setAllUserAlbums(albums);
      }
    }

    // Compute which albums CANNOT be sub-albums of current album (would create cycles)
    // An album X is forbidden if:
    //   1. X === current album (self)
    //   2. current album is already (directly or transitively) a sub-album of X
    const forbidden = new Set<string>();
    forbidden.add(albumId!); // can't add self

    // Build a map of albumId -> subAlbumIds for cycle detection
    const subMap = new Map<string, string[]>();
    for (const a of albums) {
      subMap.set(a.albumId, a.subAlbumIds ?? []);
    }

    // DFS: find all ancestors of current album (albums that have currentAlbum as descendant)
    const isDescendant = (root: string, target: string, visited = new Set<string>()): boolean => {
      if (visited.has(root)) return false;
      visited.add(root);
      const children = subMap.get(root) ?? [];
      if (children.includes(target)) return true;
      return children.some(c => isDescendant(c, target, visited));
    };

    for (const a of albums) {
      if (isDescendant(a.albumId, albumId!)) {
        forbidden.add(a.albumId);
      }
    }

    setForbiddenSubAlbumIds(forbidden);
    setShowManageSections(true);
  };

  const openSection = async (sub: SubAlbumMeta) => {
    if (expandedSection?.sub.albumId === sub.albumId) {
      setExpandedSection(null);
      return;
    }
    try {
      setSectionLoading(true);
      const response = await photoService.getAlbumPage(sub.albumId, 1, 20);
      if (response.success) {
        setExpandedSection({
          sub,
          photos: response.data.photos ?? [],
          page: 1,
          hasMore: response.data.hasMore ?? false,
        });
      }
    } catch (e) {
      console.error('Error loading section photos:', e);
    } finally {
      setSectionLoading(false);
    }
  };

  const loadMoreSectionPhotos = () => {
    if (!expandedSection || !expandedSection.hasMore || sectionLoadingMore) return;
    const { sub, page } = expandedSection;
    setSectionLoadingMore(true);
    photoService.getAlbumPage(sub.albumId, page + 1, 20)
      .then(response => {
        if (!response.success) return;
        const newPhotos: Photo[] = response.data.photos ?? [];
        setExpandedSection(prev => {
          if (!prev) return prev;
          const seen = new Set(prev.photos.map(p => p.photoId));
          return {
            ...prev,
            photos: [...prev.photos, ...newPhotos.filter(p => !seen.has(p.photoId))],
            page: page + 1,
            hasMore: response.data.hasMore ?? false,
          };
        });
      })
      .catch(err => console.error('Error loading more section photos:', err))
      .finally(() => setSectionLoadingMore(false));
  };
  sectionLoadMoreRef.current = loadMoreSectionPhotos;

  // Section IntersectionObserver — re-attach when section changes
  useEffect(() => {
    const sentinel = sectionSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) sectionLoadMoreRef.current(); },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [expandedSection?.sub.albumId]);

  const saveSections = async () => {
    if (!albumId) return;
    try {
      setSavingSections(true);
      await photoService.setSubAlbums(albumId, selectedSubAlbumIds);
      await fetchAlbum(); // refresh to get updated subAlbums
      setShowManageSections(false);
    } catch (e) {
      console.error('Error saving sections:', e);
    } finally {
      setSavingSections(false);
    }
  };

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedPerson(null);
    setExpandedSection(null);
    if (mode === 'people') fetchPeople();
  };

  const addPhotosToAlbum = async () => {
    if (!album || selectedPhotoIds.length === 0) return;
    
    try {
      setAddingPhotos(true);
      const response = await photoService.addPhotosToAlbum(album.albumId, selectedPhotoIds);
      
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
  const setAlbumCover = async (photoId: string) => {
    if (!albumId) return;
    try {
      await photoService.updateAlbum(albumId, { coverPhotoId: photoId });
      await fetchAlbum();
    } catch (e) {
      console.error('Error setting cover:', e);
    }
  };

  const removePhotoFromAlbum = async (photoId: string) => {
    if (!album) return;
    if (!confirm('Remove this photo from the album?')) return;
    try {
      const response = await photoService.removePhotoFromAlbum(album.albumId, photoId);
      if (response.success) {
        setAlbumPhotos(albumPhotos.filter(p => p.photoId !== photoId));
        // Close photo viewer if it's the removed photo
        if (selectedPhoto?.photoId === photoId) {
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
    navigate(`/albums/${albumId}/photos/${photo.photoId}`, { replace: true });
  };
  const handleClosePhoto = () => {
    setSelectedPhoto(null);
    navigate(`/albums/${albumId}`, { replace: true });
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
                  <span>• Created {formatDate(album.createdAt)}</span>
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
        <div className="relative mb-6">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl opacity-20 blur"></div>
          <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/50">
            {editingDescription ? (
              <div className="flex gap-2 items-start">
                <textarea
                  autoFocus
                  className="flex-1 text-sm text-gray-700 bg-transparent border border-cyan-300 rounded-lg p-2 resize-none outline-none focus:ring-2 focus:ring-cyan-400"
                  rows={3}
                  value={descriptionDraft}
                  onChange={e => setDescriptionDraft(e.target.value)}
                  placeholder="Add a description for this album…"
                />
                <div className="flex flex-col gap-1">
                  <button
                    disabled={savingDescription}
                    onClick={async () => {
                      setSavingDescription(true);
                      try {
                        await photoService.updateAlbum(albumId!, { description: descriptionDraft });
                        setAlbum(prev => prev ? { ...prev, description: descriptionDraft } : prev);
                        setEditingDescription(false);
                      } catch { /* ignore */ } finally { setSavingDescription(false); }
                    }}
                    className="p-1.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                    title="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingDescription(false)}
                    className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-700 flex-1">
                  {album.description || <span className="text-gray-400 italic">No description — click to add one</span>}
                </p>
                <button
                  onClick={() => { setDescriptionDraft(album.description ?? ''); setEditingDescription(true); }}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                  title="Edit description"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Photos Section */}
        <div className="relative">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full opacity-20 blur-2xl animate-float"></div>
          
          <div className="relative bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border-2 border-white/50 overflow-hidden">
            <div className="p-6 border-b border-gray-100/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-xl shadow-md">
                  {viewMode === 'people' ? <Users className="h-5 w-5 text-white" /> : <ImageIcon className="h-5 w-5 text-white" />}
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  {viewMode === 'people' ? (selectedPerson ? selectedPerson.person.name : 'People in Album') : 'Photos in Album'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {/* View toggle */}
                <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 shadow-sm flex-wrap gap-0.5">
                  {([
                    ['photos', 'Photos', <LayoutGrid className="h-4 w-4" />],
                    ['videos', 'Videos', <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>],
                    ['people', 'People', <Users className="h-4 w-4" />],
                    ['sections', 'Sections', <FolderOpen className="h-4 w-4" />],
                  ] as [ViewMode, string, React.ReactNode][]).map(([mode, label, icon]) => (
                    <button
                      key={mode}
                      onClick={() => handleViewMode(mode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === mode ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {icon}{label}
                    </button>
                  ))}
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
            </div>
          
          <div className="p-6">
            {/* ── Photos view ── */}
            {viewMode === 'photos' && (
              albumPhotos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {albumPhotos.map((photo, index) => (
                    <div
                      key={`album-photo-${photo.photoId || photo.filename || index}`}
                      className="group relative cursor-pointer"
                      onClick={() => handleOpenPhoto(photo)}
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        {(photo.thumbnailUrl || photo.downloadUrl) && photo.mimeType?.startsWith('image/') ? (
                          <img src={photo.thumbnailUrl ?? photo.downloadUrl} alt={photo.originalName} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-1.5">
                        {photo.mimeType?.startsWith('image/') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAlbumCover(photo.photoId as string); }}
                            className="bg-yellow-500/90 backdrop-blur-sm text-white p-2 rounded-full hover:bg-yellow-600"
                            title="Set as album cover"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); removePhotoFromAlbum(photo.photoId as string); }} className="bg-red-500/80 backdrop-blur-sm text-white p-2 rounded-full hover:bg-red-600" title="Remove from album">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
                        <p className="text-xs font-semibold truncate">{photo.originalName}</p>
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
                  <button onClick={() => setShowAddPhotos(true)} className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Plus className="h-5 w-5 mr-2 inline" />Add Photos
                  </button>
                </div>
              )
            )}

            {/* Infinite scroll sentinel for photos tab */}
            {viewMode === 'photos' && (
              <>
                <div ref={sentinelRef} className="h-4" />
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-cyan-500" />
                  </div>
                )}
                {!hasMorePhotos && albumPhotos.length > 0 && (
                  <p className="text-center text-xs text-gray-400 py-3">
                    All {totalPhotos} photos loaded
                  </p>
                )}
              </>
            )}

            {/* ── Videos view ── */}
            {viewMode === 'videos' && (() => {
              const videos = albumPhotos.filter(p => p.mimeType?.startsWith('video/'));
              return videos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {videos.map((photo, index) => (
                    <div key={`video-${photo.photoId || index}`} className="group relative cursor-pointer" onClick={() => handleOpenPhoto(photo)}>
                      <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden relative">
                        <video src={photo.downloadUrl} className="w-full h-full object-cover" muted preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/50 rounded-full p-3 group-hover:bg-black/70 transition-all">
                            <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); removePhotoFromAlbum(photo.photoId as string); }} className="bg-red-500/80 text-white p-2 rounded-full hover:bg-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs font-semibold truncate">{photo.originalName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="bg-gray-100 p-8 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <svg className="h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800">No videos in this album</h3>
                </div>
              );
            })()}

            {/* ── Sections view ── */}
            {viewMode === 'sections' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm text-gray-500">Click a section to expand its photos inline.</p>
                  <button onClick={openManageSections} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-cyan-400 hover:text-cyan-700 transition-all shadow-sm">
                    <Settings2 className="h-4 w-4" />Manage Sections
                  </button>
                </div>
                {(album.subAlbums ?? []).length > 0 ? (
                  <div className="space-y-4">
                    {(album.subAlbums ?? []).map(sub => {
                      const isOpen = expandedSection?.sub.albumId === sub.albumId;
                      return (
                        <div key={sub.albumId} className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                          {/* Section header — click to expand */}
                          <button
                            onClick={() => openSection(sub)}
                            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-lg">
                                <FolderOpen className="h-4 w-4 text-white" />
                              </div>
                              <span className="font-bold text-gray-900">{sub.title}</span>
                            </div>
                            <ChevronLeft className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isOpen ? '-rotate-90' : 'rotate-180'}`} />
                          </button>

                          {/* Inline photo grid */}
                          {isOpen && (
                            <div className="p-4 bg-white">
                              {sectionLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                                </div>
                              ) : expandedSection.photos.length > 0 ? (
                                <>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                    {expandedSection.photos.map((photo, idx) => (
                                      <div key={photo.photoId || idx} className="group relative cursor-pointer" onClick={() => handleOpenPhoto(photo)}>
                                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                          {(photo.thumbnailUrl || photo.downloadUrl) && photo.mimeType?.startsWith('image/') ? (
                                            <img src={photo.thumbnailUrl ?? photo.downloadUrl} alt={photo.originalName} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                          ) : photo.downloadUrl && photo.mimeType?.startsWith('video/') ? (
                                            <div className="w-full h-full bg-gray-900 relative flex items-center justify-center">
                                              <video src={photo.downloadUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="bg-black/50 rounded-full p-2"><svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="w-full h-full bg-gray-200 flex items-center justify-center"><ImageIcon className="h-6 w-6 text-gray-400" /></div>
                                          )}
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg">
                                          <p className="text-xs text-white truncate">{photo.originalName}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {/* Section scroll sentinel */}
                                  <div ref={sectionSentinelRef} className="h-4" />
                                  {sectionLoadingMore && (
                                    <div className="flex justify-center py-3">
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
                                    </div>
                                  )}
                                  {!expandedSection.hasMore && (
                                    <p className="text-center text-xs text-gray-400 py-2">All {expandedSection.photos.length} photos loaded</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-center text-sm text-gray-400 py-6">No photos in this section.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-700">No sections yet</h3>
                    <p className="text-sm text-gray-500 mt-1">Click "Manage Sections" to link sub-albums to this album.</p>
                    <button onClick={openManageSections} className="mt-4 px-5 py-2.5 bg-cyan-500 text-white rounded-xl text-sm font-medium hover:bg-cyan-600 transition-colors">
                      <Settings2 className="h-4 w-4 mr-2 inline" />Manage Sections
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── People view ── */}
            {viewMode === 'people' && (
              peopleLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600"></div>
                </div>
              ) : selectedPerson ? (
                /* Person's photos inside the album */
                <div>
                  <button onClick={() => setSelectedPerson(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-cyan-600 mb-5 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                    Back to People
                  </button>
                  <div className="flex items-center gap-3 mb-5">
                    {selectedPerson.person.coverUrl ? (
                      <img src={selectedPerson.person.coverUrl} alt={selectedPerson.person.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-cyan-400" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                        {selectedPerson.person.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900">{selectedPerson.person.name}</p>
                      <p className="text-sm text-gray-500">{selectedPerson.photoIds.length} photos in this album</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {albumPhotos
                      .filter(p => selectedPerson.photoIds.includes(p.photoId as string))
                      .map((photo, index) => (
                        <div key={`person-photo-${photo.photoId || index}`} className="group relative cursor-pointer" onClick={() => handleOpenPhoto(photo)}>
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            {(photo.thumbnailUrl || photo.downloadUrl) && photo.mimeType?.startsWith('image/') ? (
                              <img src={photo.thumbnailUrl ?? photo.downloadUrl} alt={photo.originalName} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : photo.downloadUrl && photo.mimeType.startsWith('video/') ? (
                              <div className="w-full h-full bg-gray-900 relative flex items-center justify-center">
                                <video src={photo.downloadUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="bg-black/50 rounded-full p-2"><svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center"><ImageIcon className="h-8 w-8 text-gray-400" /></div>
                            )}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs font-semibold truncate">{photo.originalName}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : peopleGroups.length > 0 ? (
                /* People grid */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {peopleGroups.map(group => (
                    <button
                      key={group.person.personId}
                      onClick={() => setSelectedPerson(group)}
                      className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-cyan-50 transition-all hover:shadow-md"
                    >
                      <div className="relative">
                        {group.person.coverUrl ? (
                          <img src={group.person.coverUrl} alt={group.person.name} className="w-20 h-20 rounded-full object-cover ring-4 ring-white group-hover:ring-cyan-300 shadow-md transition-all" />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-2xl ring-4 ring-white shadow-md">
                            {group.person.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 bg-cyan-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                          {group.photoIds.length}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-cyan-700 text-center transition-colors leading-tight">
                        {group.person.name}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="bg-gray-100 p-8 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <Users className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800">No face data yet</h3>
                  <p className="text-gray-500 mt-2">Go to the People page and run "Scan All" to detect faces in your photos.</p>
                </div>
              )
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
                        const photoId = (photo.photoId) as string;
                        return !photoId || !album.photoIds?.includes(photoId);
                      })
                      .map((photo, index) => {
                        const photoId = (photo.photoId) as string;
                        const isSelected = selectedPhotoIds.includes(photoId);
                        
                        return (
                          <div
                            key={`modal-photo-${photo.photoId || photo.filename || index}`}
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
                            {(photo.thumbnailUrl || photo.downloadUrl) && photo.mimeType?.startsWith('image/') ? (
                              <img
                                src={photo.downloadUrl}
                                alt={photo.originalName}
                                className="w-full h-full object-cover"
                              />
                            ) : photo.downloadUrl && photo.mimeType?.startsWith('video/') ? (
                              <div className="w-full h-full bg-gray-900 flex items-center justify-center relative">
                                <video src={photo.downloadUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="bg-black/50 rounded-full p-1.5">
                                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                  </div>
                                </div>
                              </div>
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
                              <p className="text-xs text-white truncate">{photo.originalName}</p>
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
      {/* Manage Sections Modal */}
      {showManageSections && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Manage Sections</h3>
              <button onClick={() => setShowManageSections(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Select albums to show as sections inside this album. They'll appear in the Sections tab.</p>
            <div className="max-h-72 overflow-y-auto space-y-2 mb-5">
              {allUserAlbums.map(a => {
                const selected = selectedSubAlbumIds.includes(a.albumId);
                const forbidden = forbiddenSubAlbumIds.has(a.albumId);
                return (
                  <label
                    key={a.albumId}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      forbidden
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : selected
                        ? 'border-cyan-400 bg-cyan-50 cursor-pointer'
                        : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={forbidden}
                      onChange={() => !forbidden && setSelectedSubAlbumIds(sel =>
                        sel.includes(a.albumId) ? sel.filter(id => id !== a.albumId) : [...sel, a.albumId]
                      )}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800">{a.title}</span>
                      {forbidden && <span className="ml-2 text-xs text-red-400">Would create a loop</span>}
                    </div>
                  </label>
                );
              })}
              {allUserAlbums.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No other albums found.</p>}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowManageSections(false)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={saveSections} disabled={savingSections} className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 text-sm font-medium disabled:opacity-50">
                {savingSections ? 'Saving…' : 'Save Sections'}
              </button>
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
