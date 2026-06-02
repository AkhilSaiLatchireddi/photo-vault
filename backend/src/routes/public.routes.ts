import { Router, Request, Response } from 'express';
import * as db from '../services/database.service';
import { s3Service } from '../services/s3.service';

const router = Router();

// GET /api/public/albums/:token
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) {
      return res.status(400).json({ success: false, error: 'Invalid public token' });
    }

    const album = await db.getAlbumByToken(token);
    if (!album) return res.status(404).json({ success: false, error: 'Album not found or expired' });

    const photos = await db.getPhotosByIds(album.photoIds);
    const { urls } = await s3Service.getBatchObjectUrls(photos.map(p => p.s3Key), 7200);
    const photosWithUrls = photos.map(p => ({
      ...p,
      downloadUrl: urls.find(u => u.key === p.s3Key)?.url ?? null,
    }));

    res.json({
      success: true,
      data: {
        albumId: album.albumId,
        title: album.title,
        description: album.description,
        createdAt: album.createdAt,
        photos: photosWithUrls,
        photoCount: photosWithUrls.length,
      },
    });
  } catch (error) {
    console.error('Error fetching public album:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch album' });
  }
});

export default router;
