import { Router, Request, Response } from 'express';
import { databaseService } from '../services/database.service';
import { s3Service } from '../services/s3.service';

const router = Router();

/**
 * GET /api/public/albums/:token
 * Get public album by token (no authentication required)
 */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const publicToken = req.params.token;

    if (!publicToken || publicToken.length !== 64) { // 32 bytes = 64 hex chars
      return res.status(400).json({
        success: false,
        error: 'Invalid public token'
      });
    }

    const album = await databaseService.getAlbumByToken(publicToken);
    if (!album) {
      return res.status(404).json({
        success: false,
        error: 'Album not found or expired'
      });
    }

    // Get album photos with download URLs
    const photos = await databaseService.getAlbumPhotos(album._id!);
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        try {
          const urlResult = await s3Service.getObjectUrl(photo.s3_key, 7200); // 2 hour expiry for public access
          const downloadUrl = urlResult.url;
          return { ...photo, downloadUrl };
        } catch (error) {
          console.error(`Error getting download URL for ${photo.s3_key}:`, error);
          return photo;
        }
      })
    );

    // Don't expose sensitive information for public access
    const publicAlbumData = {
      _id: album._id,
      title: album.title,
      description: album.description,
      created_at: album.created_at,
      photos: photosWithUrls,
      photoCount: photosWithUrls.length
    };

    res.json({
      success: true,
      data: publicAlbumData
    });
  } catch (error) {
    console.error('Error fetching public album:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch album'
    });
  }
});

export default router;
