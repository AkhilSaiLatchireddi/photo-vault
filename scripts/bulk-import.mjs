/**
 * PhotoVault Bulk Import — Per-Event Albums + Master Album
 *
 * Walks a source directory. Each top-level subfolder becomes its own album.
 * All photos also go into one master album. Every album is made public.
 * Optionally shares all albums with a second user (wife).
 *
 * Usage:
 *   node bulk-import.mjs "/Volumes/One Touch/Akhil Ananya mrg data" [--dry-run]
 *
 * Optional env:
 *   CONCURRENCY=10    — parallel uploads (default 5)
 *   WIFE_USER_ID=xxx  — DynamoDB userId of wife's account (shares all albums)
 */

import { createReadStream, statSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { randomUUID, randomBytes } from 'crypto';
import { lookup as mimeLookup } from 'mime-types';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';

// ── Config ────────────────────────────────────────────────────────────────────
const REGION        = 'us-east-1';
const AWS_PROFILE   = 'photovault-akhil-app-user';
const BUCKET        = 'photovault-app-bucket-akhil';
const PHOTOS_TABLE  = 'photovault-photos-prod-v1';
const ALBUMS_TABLE  = 'photovault-albums-prod-v1';
const USER_ID       = '0781902a-65a7-42df-b0bf-840af42ef879';
const USERNAME      = 'akhil';
const FRONTEND_URL  = 'https://akhilsailatchireddi.github.io/photo-vault';
const CONCURRENCY   = parseInt(process.env.CONCURRENCY || '5', 10);
const WIFE_USER_ID  = process.env.WIFE_USER_ID || null;
const DRY_RUN       = process.argv.includes('--dry-run');

// Supported MIME types
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'image/heic', 'image/heif', 'image/bmp', 'image/tiff', 'image/svg+xml', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv',
  'video/webm', 'video/ogg', 'video/3gpp', 'video/3gpp2',
  'video/mpeg', 'video/x-matroska', 'video/x-flv', 'video/mp2t',
]);

// ── AWS clients ───────────────────────────────────────────────────────────────
const credentials = fromIni({ profile: AWS_PROFILE });
const s3 = new S3Client({ region: REGION, credentials });
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION, credentials }),
  { marshallOptions: { removeUndefinedValues: true } }
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

async function collectFilesInDir(dir) {
  const files = [];
  async function walk(current) {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); }
    catch { console.warn(`  skipping (no access): ${current}`); return; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const mime = mimeLookup(entry.name) || '';
        if (ALLOWED_MIME.has(mime)) {
          files.push({ fullPath: full, name: entry.name, mime });
        }
      }
    }
  }
  await walk(dir);
  return files;
}

async function getTopLevelFolders(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => ({ name: e.name, fullPath: path.join(dir, e.name) }));
}

// Generate a 400px thumbnail buffer using sharp (images only)
async function makeThumbnail(fullPath, mime) {
  if (!mime.startsWith('image/') || mime.includes('svg')) return null;
  try {
    return await sharp(fullPath)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
  } catch {
    return null; // HEIC or unsupported — skip silently
  }
}

async function uploadFile(fileInfo) {
  const { fullPath, name, mime } = fileInfo;
  const fileSize = statSync(fullPath).size;
  const now = new Date();
  const y  = now.getFullYear();
  const m  = String(now.getMonth() + 1).padStart(2, '0');
  const d  = String(now.getDate()).padStart(2, '0');
  const ext = path.extname(name).replace('.', '').toLowerCase() || mime.split('/')[1];
  const uuid = randomUUID();
  const s3Key = `users/${USERNAME}/photos/${y}/${m}/${d}/${uuid}.${ext}`;
  const thumbS3Key = `users/${USERNAME}/thumbs/${uuid}.jpg`;

  // Generate thumbnail and upload original in parallel
  const [thumbBuffer] = await Promise.all([
    makeThumbnail(fullPath, mime),
    new Upload({
      client: s3,
      params: { Bucket: BUCKET, Key: s3Key, Body: createReadStream(fullPath), ContentType: mime },
      queueSize: 4,
      partSize: 10 * 1024 * 1024,
      leavePartsOnError: false,
    }).done(),
  ]);

  // Upload thumbnail if generated
  if (thumbBuffer) {
    await new Upload({
      client: s3,
      params: { Bucket: BUCKET, Key: thumbS3Key, Body: thumbBuffer, ContentType: 'image/jpeg' },
      queueSize: 1, partSize: 5 * 1024 * 1024, leavePartsOnError: false,
    }).done();
  }

  const photo = {
    photoId: uuid,
    userId: USER_ID,
    filename: `${uuid}.${ext}`,
    s3Key,
    thumbnailS3Key: thumbBuffer ? thumbS3Key : undefined,
    originalName: name,
    mimeType: mime,
    fileSize,
    uploadedAt: now.toISOString(),
  };
  await dynamo.send(new PutCommand({ TableName: PHOTOS_TABLE, Item: photo }));
  return photo;
}

