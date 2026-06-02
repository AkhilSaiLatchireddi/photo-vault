import { Router, Request, Response } from 'express';
import * as db from '../services/database.service';
import { s3Service } from '../services/s3.service';
import { checkJwt } from '../middleware/auth.middleware';
import { ensureUserMiddleware } from '../middleware/ensureUser.middleware';

const router = Router();
router.use(checkJwt);
router.use(ensureUserMiddleware);

// GET /api/albums
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userAlbums = await db.getUserAlbums(userId);
    res.json({ success: true, data: { userAlbums } });
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch albums' });
  }
});

// POST /api/albums
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, error: 'Album title is required' });

    const album = await db.createAlbum({ userId: req.user!.id, title: title.trim(), description: description?.trim() });
    res.json({ success: true, data: album });
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({ success: false, error: 'Failed to create album' });
  }
});

// GET /api/albums/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const album = await db.getAlbumById(req.params.id, req.user!.id);
    if (!album) return res.status(404).json({ success: false, error: 'Album not found or access denied' });

    const photos = await db.getPhotosByIds(album.photoIds);
    const { urls } = await s3Service.getBatchObjectUrls(photos.map(p => p.s3Key), 7200);
    const photosWithUrls = photos.map(p => ({
      ...p,
      downloadUrl: urls.find(u => u.key === p.s3Key)?.url ?? null,
    }));

    res.json({ success: true, data: { ...album, photos: photosWithUrls } });
  } catch (error) {
    console.error('Error fetching album:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch album' });
  }
});

// PUT /api/albums/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, coverPhotoId } = req.body;
    const patch: Partial<db.Album> = {};
    if (title !== undefined) patch.title = title.trim();
    if (description !== undefined) patch.description = description?.trim();
    if (coverPhotoId !== undefined) patch.coverPhotoId = coverPhotoId || undefined;

    const album = await db.updateAlbum(req.params.id, req.user!.id, patch);
    if (!album) return res.status(404).json({ success: false, error: 'Album not found or access denied' });
    res.json({ success: true, data: album });
  } catch (error) {
    console.error('Error updating album:', error);
    res.status(500).json({ success: false, error: 'Failed to update album' });
  }
});

// DELETE /api/albums/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await db.deleteAlbum(req.params.id, req.user!.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Album not found or access denied' });
    res.json({ success: true, message: 'Album deleted successfully' });
  } catch (error) {
    console.error('Error deleting album:', error);
    res.status(500).json({ success: false, error: 'Failed to delete album' });
  }
});

// POST /api/albums/:id/photos
router.post('/:id/photos', async (req: Request, res: Response) => {
  try {
    const { photo_ids } = req.body;
    if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'photo_ids array is required' });
    }
    const ok = await db.addPhotosToAlbum(req.params.id, req.user!.id, photo_ids);
    if (!ok) return res.status(404).json({ success: false, error: 'Album not found or access denied' });
    res.json({ success: true, data: { added: photo_ids.length } });
  } catch (error) {
    console.error('Error adding photos to album:', error);
    res.status(500).json({ success: false, error: 'Failed to add photos to album' });
  }
});

// DELETE /api/albums/:id/photos/:photoId
router.delete('/:id/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const removed = await db.removePhotoFromAlbum(req.params.id, req.user!.id, req.params.photoId);
    if (!removed) return res.status(404).json({ success: false, error: 'Photo not found in album or access denied' });
    res.json({ success: true, message: 'Photo removed from album successfully' });
  } catch (error) {
    console.error('Error removing photo from album:', error);
    res.status(500).json({ success: false, error: 'Failed to remove photo from album' });
  }
});

// POST /api/albums/:id/share
router.post('/:id/share', async (req: Request, res: Response) => {
  try {
    const { email, userId: shareUserId, permission = 'view' } = req.body;
    if (!email && !shareUserId) return res.status(400).json({ success: false, error: 'email or userId is required' });
    if (!['view', 'edit'].includes(permission)) return res.status(400).json({ success: false, error: 'permission must be view or edit' });

    const ok = await db.shareAlbum(req.params.id, req.user!.id, { email, userId: shareUserId, permission });
    if (!ok) return res.status(400).json({ success: false, error: 'Failed to share album — album not found or already shared' });
    res.json({ success: true, message: 'Album shared successfully' });
  } catch (error) {
    console.error('Error sharing album:', error);
    res.status(500).json({ success: false, error: 'Failed to share album' });
  }
});

// POST /api/albums/:id/public
router.post('/:id/public', async (req: Request, res: Response) => {
  try {
    const { expires_at } = req.body;
    const token = await db.generatePublicToken(req.params.id, req.user!.id, expires_at);
    if (!token) return res.status(404).json({ success: false, error: 'Album not found or access denied' });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.json({
      success: true,
      data: { publicToken: token, publicUrl: `${baseUrl}/album/public/${token}`, expiresAt: expires_at },
    });
  } catch (error) {
    console.error('Error generating public link:', error);
    res.status(500).json({ success: false, error: 'Failed to generate public link' });
  }
});

// DELETE /api/albums/:id/public
router.delete('/:id/public', async (req: Request, res: Response) => {
  try {
    const ok = await db.revokePublicAccess(req.params.id, req.user!.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Album not found or access denied' });
    res.json({ success: true, message: 'Public access revoked successfully' });
  } catch (error) {
    console.error('Error revoking public access:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke public access' });
  }
});

export default router;
