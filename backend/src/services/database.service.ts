import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
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

export async function getPhotosByIds(photoIds: string[]): Promise<Photo[]> {
  if (photoIds.length === 0) return [];
  const results = await Promise.all(
    photoIds.map(id => db.send(new GetCommand({ TableName: TABLE.PHOTOS, Key: { photoId: id } })))
  );
  return results.map(r => r.Item).filter(Boolean) as Photo[];
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

export async function updateAlbum(albumId: string, userId: string, patch: Partial<Pick<Album, 'title' | 'description' | 'coverPhotoId' | 'isPublic' | 'publicToken' | 'publicExpiresAt' | 'photoIds' | 'sharedWith'>>): Promise<Album | null> {
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
