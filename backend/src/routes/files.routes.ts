import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { s3Service } from '../services/s3.service';
import { databaseService } from '../services/database.service';
import { checkJwt } from '../middleware/auth.middleware';
import { ensureUserMiddleware } from '../middleware/ensureUser.middleware';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(checkJwt);
router.use(ensureUserMiddleware);

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * GET /api/files
 * List user's photos from database with optimized batch URL generation
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const username = req.user!.username;
    const { year, month, limit = '50', offset = '0' } = req.query;

    let photos;
    
    if (year) {
      const yearNum = parseInt(year as string);
      const monthNum = month ? parseInt(month as string) : undefined;
      photos = await databaseService.getPhotosByYearMonth(userId, yearNum, monthNum);
    } else {
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      photos = await databaseService.getUserPhotos(userId, limitNum, offsetNum);
    }

    // Optimize: Generate batch presigned URLs for better performance
    const photoKeys = photos.map(photo => photo.s3_key);
    
    try {
      // Use longer expiry for photo galleries (2 hours)
      const batchUrlResult = await s3Service.getBatchObjectUrls(photoKeys, 7200);
      
      const photosWithUrls = photos.map((photo) => {
        const urlData = batchUrlResult.urls.find(u => u.key === photo.s3_key);
        return {
          ...photo,
          id: photo._id!.toString(),
          downloadUrl: urlData?.url || null,
          metadata: photo.metadata || null,
        };
      });

      res.json({
        success: true,
        data: {
          photos: photosWithUrls,
          count: photos.length,
          user: username,
          userId: userId,
          urlsExpireAt: new Date(Date.now() + 7200 * 1000).toISOString(), // 2 hours from now
        },
      });
    } catch (urlError) {
      console.error('Error generating batch URLs, falling back to individual:', urlError);
      
      // Fallback to individual URL generation
      const photosWithUrls = await Promise.all(
        photos.map(async (photo) => {
          try {
            const urlResult = await s3Service.getObjectUrl(photo.s3_key, 3600);
            return {
              ...photo,
              id: photo._id!.toString(),
              downloadUrl: urlResult.url,
              metadata: photo.metadata || null,
            };
          } catch (error) {
            console.error(`Error getting URL for photo ${photo._id}:`, error);
            return {
              ...photo,
              id: photo._id!.toString(),
              downloadUrl: null,
              metadata: photo.metadata || null,
            };
          }
        })
      );

      res.json({
        success: true,
        data: {
          photos: photosWithUrls,
          count: photos.length,
          user: username,
          userId: userId,
        },
      });
    }
  } catch (error) {
    console.error('Error listing photos:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list photos',
    });
  }
});

/**
 * POST /api/files/refresh-urls
 * Refresh expired presigned URLs for batch of photos
 */
router.post('/refresh-urls', async (req: Request, res: Response) => {
  try {
    const { photoIds } = req.body;
    const userId = req.user!.id;
    
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'photoIds array is required',
      });
    }

    // Validate all photo IDs belong to the user
    const photos = await Promise.all(
      photoIds.map(async (id: string) => {
        if (!ObjectId.isValid(id)) return null;
        return await databaseService.getPhotoById(id, userId);
      })
    );

    const validPhotos = photos.filter(photo => photo !== null);
    
    if (validPhotos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No valid photos found',
      });
    }

    // Generate fresh presigned URLs
    const photoKeys = validPhotos.map(photo => photo!.s3_key);
    const { urls } = await s3Service.getBatchObjectUrls(photoKeys, 7200);
    
    const refreshedUrls = validPhotos.map(photo => {
      const urlData = urls.find(u => u.key === photo!.s3_key);
      return {
        id: photo!._id!.toString(),
        downloadUrl: urlData?.url || null,
      };
    });

    res.json({
      success: true,
      data: {
        urls: refreshedUrls,
        urlsExpireAt: new Date(Date.now() + 7200 * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error refreshing URLs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh URLs',
    });
  }
});

