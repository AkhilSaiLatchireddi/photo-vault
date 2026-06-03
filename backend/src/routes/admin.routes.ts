import { Router, Request, Response } from 'express';
import * as db from '../services/database.service';
import { checkJwt } from '../middleware/auth.middleware';
import { ensureUserMiddleware } from '../middleware/ensureUser.middleware';
import { isHeic } from '../services/heic.service';
import { publishHeicConvert, publishFaceDetect } from '../services/eventbridge.service';

const router = Router();
router.use(checkJwt);
router.use(ensureUserMiddleware);

/**
 * POST /api/admin/process-photos
 * Publishes EventBridge events for all (or unprocessed) photos.
 * Returns immediately — processing happens asynchronously in worker Lambdas.
 * Query: ?force=1 to re-process already-processed photos
 */
router.post('/process-photos', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const force = req.query.force === '1';

    const { photos } = await db.getUserPhotos(userId, 500);
    let queued = 0;
    let skipped = 0;

    for (const photo of photos) {
      // Skip non-images
      if (!photo.mimeType.startsWith('image/') && !isHeic(photo.mimeType, photo.originalName)) {
        skipped++;
        continue;
      }

      // Skip already-processed unless force
      if (!force) {
        const existing = await db.getPhotoFaces(photo.photoId);
        if (existing) { skipped++; continue; }
      }

      // Publish the right event type
      if (isHeic(photo.mimeType, photo.originalName)) {
        await publishHeicConvert(photo.s3Key, photo.photoId, userId);
      } else {
        await publishFaceDetect(photo.s3Key, photo.photoId, userId);
      }
      queued++;
    }

    res.json({
      success: true,
      data: {
        queued,
        skipped,
        message: `Queued ${queued} photo${queued !== 1 ? 's' : ''} for processing. Results will appear in People within seconds.`,
      },
    });
  } catch (error) {
    console.error('Error publishing process-photos events:', error);
    res.status(500).json({ success: false, error: 'Failed to queue photos for processing' });
  }
});

export default router;
