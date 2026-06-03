import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.S3_BUCKET_NAME || 'photovault-app-bucket-akhil';

/**
 * Checks if a file is HEIC/HEIF by extension or mime type.
 */
export function isHeic(mimeType: string, filename?: string): boolean {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/heic' || mime === 'image/heif') return true;
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'heic' || ext === 'heif') return true;
  }
  return false;
}

/**
 * Downloads HEIC from S3, converts to JPEG, uploads JPEG back to S3.
 * Returns the new JPEG s3Key and mimeType.
 */
export async function convertHeicToJpeg(s3Key: string): Promise<{ jpegS3Key: string; mimeType: string }> {
  // Download the HEIC file
  const getRes = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  const chunks: Buffer[] = [];
  for await (const chunk of getRes.Body as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const inputBuffer = Buffer.concat(chunks);

  // Lazy import heic-convert (it's large, only load when needed)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const heicConvert = require('heic-convert');
  const outputBuffer = await heicConvert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 0.92,
  }) as Buffer;

  // Upload JPEG to S3 with a .jpg extension replacing .heic/.heif
  const jpegS3Key = s3Key.replace(/\.(heic|heif)$/i, '.jpg');
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: jpegS3Key,
    Body: outputBuffer,
    ContentType: 'image/jpeg',
  }));

  return { jpegS3Key, mimeType: 'image/jpeg' };
}
