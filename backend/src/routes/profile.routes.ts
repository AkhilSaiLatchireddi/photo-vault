import { Router, Request, Response } from 'express';
import * as db from '../services/database.service';
import { s3Service } from '../services/s3.service';
import { checkJwt } from '../middleware/auth.middleware';
import { ensureUserMiddleware } from '../middleware/ensureUser.middleware';

const router = Router();

// GET /api/profile
router.get('/', checkJwt, ensureUserMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await db.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    // Refresh avatar presigned URL from S3 if we have the original key
    const avatarS3Key = (user.profile as any)?.avatarS3Key;
    let picture = user.picture;
    if (avatarS3Key) {
      try {
        const { url } = await s3Service.getObjectUrl(avatarS3Key, 7 * 24 * 3600);
        picture = url;
      } catch { /* fall back to stored URL */ }
    }
    res.json({ success: true, data: { ...user, picture } });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
});

// PUT /api/profile
router.put('/', checkJwt, ensureUserMiddleware, async (req: Request, res: Response) => {
  try {
    const { profile } = req.body;
    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ success: false, error: 'profile object is required' });
    }

    const existing = await db.getUserById(req.user!.id);
    if (!existing) return res.status(404).json({ success: false, error: 'User not found' });

    const merged = {
      ...existing.profile,
      ...profile,
      preferences: { ...existing.profile?.preferences, ...profile.preferences },
    };

    const updated = await db.updateUser(req.user!.id, { profile: merged });
    res.json({ success: true, data: updated, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update user profile' });
  }
});

// POST /api/profile/avatar — get a presigned upload URL for the user's profile picture
router.post('/avatar', checkJwt, ensureUserMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const username = req.user!.username;
    const s3Key = `users/${username}/avatar/profile.jpg`;
    const uploadResult = await s3Service.getUploadUrl(s3Key, 'image/jpeg', 3600);
    res.json({ success: true, data: { uploadUrl: uploadResult.uploadUrl, s3Key } });
  } catch (error) {
    console.error('Error generating avatar upload URL:', error);
    res.status(500).json({ success: false, error: 'Failed to generate upload URL' });
  }
});

// PATCH /api/profile/avatar — confirm avatar upload, save s3Key and picture URL to user record
router.patch('/avatar', checkJwt, ensureUserMiddleware, async (req: Request, res: Response) => {
  try {
    const { s3Key } = req.body;
    if (!s3Key) return res.status(400).json({ success: false, error: 's3Key required' });

    const { url } = await s3Service.getObjectUrl(s3Key, 7 * 24 * 3600);

    // Fetch existing user so we can merge avatarS3Key into the existing profile
    // without wiping firstName, bio, location, etc.
    const existing = await db.getUserById(req.user!.id);
    const mergedProfile = { ...(existing?.profile ?? {}), avatarS3Key: s3Key };

    await db.updateUser(req.user!.id, { picture: url, profile: mergedProfile as any });
    res.json({ success: true, data: { picture: url } });
  } catch (error) {
    console.error('Error saving avatar:', error);
    res.status(500).json({ success: false, error: 'Failed to save avatar' });
  }
});

export default router;
