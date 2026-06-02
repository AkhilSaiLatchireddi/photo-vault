import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Camera, Edit2, Check, X, Trash2 } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { config } from '../config/env';
import { useAuth0 } from '@auth0/auth0-react';

const API = config.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface Person {
  personId: string;
  name: string;
  photoCount: number;
  coverUrl?: string;
  coverBoundingBox?: { left: number; top: number; width: number; height: number };
}

export default function PeoplePage() {
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const getToken = async () => {
    try {
      return await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE } });
    } catch { return null; }
  };

  const fetchPeople = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await fetch(`${API}/api/people`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setPeople(data.data);
    } catch (e) {
      setError('Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPeople(); }, []);

  const saveName = async (personId: string) => {
    if (!editName.trim()) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/people/${personId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setPeople(p => p.map(x => x.personId === personId ? { ...x, name: editName.trim() } : x));
        setEditingId(null);
      }
    } catch { setError('Failed to update name'); }
  };

  const deletePerson = async (personId: string, name: string) => {
    if (!confirm(`Remove ${name} from People? Their photos won't be deleted.`)) return;
    try {
      const token = await getToken();
      await fetch(`${API}/api/people/${personId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setPeople(p => p.filter(x => x.personId !== personId));
    } catch { setError('Failed to remove person'); }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                People
              </h2>
              <p className="text-gray-500 mt-1">Faces recognised in your photos</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100">
              <Users className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium text-gray-700">{people.length} people</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
              <button className="ml-2 text-red-500 hover:text-red-700" onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin h-10 w-10 rounded-full border-4 border-purple-200 border-t-purple-600" />
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
                <Users className="h-12 w-12 text-purple-300" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No people found yet</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                Open any photo and tap "Detect Faces" to start recognising people in your collection.
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium shadow hover:shadow-md transition-all"
              >
                Go to Photos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {people.map(person => (
                <div
                  key={person.personId}
                  className="group flex flex-col items-center"
                >
                  {/* Face circle */}
                  <div
                    className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer ring-4 ring-white shadow-lg hover:ring-purple-400 transition-all hover:scale-105"
                    onClick={() => editingId !== person.personId && navigate(`/people/${person.personId}`)}
                  >
                    {person.coverUrl ? (
                      <FaceCrop
                        imageUrl={person.coverUrl}
                        boundingBox={person.coverBoundingBox}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                        <Camera className="h-8 w-8 text-purple-400" />
                      </div>
                    )}
                  </div>

                  {/* Name / edit */}
                  <div className="mt-3 w-full text-center">
                    {editingId === person.personId ? (
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          autoFocus
                          className="w-28 text-xs text-center border border-purple-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-400"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveName(person.personId);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button onClick={() => saveName(person.personId)} className="p-1 text-green-600 hover:text-green-800">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className="text-sm font-medium text-gray-800 truncate max-w-[90px] cursor-pointer hover:text-purple-600"
                          onClick={() => navigate(`/people/${person.personId}`)}
                        >
                          {person.name}
                        </span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-purple-600"
                          onClick={() => { setEditingId(person.personId); setEditName(person.name); }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{person.photoCount} photo{person.photoCount !== 1 ? 's' : ''}</p>
                  </div>

                  {/* Delete — shows on hover */}
                  <button
                    className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-red-400 hover:text-red-600 flex items-center gap-0.5"
                    onClick={() => deletePerson(person.personId, person.name)}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// Crops the face from the full photo using bounding box percentages
function FaceCrop({ imageUrl, boundingBox }: {
  imageUrl: string;
  boundingBox?: { left: number; top: number; width: number; height: number };
}) {
  if (!boundingBox) {
    return <img src={imageUrl} alt="face" className="w-full h-full object-cover" />;
  }
  // CSS trick: scale the image so the face fills the container
  const pad = 0.3; // 30% padding around face
  const scale = 1 / (boundingBox.width + pad * 2);
  const offsetX = -(boundingBox.left - pad) * scale * 100;
  const offsetY = -(boundingBox.top - pad) * scale * 100;

  return (
    <img
      src={imageUrl}
      alt="face"
      style={{
        position: 'absolute',
        width: `${scale * 100}%`,
        left: `${offsetX}%`,
        top: `${offsetY}%`,
        maxWidth: 'none',
      }}
    />
  );
}