/**
 * GET /api/files/:id/download
 * Get download URL for a specific photo
 */
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const photoId = req.params.id;
    const userId = req.user!.id;
    
    if (!ObjectId.isValid(photoId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid photo ID',
      });
    }

    // Get photo from database (ensure user owns it)
    const photo = await databaseService.getPhotoById(photoId, userId);
    
    if (!photo) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found or you do not have permission to access it',
      });
    }

    const result = await s3Service.getObjectUrl(photo.s3_key);
    
    res.json({
      success: true,
      data: {
        ...result,
        photo: {
          id: photo._id!.toString(),
          filename: photo.original_name,
          uploadedAt: photo.uploaded_at,
        },
      },
    });
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate download URL',
    });
  }
});

/**
 * GET /api/files/stats
 * Get user's photo statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await databaseService.getPhotoStats(userId);
    
    res.json({
      success: true,
      data: {
        totalPhotos: stats.total_photos || 0,
        totalSize: stats.total_size || 0,
        totalSizeFormatted: formatFileSize(stats.total_size || 0),
        firstUpload: stats.first_upload,
        lastUpload: stats.last_upload,
        user: req.user!.username,
      },
    });
  } catch (error) {
    console.error('Error getting photo stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get photo statistics',
    });
  }
});

/**
 * POST /api/files/upload-url
 * Get presigned URL for uploading a file and save metadata
 */
router.post('/upload-url', async (req: Request, res: Response) => {
  try {
    const { fileName, contentType, fileSize, metadata } = req.body;
    const userId = req.user!.id;
    const username = req.user!.username;
    
    if (!fileName || !contentType) {
      return res.status(400).json({
        success: false,
        error: 'fileName and contentType are required',
      });
    }

    // Create detailed user-specific folder structure: users/{username}/photos/{year}/{month}/{day}/
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    const fileExtension = fileName.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const s3Key = `users/${username}/photos/${year}/${month}/${day}/${uniqueFilename}`;
    
    // Get presigned upload URL
    const uploadResult = await s3Service.getUploadUrl(s3Key, contentType);
    
    // Save photo metadata to database
    const photoData = {
      user_id: new ObjectId(userId),
      filename: uniqueFilename,
      s3_key: s3Key,
      original_name: fileName,
      mime_type: contentType,
      file_size: fileSize || 0,
      width: metadata?.width,
      height: metadata?.height,
      taken_at: metadata?.takenAt ? new Date(metadata.takenAt) : undefined,
      metadata: metadata || undefined,
    };

    const photo = await databaseService.createPhoto(photoData);
    
    res.json({
      success: true,
      data: {
        ...uploadResult,
        photo: {
          id: photo._id!.toString(),
          filename: photo.filename,
          s3_key: photo.s3_key,
          uploadPath: `users/${username}/photos/${year}/${month}/${day}/`,
        },
      },
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate upload URL',
    });
  }
});

/**
 * DELETE /api/files/:id
 * Delete a user's photo (database record and S3 object)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const photoId = req.params.id;
    const userId = req.user!.id;
    
    if (!ObjectId.isValid(photoId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid photo ID',
      });
    }

    // Get photo from database (ensure user owns it)
    const photo = await databaseService.getPhotoById(photoId, userId);
    
    if (!photo) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found or you do not have permission to delete it',
      });
    }

    // Delete from S3
    try {
      await s3Service.deleteObject(photo.s3_key);
    } catch (s3Error) {
      console.error('Error deleting from S3:', s3Error);
      // Continue with database deletion even if S3 fails
    }

    // Delete from database
    const deleted = await databaseService.deletePhoto(photoId, userId);
    
    if (deleted) {
      res.json({
        success: true,
        message: `Photo "${photo.original_name}" deleted successfully`,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete photo from database',
      });
    }
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete photo',
    });
  }
});

/**
 * GET /api/files/health
 * Check S3 bucket connectivity
 */
router.get('/health', async (req, res) => {
  try {
    const result = await s3Service.checkBucketAccess();
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error checking S3 health:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'S3 bucket not accessible',
    });
  }
});

export default router;
