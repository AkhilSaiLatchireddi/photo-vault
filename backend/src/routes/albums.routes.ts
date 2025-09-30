import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { databaseService } from '../services/database.service';
import { s3Service } from '../services/s3.service';
import { checkJwt } from '../middleware/auth.middleware';
import { ensureUserMiddleware } from '../middleware/ensureUser.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(checkJwt);
router.use(ensureUserMiddleware);

// Middleware to ensure CORS headers are consistently set
router.use((req, res, next) => {
  // Ensure CORS headers are set for all album responses
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
  next();
});

/**
 * GET /api/albums
 * Get user's albums
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userAlbums = await databaseService.getUserAlbums(userId);
    const sharedAlbums = await databaseService.getSharedAlbums(userId, req.user!.email);
    
    res.json({
      success: true,
      data: {
        userAlbums,
        sharedAlbums
      }
    });
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch albums'
    });
  }
});

/**
 * POST /api/albums
 * Create a new album
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, description } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Album title is required'
      });
    }

    const albumData = {
      user_id: new ObjectId(userId),
      title: title.trim(),
      description: description?.trim(),
      is_public: false
    };

    const album = await databaseService.createAlbum(albumData);
    
    res.json({
      success: true,
      data: album
    });
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create album'
    });
  }
});

/**
 * GET /api/albums/:id
 * Get album details with photos
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const albumId = req.params.id;
    const userId = req.user!.id;

    if (!ObjectId.isValid(albumId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid album ID'
      });
    }

    const album = await databaseService.getAlbumById(albumId, userId);
    if (!album) {
      return res.status(404).json({
        success: false,
        error: 'Album not found or access denied'
      });
    }

    // Get album photos with download URLs
    const photos = await databaseService.getAlbumPhotos(albumId, userId);
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        try {
          const urlResult = await s3Service.getObjectUrl(photo.s3_key);
          const downloadUrl = urlResult.url;
          return { ...photo, downloadUrl };
        } catch (error) {
          console.error(`Error getting download URL for ${photo.s3_key}:`, error);
          return photo;
        }
      })
    );

    res.json({
      success: true,
      data: {
        ...album,
        photos: photosWithUrls
      }
    });
  } catch (error) {
    console.error('Error fetching album:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch album'
    });
  }
});

/**
 * PUT /api/albums/:id
 * Update album details
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const albumId = req.params.id;
    const userId = req.user!.id;
    const { title, description, cover_photo_id } = req.body;

    if (!ObjectId.isValid(albumId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid album ID'
      });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (cover_photo_id !== undefined) {
      updateData.cover_photo_id = cover_photo_id ? new ObjectId(cover_photo_id) : undefined;
    }

    const album = await databaseService.updateAlbum(albumId, userId, updateData);
    if (!album) {
      return res.status(404).json({
        success: false,
        error: 'Album not found or access denied'
      });
    }

    res.json({
      success: true,
      data: album
    });
  } catch (error) {
    console.error('Error updating album:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update album'
    });
  }
});

/**
 * DELETE /api/albums/:id
 * Delete an album
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const albumId = req.params.id;
    const userId = req.user!.id;

    if (!ObjectId.isValid(albumId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid album ID'
      });
    }

    const deleted = await databaseService.deleteAlbum(albumId, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Album not found or access denied'
      });
    }

    res.json({
      success: true,
      message: 'Album deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting album:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete album'
    });
  }
});

/**
 * POST /api/albums/:id/photos
 * Add photos to album
 */
router.post('/:id/photos', async (req: Request, res: Response) => {
  try {
    const albumId = req.params.id;
    const userId = req.user!.id;
    const { photo_ids } = req.body;

    if (!ObjectId.isValid(albumId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid album ID'
      });
    }

    if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Photo IDs array is required'
      });
    }

    const results = await Promise.all(
      photo_ids.map(photoId => 
        databaseService.addPhotoToAlbum(albumId, photoId, userId)
      )
    );

    const successCount = results.filter(Boolean).length;

    res.json({
      success: true,
      data: {
        total: photo_ids.length,
        added: successCount,
        skipped: photo_ids.length - successCount
      }
    });
  } catch (error) {
    console.error('Error adding photos to album:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add photos to album'
    });
  }
});

/**
 * DELETE /api/albums/:id/photos/:photoId
 * Remove photo from album
 */
router.delete('/:id/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const albumId = req.params.id;
    const photoId = req.params.photoId;
    const userId = req.user!.id;

    if (!ObjectId.isValid(albumId) || !ObjectId.isValid(photoId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid album or photo ID'
      });
    }

    const removed = await databaseService.removePhotoFromAlbum(albumId, photoId, userId);
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found in album or access denied'
      });
    }

    res.json({
      success: true,
      message: 'Photo removed from album successfully'
    });
  } catch (error) {
    console.error('Error removing photo from album:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove photo from album'
    });
  }
});

/**
 * POST /api/albums/:id/share
 * Share album with user by email or username
 */
router.post('/:id/share', async (req: Request, res: Response) => {
  try {
    const albumId = req.params.id;
    const userId = req.user!.id;
    const { email, username, permission = 'view', expires_at } = req.body;

    if (!ObjectId.isValid(albumId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid album ID'
      });
    }

    if (!email && !username) {
      return res.status(400).json({
        success: false,
        error: 'Email or username is required'
      });
    }

    if (!['view', 'edit'].includes(permission)) {
      return res.status(400).json({
        success: false,
        error: 'Permission must be "view" or "edit"'
      });
    }

    const shareData = {
      email,
      username,
      permission,
      expires_at: expires_at ? new Date(expires_at) : undefined
    };

    const shared = await databaseService.shareAlbum(albumId, userId, shareData);
    if (!shared) {
      return res.status(400).json({
        success: false,
        error: 'Failed to share album. Album not found or user not found.'
      });
    }

    res.json({
      success: true,
      message: 'Album shared successfully'
    });
  } catch (error) {
    console.error('Error sharing album:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share album'
    });
  }
});

/**
 * POST /api/albums/:id/public
 * Generate public share link
 */
router.post('/:id/public', async (req: Request, res: Response) => {
  try {
    const albumId = req.params.id;
    const userId = req.user!.id;
    const { expires_at } = req.body;

    if (!ObjectId.isValid(albumId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid album ID'
      });
    }

    const expiresAt = expires_at ? new Date(expires_at) : undefined;
    const publicToken = await databaseService.generatePublicToken(albumId, userId, expiresAt);

    if (!publicToken) {
      return res.status(404).json({
        success: false,
        error: 'Album not found or access denied'
      });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const publicUrl = `${baseUrl}/album/public/${publicToken}`;

    res.json({
      success: true,
      data: {
        publicToken,
        publicUrl,
        expiresAt
      }
    });
  } catch (error) {
    console.error('Error generating public link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate public link'
    });
  }
});

/**
 * DELETE /api/albums/:id/public
 * Revoke public access
 */
router.delete('/:id/public', async (req: Request, res: Response) => {
  try {
    const albumId = req.params.id;
    const userId = req.user!.id;

    if (!ObjectId.isValid(albumId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid album ID'
      });
    }

    const revoked = await databaseService.revokePublicAccess(albumId, userId);
    if (!revoked) {
      return res.status(404).json({
        success: false,
        error: 'Album not found or access denied'
      });
    }

    res.json({
      success: true,
      message: 'Public access revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking public access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke public access'
    });
  }
});

export default router;