async function createAlbum(title, description, photoIds) {
  const now = new Date().toISOString();
  const albumId = randomUUID();
  const album = {
    albumId,
    userId: USER_ID,
    title,
    description: description || undefined,
    photoIds,
    sharedWith: [],
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };
  await dynamo.send(new PutCommand({ TableName: ALBUMS_TABLE, Item: album }));
  return album;
}

async function makePublic(albumId) {
  const token = randomBytes(32).toString('hex');
  await dynamo.send(new UpdateCommand({
    TableName: ALBUMS_TABLE,
    Key: { albumId },
    UpdateExpression: 'SET isPublic = :t, publicToken = :tok, publicExpiresAt = :exp, updatedAt = :now',
    ExpressionAttributeValues: {
      ':t': true, ':tok': token, ':exp': null, ':now': new Date().toISOString(),
    },
  }));
  return token;
}

async function shareWithUser(albumId, targetUserId) {
  // Read current sharedWith first
  const res = await dynamo.send(new QueryCommand({
    TableName: ALBUMS_TABLE,
    KeyConditionExpression: 'albumId = :id',
    ExpressionAttributeValues: { ':id': albumId },
    Limit: 1,
  }));
  const album = res.Items?.[0];
  if (!album) return;
  const already = (album.sharedWith || []).some(s => s.userId === targetUserId);
  if (already) return;
  const updated = [...(album.sharedWith || []), { userId: targetUserId, permission: 'view', sharedAt: new Date().toISOString() }];
  await dynamo.send(new UpdateCommand({
    TableName: ALBUMS_TABLE,
    Key: { albumId },
    UpdateExpression: 'SET sharedWith = :sw, updatedAt = :now',
    ExpressionAttributeValues: { ':sw': updated, ':now': new Date().toISOString() },
  }));
}

