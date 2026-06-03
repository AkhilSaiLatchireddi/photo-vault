/**
 * PhotoVault — Backfill thumbnails for existing photos
 *
 * Downloads each image from S3, generates a 400px JPEG thumbnail,
 * uploads it back to S3 under users/{username}/thumbs/{photoId}.jpg,
 * and updates the DynamoDB record with thumbnailS3Key.
 *
 * Safe to re-run — skips photos that already have thumbnailS3Key set.
 *
 * Usage:
 *   node backfill-thumbnails.mjs [--dry-run]
 *
 * Optional env:
 *   CONCURRENCY=5   — parallel workers (default 3, keep low to avoid S3 rate limits)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import sharp from 'sharp';

const REGION       = 'us-east-1';
const AWS_PROFILE  = 'photovault-akhil-app-user';
const BUCKET       = 'photovault-app-bucket-akhil';
const PHOTOS_TABLE = 'photovault-photos-prod-v1';
const CONCURRENCY  = parseInt(process.env.CONCURRENCY || '3', 10);
const DRY_RUN      = process.argv.includes('--dry-run');

const credentials = fromIni({ profile: AWS_PROFILE });
const s3     = new S3Client({ region: REGION, credentials });
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION, credentials }),
  { marshallOptions: { removeUndefinedValues: true } }
);

// Stream S3 object to a Buffer
async function s3ToBuffer(s3Key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Fetch all photo records (paginated)
async function getAllPhotos() {
  const photos = [];
  let lastKey;
  do {
    const res = await dynamo.send(new ScanCommand({
      TableName: PHOTOS_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    photos.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return photos;
}

// Concurrency pool
async function runWithConcurrency(tasks, concurrency, fn) {
  let idx = 0;
  const results = new Array(tasks.length);
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await fn(tasks[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

console.log(`\nPhotoVault Thumbnail Backfill`);
console.log(`Profile : ${AWS_PROFILE}`);
console.log(`Bucket  : ${BUCKET}`);
console.log(`Mode    : ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

console.log('Scanning DynamoDB for photos without thumbnails…');
const allPhotos = await getAllPhotos();
const todo = allPhotos.filter(p =>
  !p.thumbnailS3Key &&                        // no thumbnail yet
  p.mimeType?.startsWith('image/') &&          // images only
  !p.mimeType?.includes('svg')                 // skip SVG
);

console.log(`Total photos : ${allPhotos.length}`);
console.log(`Need thumbs  : ${todo.length}\n`);

if (todo.length === 0) {
  console.log('All photos already have thumbnails. Nothing to do.');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('DRY RUN — would process these photos:');
  todo.slice(0, 10).forEach(p => console.log(`  ${p.photoId}  ${p.originalName}`));
  if (todo.length > 10) console.log(`  … and ${todo.length - 10} more`);
  process.exit(0);
}

let done = 0, failed = 0, skipped = 0;

await runWithConcurrency(todo, CONCURRENCY, async (photo, i) => {
  const thumbS3Key = photo.s3Key.replace(/^users\/([^/]+)\/photos\//, 'users/$1/thumbs/').replace(/\.[^.]+$/, '.jpg');

  try {
    // Download original from S3
    const original = await s3ToBuffer(photo.s3Key);

    // Generate 400px thumbnail
    const thumb = await sharp(original)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    // Upload thumbnail
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbS3Key,
      Body: thumb,
      ContentType: 'image/jpeg',
    }));

    // Update DynamoDB
    await dynamo.send(new UpdateCommand({
      TableName: PHOTOS_TABLE,
      Key: { photoId: photo.photoId },
      UpdateExpression: 'SET thumbnailS3Key = :k',
      ExpressionAttributeValues: { ':k': thumbS3Key },
    }));

    done++;
    process.stdout.write(`\r  ✓ ${done}/${todo.length}  (${failed} failed)   `);
  } catch (err) {
    failed++;
    const msg = err.message || String(err);
    // HEIC/unsupported — skip gracefully
    if (msg.includes('unsupported image format') || msg.includes('NoSuchKey')) {
      skipped++;
    } else {
      process.stdout.write(`\n  ✗ ${photo.photoId} — ${msg}\n`);
    }
  }
});

console.log(`\n\nDone.`);
console.log(`  ✓ Thumbnails created : ${done}`);
console.log(`  ✗ Errors             : ${failed - skipped}`);
console.log(`  ⏭  Skipped (format)  : ${skipped}`);
