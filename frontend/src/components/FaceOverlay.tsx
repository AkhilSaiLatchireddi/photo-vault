import { useState, useEffect } from 'react';
import { UserPlus, Check, ChevronDown } from 'lucide-react';
import { config } from '../config/env';
import { useAuth0 } from '@auth0/auth0-react';

const API = config.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface BoundingBox { left: number; top: number; width: number; height: number }

interface Face {
  faceId: string;
  personId?: string;
  personName?: string | null;
  boundingBox: BoundingBox;
  confidence: number;
}

interface Person { personId: string; name: string }

interface Props {
  photoId: string;
  imageWidth?: number;
  imageHeight?: number;
}

export default function FaceOverlay({ photoId }: Props) {
  const { getAccessTokenSilently } = useAuth0();
  const [faces, setFaces] = useState<Face[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null); // faceId being assigned
  const [newName, setNewName] = useState('');
  const [detected, setDetected] = useState(false);

  const getToken = async () => {
    try {
      return await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE } });
    } catch { return null; }
  };

  // Load existing face data on mount
  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      const res = await fetch(`${API}/api/people/faces/${photoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setFaces(data.data.faces ?? []);
        setDetected(true);
      }
    };
    load();
  }, [photoId]);

  // Load people list for assignment dropdown
  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      const res = await fetch(`${API}/api/people`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setPeople(data.data);
    };
    load();
  }, []);

  const detectFaces = async () => {
    setDetecting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/people/detect/${photoId}?force=1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setFaces(data.data.faces ?? []);
        setDetected(true);
        // Reload enriched face data with names
        const res2 = await fetch(`${API}/api/people/faces/${photoId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data2 = await res2.json();
        if (data2.success && data2.data) setFaces(data2.data.faces ?? []);
      }
    } finally {
      setDetecting(false);
    }
  };

  const assignFace = async (faceId: string, personId?: string) => {
    const token = await getToken();
    const body: any = { photoId, faceId };
    if (personId) body.personId = personId;
    else if (newName.trim()) body.newPersonName = newName.trim();
    else return;

    const res = await fetch(`${API}/api/people/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      // Reload faces
      const res2 = await fetch(`${API}/api/people/faces/${photoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data2 = await res2.json();
      if (data2.success && data2.data) setFaces(data2.data.faces ?? []);
      setAssigning(null);
      setNewName('');
      // Refresh people list
      const res3 = await fetch(`${API}/api/people`, { headers: { Authorization: `Bearer ${token}` } });
      const data3 = await res3.json();
      if (data3.success) setPeople(data3.data);
    }
  };

  if (!detected && !detecting && faces.length === 0) {
    return (
      <button
        onClick={detectFaces}
        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors shadow"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Detect Faces
      </button>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Detect button if no faces yet */}
      {detected && faces.length === 0 && (
        <div className="absolute bottom-2 left-2 z-10">
          <span className="text-xs text-white/70 bg-black/40 px-2 py-1 rounded">No faces found</span>
          <button
            onClick={detectFaces}
            disabled={detecting}
            className="ml-2 text-xs text-white bg-purple-600/80 hover:bg-purple-600 px-2 py-1 rounded"
          >
            {detecting ? 'Detecting…' : 'Re-detect'}
          </button>
        </div>
      )}

      {detecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-white border-t-purple-500" />
        </div>
      )}

      {/* Face bounding boxes */}
      {faces.map(face => {
        const { left, top, width, height } = face.boundingBox;
        const isAssigning = assigning === face.faceId;

        return (
          <div key={face.faceId}>
            {/* Box */}
            <div
              className={`absolute border-2 cursor-pointer transition-colors ${
                face.personName ? 'border-purple-400' : 'border-yellow-400'
              }`}
              style={{
                left: `${left * 100}%`,
                top: `${top * 100}%`,
                width: `${width * 100}%`,
                height: `${height * 100}%`,
              }}
              onClick={() => setAssigning(isAssigning ? null : face.faceId)}
            />

            {/* Name chip below the box */}
            <div
              className="absolute z-10 flex items-center"
              style={{
                left: `${left * 100}%`,
                top: `${(top + height) * 100 + 0.5}%`,
              }}
            >
              <button
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shadow-lg transition-colors ${
                  face.personName
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'
                }`}
                onClick={() => setAssigning(isAssigning ? null : face.faceId)}
              >
                {face.personName ?? 'Who is this?'}
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
            </div>

            {/* Assignment dropdown */}
            {isAssigning && (
              <div
                className="absolute z-30 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-52"
                style={{
                  left: `${left * 100}%`,
                  top: `${(top + height) * 100 + 4}%`,
                }}
              >
                <p className="text-xs font-semibold text-gray-600 mb-2">Identify this person</p>

                {/* Existing people */}
                {people.length > 0 && (
                  <div className="mb-2 space-y-1 max-h-32 overflow-y-auto">
                    {people.map(p => (
                      <button
                        key={p.personId}
                        className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2 transition-colors"
                        onClick={() => assignFace(face.faceId, p.personId)}
                      >
                        <Check className="h-3 w-3 text-purple-400 shrink-0" />
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-400 mb-1.5">Or add new person:</p>
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      placeholder="Enter name…"
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') assignFace(face.faceId);
                        if (e.key === 'Escape') setAssigning(null);
                      }}
                    />
                    <button
                      disabled={!newName.trim()}
                      className="px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-purple-700 transition-colors"
                      onClick={() => assignFace(face.faceId)}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <button
                  className="mt-2 text-xs text-gray-400 hover:text-gray-600 w-full text-center"
                  onClick={() => { setAssigning(null); setNewName(''); }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Re-detect button if already detected */}
      {detected && faces.length > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={detectFaces}
            disabled={detecting}
            className="text-xs bg-black/50 hover:bg-black/70 text-white px-2 py-1 rounded-lg transition-colors"
          >
            {detecting ? 'Detecting…' : '↻ Re-detect'}
          </button>
        </div>
      )}
    </div>
  );
}
