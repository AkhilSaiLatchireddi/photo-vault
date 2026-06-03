import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID, randomBytes } from 'crypto';

const TABLE = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'photovault-users',
  PHOTOS: process.env.DYNAMODB_PHOTOS_TABLE || 'photovault-photos',
  ALBUMS: process.env.DYNAMODB_ALBUMS_TABLE || 'photovault-albums',
};

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export interface User {
  userId: string;
  auth0Id: string;
  email: string;
  username: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  profile?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    bio?: string;
    location?: string;
    website?: string;
    preferences?: { theme?: string; privacy?: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  photoId: string;
  userId: string;
  filename: string;
  s3Key: string;
  thumbnailS3Key?: string;   // compressed ~400px thumbnail stored separately
  originalName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  takenAt?: string;
  uploadedAt: string;
  metadata?: Record<string, unknown>;
}

export interface Album {
  albumId: string;
  userId: string;
  title: string;
  description?: string;
  coverPhotoId?: string;
  photoIds: string[];
  subAlbumIds?: string[];   // ordered list of child album IDs (for the Sections/Events tab)
  isPublic: boolean;
  publicToken?: string;
  publicExpiresAt?: string;
  sharedWith: { email?: string; userId?: string; permission: 'view' | 'edit'; sharedAt: string }[];
  createdAt: string;
  updatedAt: string;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserByAuth0Id(auth0Id: string): Promise<User | null> {
  // auth0Id is a GSI partition key on the users table
  const res = await db.send(new QueryCommand({
    TableName: TABLE.USERS,
    IndexName: 'auth0Id-index',
    KeyConditionExpression: 'auth0Id = :id',
    ExpressionAttributeValues: { ':id': auth0Id },
    Limit: 1,
  }));
  return (res.Items?.[0] as User) ?? null;
}

export async function getUserById(userId: string): Promise<User | null> {
  const res = await db.send(new GetCommand({ TableName: TABLE.USERS, Key: { userId } }));
  return (res.Item as User) ?? null;
}

export async function createUser(data: Omit<User, 'userId' | 'createdAt' | 'updatedAt'>): Promise<User> {
  const now = new Date().toISOString();
  const user: User = { ...data, userId: randomUUID(), createdAt: now, updatedAt: now };
  await db.send(new PutCommand({ TableName: TABLE.USERS, Item: user }));
  return user;
}

export async function updateUser(userId: string, patch: Partial<Omit<User, 'userId' | 'auth0Id' | 'createdAt'>>): Promise<User> {
  const now = new Date().toISOString();
  const merged = { ...patch, updatedAt: now };
  const sets = Object.keys(merged).map((k, i) => `#f${i} = :v${i}`).join(', ');
  const names = Object.fromEntries(Object.keys(merged).map((k, i) => [`#f${i}`, k]));
  const values = Object.fromEntries(Object.keys(merged).map((k, i) => [`:v${i}`, (merged as any)[k]]));

  const res = await db.send(new UpdateCommand({
    TableName: TABLE.USERS,
    Key: { userId },
    UpdateExpression: `SET ${sets}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes as User;
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export async function createPhoto(data: Omit<Photo, 'photoId' | 'uploadedAt'>): Promise<Photo> {
  const photo: Photo = { ...data, photoId: randomUUID(), uploadedAt: new Date().toISOString() };
  await db.send(new PutCommand({ TableName: TABLE.PHOTOS, Item: photo }));
  return photo;
}

export async function getUserPhotos(userId: string, limit = 50, lastKey?: Record<string, unknown>): Promise<{ photos: Photo[]; nextKey?: Record<string, unknown> }> {
  const res = await db.send(new QueryCommand({
    TableName: TABLE.PHOTOS,
    IndexName: 'userId-uploadedAt-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false,
    Limit: limit,
    ExclusiveStartKey: lastKey,
  }));
  return { photos: (res.Items ?? []) as Photo[], nextKey: res.LastEvaluatedKey };
}

export async function getPhotoById(photoId: string, userId: string): Promise<Photo | null> {
  const res = await db.send(new GetCommand({ TableName: TABLE.PHOTOS, Key: { photoId } }));
  const item = res.Item as Photo | undefined;
  if (!item || item.userId !== userId) return null;
  return item;
}

export async function getPhotoByS3Key(s3Key: string): Promise<Photo | null> {
  // Scan with filter — s3Key is unique but not the primary key
  const res = await db.send(new ScanCommand({
    TableName: TABLE.PHOTOS,
    FilterExpression: 's3Key = :key',
    ExpressionAttributeValues: { ':key': s3Key },
  }));
  return (res.Items?.[0] as Photo) ?? null;
}

export async function getPhotosByIds(photoIds: string[]): Promise<Photo[]> {
  if (photoIds.length === 0) return [];
  const photos: Photo[] = [];
  // BatchGetItem handles max 100 keys per call
  for (let i = 0; i < photoIds.length; i += 100) {
    const chunk = photoIds.slice(i, i + 100);
    const res = await db.send(new BatchGetCommand({
      RequestItems: {
        [TABLE.PHOTOS]: {
          Keys: chunk.map(id => ({ photoId: id })),
        },
      },
    }));
    const items = (res.Responses?.[TABLE.PHOTOS] ?? []) as Photo[];
    photos.push(...items);
    // Handle unprocessed keys (rare — capacity throttle)
    // Simple retry not needed at this scale; items just won't appear
  }
  // Restore original order (BatchGet returns unordered)
  const map = new Map(photos.map(p => [p.photoId, p]));
  return photoIds.map(id => map.get(id)).filter(Boolean) as Photo[];
}

export async function updatePhoto(photoId: string, userId: string, patch: Partial<Pick<Photo, 's3Key' | 'mimeType' | 'width' | 'height' | 'thumbnailS3Key'>>): Promise<void> {
  const existing = await getPhotoById(photoId, userId);
  if (!existing) return;
  const merged = { ...patch, updatedAt: new Date().toISOString() };
  const sets = Object.keys(merged).map((k, i) => `#f${i} = :v${i}`).join(', ');
  const names = Object.fromEntries(Object.keys(merged).map((k, i) => [`#f${i}`, k]));
  const values = Object.fromEntries(Object.keys(merged).map((k, i) => [`:v${i}`, (merged as any)[k]]));
  await db.send(new UpdateCommand({
    TableName: TABLE.PHOTOS,
    Key: { photoId },
    UpdateExpression: `SET ${sets}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function deletePhoto(photoId: string, userId: string): Promise<boolean> {
  const photo = await getPhotoById(photoId, userId);
  if (!photo) return false;
  await db.send(new DeleteCommand({ TableName: TABLE.PHOTOS, Key: { photoId } }));
  return true;
}

export async function getPhotoStats(userId: string): Promise<{ totalPhotos: number; totalSize: number }> {
  // For stats we do a query on the GSI — acceptable for small-medium collections
  const res = await db.send(new QueryCommand({
    TableName: TABLE.PHOTOS,
    IndexName: 'userId-uploadedAt-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    Select: 'ALL_PROJECTED_ATTRIBUTES',
  }));
  const photos = (res.Items ?? []) as Photo[];
  return {
    totalPhotos: photos.length,
    totalSize: photos.reduce((sum, p) => sum + (p.fileSize || 0), 0),
  };
}

// ─── Albums ───────────────────────────────────────────────────────────────────

export async function createAlbum(data: { userId: string; title: string; description?: string }): Promise<Album> {
  const now = new Date().toISOString();
  const album: Album = {
    albumId: randomUUID(),
    ...data,
    photoIds: [],
    sharedWith: [],
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.send(new PutCommand({ TableName: TABLE.ALBUMS, Item: album }));
  return album;
}

export async function getUserAlbums(userId: string): Promise<Album[]> {
  const res = await db.send(new QueryCommand({
    TableName: TABLE.ALBUMS,
    IndexName: 'userId-createdAt-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false,
  }));
  return (res.Items ?? []) as Album[];
}

export async function getAlbumById(albumId: string, requestingUserId?: string): Promise<Album | null> {
  const res = await db.send(new GetCommand({ TableName: TABLE.ALBUMS, Key: { albumId } }));
  const album = res.Item as Album | undefined;
  if (!album) return null;

  if (requestingUserId) {
    const isOwner = album.userId === requestingUserId;
    const isShared = album.sharedWith.some(s => s.userId === requestingUserId);
    if (!isOwner && !isShared && !album.isPublic) return null;
  }
  return album;
}

export async function getAlbumByToken(token: string): Promise<Album | null> {
  const res = await db.send(new QueryCommand({
    TableName: TABLE.ALBUMS,
    IndexName: 'publicToken-index',
    KeyConditionExpression: 'publicToken = :token',
    ExpressionAttributeValues: { ':token': token },
    Limit: 1,
  }));
  const album = res.Items?.[0] as Album | undefined;
  if (!album || !album.isPublic) return null;
  if (album.publicExpiresAt && new Date(album.publicExpiresAt) < new Date()) return null;
  return album;
}

export async function getSubAlbums(subAlbumIds: string[]): Promise<{ albumId: string; title: string; publicToken?: string }[]> {
  if (!subAlbumIds || subAlbumIds.length === 0) return [];
  const results = await Promise.all(
    subAlbumIds.map(id =>
      db.send(new GetCommand({ TableName: TABLE.ALBUMS, Key: { albumId: id } }))
        .then(r => r.Item as Album | undefined)
    )
  );
  return results
    .filter((a): a is Album => !!a)
    .map(a => ({ albumId: a.albumId, title: a.title, publicToken: a.publicToken }));
}

export async function updateAlbum(albumId: string, userId: string, patch: Partial<Pick<Album, 'title' | 'description' | 'coverPhotoId' | 'isPublic' | 'publicToken' | 'publicExpiresAt' | 'photoIds' | 'subAlbumIds' | 'sharedWith'>>): Promise<Album | null> {
  const existing = await getAlbumById(albumId);
  if (!existing || existing.userId !== userId) return null;

  const merged = { ...patch, updatedAt: new Date().toISOString() };
  const sets = Object.keys(merged).map((k, i) => `#f${i} = :v${i}`).join(', ');
  const names = Object.fromEntries(Object.keys(merged).map((k, i) => [`#f${i}`, k]));
  const values = Object.fromEntries(Object.keys(merged).map((k, i) => [`:v${i}`, (merged as any)[k]]));

  const res = await db.send(new UpdateCommand({
    TableName: TABLE.ALBUMS,
    Key: { albumId },
    UpdateExpression: `SET ${sets}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes as Album;
}

export async function deleteAlbum(albumId: string, userId: string): Promise<boolean> {
  const album = await getAlbumById(albumId);
  if (!album || album.userId !== userId) return false;
  await db.send(new DeleteCommand({ TableName: TABLE.ALBUMS, Key: { albumId } }));
  return true;
}

export async function addPhotosToAlbum(albumId: string, userId: string, photoIds: string[]): Promise<boolean> {
  const album = await getAlbumById(albumId);
  if (!album || album.userId !== userId) return false;

  const merged = [...new Set([...album.photoIds, ...photoIds])];
  await db.send(new UpdateCommand({
    TableName: TABLE.ALBUMS,
    Key: { albumId },
    UpdateExpression: 'SET photoIds = :ids, updatedAt = :now',
    ExpressionAttributeValues: { ':ids': merged, ':now': new Date().toISOString() },
  }));
  return true;
}

export async function removePhotoFromAlbum(albumId: string, userId: string, photoId: string): Promise<boolean> {
  const album = await getAlbumById(albumId);
  if (!album || album.userId !== userId) return false;

  const updated = album.photoIds.filter(id => id !== photoId);
  await db.send(new UpdateCommand({
    TableName: TABLE.ALBUMS,
    Key: { albumId },
    UpdateExpression: 'SET photoIds = :ids, updatedAt = :now',
    ExpressionAttributeValues: { ':ids': updated, ':now': new Date().toISOString() },
  }));
  return true;
}

export async function generatePublicToken(albumId: string, userId: string, expiresAt?: string): Promise<string | null> {
  const album = await getAlbumById(albumId);
  if (!album || album.userId !== userId) return null;

  const token = randomBytes(32).toString('hex');
  await db.send(new UpdateCommand({
    TableName: TABLE.ALBUMS,
    Key: { albumId },
    UpdateExpression: 'SET isPublic = :t, publicToken = :tok, publicExpiresAt = :exp, updatedAt = :now',
    ExpressionAttributeValues: {
      ':t': true,
      ':tok': token,
      ':exp': expiresAt ?? null,
      ':now': new Date().toISOString(),
    },
  }));
  return token;
}

export async function revokePublicAccess(albumId: string, userId: string): Promise<boolean> {
  const album = await getAlbumById(albumId);
  if (!album || album.userId !== userId) return false;

  await db.send(new UpdateCommand({
    TableName: TABLE.ALBUMS,
    Key: { albumId },
    UpdateExpression: 'SET isPublic = :f, updatedAt = :now REMOVE publicToken, publicExpiresAt',
    ExpressionAttributeValues: { ':f': false, ':now': new Date().toISOString() },
  }));
  return true;
}

export async function shareAlbum(albumId: string, ownerId: string, share: { email?: string; userId?: string; permission: 'view' | 'edit' }): Promise<boolean> {
  const album = await getAlbumById(albumId);
  if (!album || album.userId !== ownerId) return false;

  const already = album.sharedWith.some(s =>
    (share.email && s.email === share.email) || (share.userId && s.userId === share.userId)
  );
  if (already) return false;

  const entry = { ...share, sharedAt: new Date().toISOString() };
  const updated = [...album.sharedWith, entry];

  await db.send(new UpdateCommand({
    TableName: TABLE.ALBUMS,
    Key: { albumId },
    UpdateExpression: 'SET sharedWith = :sw, updatedAt = :now',
    ExpressionAttributeValues: { ':sw': updated, ':now': new Date().toISOString() },
  }));
  return true;
}

// ─── People ───────────────────────────────────────────────────────────────────

const TABLE_PEOPLE  = process.env.DYNAMODB_PEOPLE_TABLE      || 'photovault-people-prod-v1';
const TABLE_FACES   = process.env.DYNAMODB_PHOTO_FACES_TABLE || 'photovault-photo-faces-prod-v1';

export interface Person {
  personId: string;
  userId: string;
  name: string;
  faceIds: string[];
  coverFaceS3Key?: string;
  coverBoundingBox?: { left: number; top: number; width: number; height: number };
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoFace {
  photoId: string;
  userId: string;
  faces: {
    faceId: string;
    personId?: string;
    boundingBox: { left: number; top: number; width: number; height: number };
    confidence: number;
  }[];
  processedAt: string;
}

export async function createPerson(data: Pick<Person, 'userId' | 'name' | 'faceIds' | 'coverFaceS3Key' | 'coverBoundingBox'>): Promise<Person> {
  const now = new Date().toISOString();
  const person: Person = { personId: randomUUID(), photoCount: 0, createdAt: now, updatedAt: now, ...data, faceIds: data.faceIds ?? [] };
  await db.send(new PutCommand({ TableName: TABLE_PEOPLE, Item: person }));
  return person;
}

export async function getPeopleByUserId(userId: string): Promise<Person[]> {
  const res = await db.send(new QueryCommand({ TableName: TABLE_PEOPLE, IndexName: 'userId-index', KeyConditionExpression: 'userId = :uid', ExpressionAttributeValues: { ':uid': userId } }));
  return (res.Items ?? []) as Person[];
}

// Returns all distinct userIds whose albums are shared with `userId`.
// Used so a shared user can see faces/people from the album owner.
export async function getSharedAlbumOwnerIds(userId: string): Promise<string[]> {
  // DynamoDB can't filter on list-of-maps with a GSI, so scan + filter in JS.
  // Albums table is small (one row per album) so this is cheap.
  const all = await db.send(new ScanCommand({ TableName: TABLE.ALBUMS }));
  const ownerIds = new Set<string>();
  for (const item of (all.Items ?? []) as Album[]) {
    if ((item.sharedWith ?? []).some(s => s.userId === userId)) {
      ownerIds.add(item.userId);
    }
  }
  return [...ownerIds];
}

// Returns only the photoIds that are inside albums explicitly shared with userId.
// Used to prevent a shared user from seeing private photos that are not in any shared album.
export async function getPhotoIdsVisibleToSharedUser(userId: string): Promise<Set<string>> {
  const all = await db.send(new ScanCommand({ TableName: TABLE.ALBUMS }));
  const visiblePhotoIds = new Set<string>();
  for (const item of (all.Items ?? []) as Album[]) {
    const isShared = (item.sharedWith ?? []).some(s => s.userId === userId);
    const isPublic = item.isPublic;
    if (isShared || isPublic) {
      for (const photoId of (item.photoIds ?? [])) {
        visiblePhotoIds.add(photoId);
      }
    }
  }
  return visiblePhotoIds;
}

export async function getPersonById(personId: string): Promise<Person | null> {
  const res = await db.send(new GetCommand({ TableName: TABLE_PEOPLE, Key: { personId } }));
  return (res.Item as Person) ?? null;
}

export async function updatePerson(personId: string, patch: Partial<Pick<Person, 'name' | 'faceIds' | 'coverFaceS3Key' | 'coverBoundingBox' | 'photoCount'>>): Promise<Person | null> {
  const merged = { ...patch, updatedAt: new Date().toISOString() };
  const sets = Object.keys(merged).map((k, i) => `#f${i} = :v${i}`).join(', ');
  const names = Object.fromEntries(Object.keys(merged).map((k, i) => [`#f${i}`, k]));
  const values = Object.fromEntries(Object.keys(merged).map((k, i) => [`:v${i}`, (merged as any)[k]]));
  const res = await db.send(new UpdateCommand({ TableName: TABLE_PEOPLE, Key: { personId }, UpdateExpression: `SET ${sets}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values, ReturnValues: 'ALL_NEW' }));
  return res.Attributes as Person ?? null;
}

export async function deletePerson(personId: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName: TABLE_PEOPLE, Key: { personId } }));
}

export async function getPersonByFaceId(faceId: string, userId: string): Promise<Person | null> {
  const people = await getPeopleByUserId(userId);
  return people.find(p => p.faceIds.includes(faceId)) ?? null;
}

// ─── Photo Faces ──────────────────────────────────────────────────────────────

export async function savePhotoFaces(photoId: string, userId: string, faces: PhotoFace['faces']): Promise<PhotoFace> {
  // personIds is a top-level string set so the personId-index GSI can index it
  const personIds = [...new Set(faces.map(f => f.personId).filter(Boolean) as string[])];
  const record: any = { photoId, userId, faces, processedAt: new Date().toISOString() };
  if (personIds.length > 0) {
    // Store each unique personId as separate top-level attributes for GSI
    record.personId = personIds[0]; // primary — GSI partition key
    record.personIds = personIds;   // all person IDs for scan-based lookup
  }
  await db.send(new PutCommand({ TableName: TABLE_FACES, Item: record }));
  return record as PhotoFace;
}

export async function getPhotoFaces(photoId: string): Promise<PhotoFace | null> {
  const res = await db.send(new GetCommand({ TableName: TABLE_FACES, Key: { photoId } }));
  return (res.Item as PhotoFace) ?? null;
}

// Batch-fetch face records for multiple photos. Returns only photos that have face data.
export async function getBatchPhotoFaces(photoIds: string[]): Promise<PhotoFace[]> {
  if (photoIds.length === 0) return [];
  // Process in chunks of 100 with parallel Gets (cheap at this scale)
  const results: PhotoFace[] = [];
  for (let i = 0; i < photoIds.length; i += 100) {
    const chunk = photoIds.slice(i, i + 100);
    const fetched = await Promise.all(
      chunk.map(id =>
        db.send(new GetCommand({ TableName: TABLE_FACES, Key: { photoId: id } }))
          .then(r => r.Item as PhotoFace | undefined)
      )
    );
    results.push(...fetched.filter((f): f is PhotoFace => !!f && (f.faces?.length ?? 0) > 0));
  }
  return results;
}

// Given a list of photoIds, returns [{person, photoIds, coverUrl}] grouped by person.
// Only includes people whose faces appear in the provided photo set.
export async function getPeopleInPhotoSet(photoIds: string[], albumOwnerId: string): Promise<
  { person: Person; photoIds: string[] }[]
> {
  const faceRecords = await getBatchPhotoFaces(photoIds);

  // Build map: personId → photoIds[]
  const personPhotoMap = new Map<string, string[]>();
  for (const record of faceRecords) {
    for (const face of record.faces ?? []) {
      if (!face.personId) continue;
      if (!personPhotoMap.has(face.personId)) personPhotoMap.set(face.personId, []);
      const arr = personPhotoMap.get(face.personId)!;
      if (!arr.includes(record.photoId)) arr.push(record.photoId);
    }
  }

  if (personPhotoMap.size === 0) return [];

  // Fetch person records
  const people = await getPeopleByUserId(albumOwnerId);
  const peopleMap = new Map(people.map(p => [p.personId, p]));

  const result: { person: Person; photoIds: string[] }[] = [];
  for (const [personId, pPhotoIds] of personPhotoMap) {
    const person = peopleMap.get(personId);
    if (!person) continue;
    result.push({ person, photoIds: pPhotoIds });
  }

  // Sort by photo count descending (most-seen person first)
  return result.sort((a, b) => b.photoIds.length - a.photoIds.length);
}

export async function updatePhotoFacePersonId(photoId: string, faceId: string, personId: string): Promise<void> {
  const existing = await getPhotoFaces(photoId);
  if (!existing) return;
  const updatedFaces = existing.faces.map(f => f.faceId === faceId ? { ...f, personId } : f);
  await db.send(new UpdateCommand({ TableName: TABLE_FACES, Key: { photoId }, UpdateExpression: 'SET faces = :f', ExpressionAttributeValues: { ':f': updatedFaces } }));
}

export async function getPhotosByPersonId(personId: string): Promise<string[]> {
  // Scan photo-faces table filtering by personIds list attribute
  // This works reliably regardless of GSI indexing of nested attributes
  const res = await db.send(new ScanCommand({
    TableName: TABLE_FACES,
    FilterExpression: 'contains(personIds, :pid)',
    ExpressionAttributeValues: { ':pid': personId },
  }));
  return (res.Items ?? []).map((item: any) => item.photoId as string);
}
