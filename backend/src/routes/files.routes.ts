import express, { Request, Response } from 'express';
import { s3Service } from '../services/s3.service';
import * as db from '../services/database.service';
import { checkJwt } from '../middleware/auth.middleware';
import { ensureUserMiddleware } from '../middleware/ensureUser.middleware';
import { randomUUID } from 'crypto';
import { detectAndIndexFaces } from '../services/rekognition.service';
import { isHeic, convertHeicToJpeg } from '../services/heic.service';

const router = express.Router();
router.use(checkJwt);
router.use(ensureUserMiddleware);

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// GET /api/files — list user photos
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // max 100 per page
    const lastKey = req.query.nextKey ? JSON.parse(decodeURIComponent(req.query.nextKey as string)) : undefined;

    const { photos, nextKey } = await db.getUserPhotos(userId, limit, lastKey);

    // For listing: only sign thumbnail keys where available, original otherwise.
    // The original URL is fetched on-demand when the viewer opens (/download).
    const listingKeys = photos.map(p => p.thumbnailS3Key ?? p.s3Key);
    const { urls } = await s3Service.getBatchObjectUrls(listingKeys, 7200);

    const photosWithUrls = photos.map((p, i) => ({
      ...p,
      // downloadUrl = original (null in listing — fetched on-demand by viewer)
      downloadUrl: p.thumbnailS3Key ? null : (urls[i]?.url ?? null),
      thumbnailUrl: p.thumbnailS3Key ? (urls[i]?.url ?? null) : null,
    }));

    res.json({
      success: true,
      data: {
        photos: photosWithUrls,
        count: photos.length,
        nextKey: nextKey ? encodeURIComponent(JSON.stringify(nextKey)) : null,
        urlsExpireAt: new Date(Date.now() + 7200 * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error listing photos:', error);
    res.status(500).json({ success: false, error: 'Failed to list photos' });
  }
});

// POST /api/files/refresh-urls
router.post('/refresh-urls', async (req: Request, res: Response) => {
  try {
    const { photoIds } = req.body;
    const userId = req.user!.id;

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ success: false, error: 'photoIds array is required' });
    }

    const photos = (await Promise.all(photoIds.map(id => db.getPhotoById(id, userId)))).filter(Boolean) as db.Photo[];
    if (photos.length === 0) return res.status(404).json({ success: false, error: 'No valid photos found' });

    const { urls } = await s3Service.getBatchObjectUrls(photos.map(p => p.s3Key), 7200);

    res.json({
      success: true,
      data: {
        urls: photos.map(p => ({ id: p.photoId, downloadUrl: urls.find(u => u.key === p.s3Key)?.url ?? null })),
        urlsExpireAt: new Date(Date.now() + 7200 * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error refreshing URLs:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh URLs' });
  }
});

// GET /api/files/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await db.getPhotoStats(req.user!.id);
    res.json({
      success: true,
      data: {
        totalPhotos: stats.totalPhotos,
        totalSize: stats.totalSize,
        totalSizeFormatted: formatFileSize(stats.totalSize),
      },
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get photo statistics' });
  }
});

// POST /api/files/upload-url
router.post('/upload-url', async (req: Request, res: Response) => {
  try {
    const { fileName, contentType, fileSize, metadata } = req.body;
    const userId = req.user!.id;
    const username = req.user!.username;

    if (!fileName || !contentType) {
      return res.status(400).json({ success: false, error: 'fileName and contentType are required' });
    }

    const ALLOWED_MIME_TYPES = new Set([
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'image/heic', 'image/heif', 'image/bmp', 'image/tiff', 'image/svg+xml',
      'image/avif',
      // Videos
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv',
      'video/webm', 'video/ogg', 'video/3gpp', 'video/3gpp2',
      'video/mpeg', 'video/x-matroska', 'video/x-flv', 'video/mp2t',
    ]);
    if (!ALLOWED_MIME_TYPES.has(contentType.toLowerCase())) {
      return res.status(400).json({ success: false, error: `File type "${contentType}" is not supported` });
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const ext = fileName.split('.').pop();
    const s3Key = `users/${username}/photos/${y}/${m}/${d}/${randomUUID()}.${ext}`;

    const uploadResult = await s3Service.getUploadUrl(s3Key, contentType);

    const photo = await db.createPhoto({
      userId,
      filename: s3Key.split('/').pop()!,
      s3Key,
      originalName: fileName,
      mimeType: contentType,
      fileSize: fileSize || 0,
      width: metadata?.width,
      height: metadata?.height,
      takenAt: metadata?.takenAt,
      metadata,
    });

    // Also return a presigned URL for the thumbnail (client will upload a compressed version)
    const thumbS3Key = `users/${username}/thumbs/${photo.photoId}.jpg`;
    const thumbUploadResult = await s3Service.getUploadUrl(thumbS3Key, 'image/jpeg');

    res.json({
      success: true,
      data: {
        ...uploadResult,
        photo: { id: photo.photoId, s3Key: photo.s3Key },
        needsConversion: isHeic(contentType, fileName),
        thumbnailUploadUrl: thumbUploadResult.uploadUrl,
        thumbnailS3Key: thumbS3Key,
      },
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ success: false, error: 'Failed to generate upload URL' });
  }
});

// PATCH /api/files/:id/thumbnail — save thumbnailS3Key after client uploads thumbnail
router.patch('/:id/thumbnail', async (req: Request, res: Response) => {
  try {
    const { thumbnailS3Key } = req.body;
    if (!thumbnailS3Key) return res.status(400).json({ success: false, error: 'thumbnailS3Key required' });
    const photo = await db.getPhotoById(req.params.id, req.user!.id);
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });
    await db.updatePhoto(req.params.id, req.user!.id, { thumbnailS3Key });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving thumbnail key:', error);
    res.status(500).json({ success: false, error: 'Failed to save thumbnail' });
  }
});

// GET /api/files/:id/download
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const photo = await db.getPhotoById(req.params.id, req.user!.id);
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });

    const result = await s3Service.getObjectUrl(photo.s3Key);
    res.json({ success: true, data: { ...result, photo: { id: photo.photoId, filename: photo.originalName } } });
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({ success: false, error: 'Failed to generate download URL' });
  }
});

// POST /api/files/:id/convert — convert HEIC to JPEG after upload
router.post('/:id/convert', async (req: Request, res: Response) => {
  try {
    const photo = await db.getPhotoById(req.params.id, req.user!.id);
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });

    if (!isHeic(photo.mimeType, photo.originalName)) {
      return res.json({ success: true, data: photo, converted: false });
    }

    const { jpegS3Key, mimeType } = await convertHeicToJpeg(photo.s3Key);

    // Update DB record to point to JPEG
    await db.updatePhoto(photo.photoId, req.user!.id, { s3Key: jpegS3Key, mimeType });
    const updated = await db.getPhotoById(photo.photoId, req.user!.id);

    res.json({ success: true, data: updated, converted: true });
  } catch (error) {
    console.error('Error converting HEIC:', error);
    res.status(500).json({ success: false, error: 'Failed to convert image' });
  }
});

// DELETE /api/files/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const photo = await db.getPhotoById(req.params.id, req.user!.id);
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });

    try { await s3Service.deleteObject(photo.s3Key); } catch (e) { console.error('S3 delete failed:', e); }

    await db.deletePhoto(req.params.id, req.user!.id);
    res.json({ success: true, message: `Photo "${photo.originalName}" deleted successfully` });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
});

export default router;