// Concurrency pool
async function runWithConcurrency(tasks, concurrency, fn) {
  let index = 0;
  const results = new Array(tasks.length);
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await fn(tasks[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const sourceDir = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
if (!sourceDir) {
  console.error('Usage: node bulk-import.mjs "/path/to/folder" [--dry-run]');
  process.exit(1);
}

const absDir = path.resolve(sourceDir);
console.log(`\n╔══════════════════════════════════════════════╗`);
console.log(`  PhotoVault Bulk Import`);
console.log(`  Source : ${absDir}`);
console.log(`  User   : ${USERNAME} (${USER_ID})`);
console.log(`  Mode   : ${DRY_RUN ? 'DRY RUN' : 'LIVE UPLOAD'}`);
if (WIFE_USER_ID) console.log(`  Wife   : ${WIFE_USER_ID} (all albums will be shared)`);
console.log(`╚══════════════════════════════════════════════╝\n`);

// Step 1: discover event folders
const eventFolders = await getTopLevelFolders(absDir);
console.log(`Found ${eventFolders.length} event folders:\n`);

const eventFileMap = [];
let grandTotal = 0;
for (const folder of eventFolders) {
  const files = await collectFilesInDir(folder.fullPath);
  const totalSize = files.reduce((s, f) => s + statSync(f.fullPath).size, 0);
  grandTotal += files.length;
  eventFileMap.push({ ...folder, files, totalSize });
  console.log(`  ${files.length.toString().padStart(5)} files  (${formatSize(totalSize).padStart(8)})  →  ${folder.name}`);
}
console.log(`\n  TOTAL: ${grandTotal} files to upload\n`);

if (DRY_RUN) {
  console.log('DRY RUN — no uploads or DynamoDB writes. Remove --dry-run to upload.');
  process.exit(0);
}

// Confirm before starting
console.log('Starting in 3 seconds… (Ctrl+C to cancel)\n');
await new Promise(r => setTimeout(r, 3000));

// Step 2: upload each event folder, create album
const masterPhotoIds = [];
const createdAlbums  = [];  // { name, albumId, publicToken, publicUrl }

for (const event of eventFileMap) {
  console.log(`\n▶ Uploading: ${event.name}  (${event.files.length} files)`);
  let done = 0, failed = 0;

  const photoIds = [];
  await runWithConcurrency(event.files, CONCURRENCY, async (file, i) => {
    try {
      const photo = await uploadFile(file);
      photoIds.push(photo.photoId);
      masterPhotoIds.push(photo.photoId);
      done++;
      process.stdout.write(`\r  ✓ ${done}/${event.files.length}  ${failed > 0 ? `(${failed} failed)` : ''}   `);
    } catch (err) {
      failed++;
      console.error(`\n  ✗ ${file.name} — ${err.message}`);
    }
  });
  process.stdout.write('\n');

  // Create the event album
  const album = await createAlbum(event.name, `Akhil & Ananya Marriage — ${event.name}`, photoIds);
  const token = await makePublic(album.albumId);
  if (WIFE_USER_ID) await shareWithUser(album.albumId, WIFE_USER_ID);

  const publicUrl = `${FRONTEND_URL}/album/public/${token}`;
  createdAlbums.push({ name: event.name, albumId: album.albumId, publicToken: token, publicUrl, photoCount: photoIds.length });
  console.log(`  📁 Album created: "${event.name}" (${photoIds.length} photos)`);
  console.log(`  🔗 Public URL: ${publicUrl}`);
}

// Step 3: master album with all photo IDs + proper subAlbumIds (no description hack)
console.log(`\n▶ Creating master album with all ${masterPhotoIds.length} photos…`);
const masterAlbum = await createAlbum(
  'Akhil & Ananya — Full Wedding',
  'All photos and videos from Akhil & Ananya\'s wedding.',
  masterPhotoIds
);
// Wire up subAlbumIds on the master album
await dynamo.send(new UpdateCommand({
  TableName: ALBUMS_TABLE,
  Key: { albumId: masterAlbum.albumId },
  UpdateExpression: 'SET subAlbumIds = :ids, updatedAt = :now',
  ExpressionAttributeValues: {
    ':ids': createdAlbums.map(a => a.albumId),
    ':now': new Date().toISOString(),
  },
}));

const masterToken = await makePublic(masterAlbum.albumId);
if (WIFE_USER_ID) await shareWithUser(masterAlbum.albumId, WIFE_USER_ID);

const masterUrl = `${FRONTEND_URL}/album/public/${masterToken}`;

// Step 4: summary
console.log(`\n╔══════════════════════════════════════════════╗`);
console.log(`  ✅ Import Complete!`);
console.log(`  Total uploaded : ${masterPhotoIds.length} files`);
console.log(`  Event albums   : ${createdAlbums.length}`);
console.log(`╚══════════════════════════════════════════════╝\n`);
console.log(`🔗 MASTER PUBLIC ALBUM (share this with family & friends):`);
console.log(`   ${masterUrl}\n`);
console.log(`📁 Individual event albums:\n`);
for (const a of createdAlbums) {
  console.log(`  ${a.name}`);
  console.log(`  ${a.publicUrl}\n`);
}

if (WIFE_USER_ID) {
  console.log(`✅ All albums shared with wife (userId: ${WIFE_USER_ID})\n`);
}

console.log(`\nSave these URLs — they never expire unless you revoke them in the app.`);
