import { Router, Request, Response } from 'express';
import * as db from '../services/database.service';
import { checkJwt } from '../middleware/auth.middleware';
import { ensureUserMiddleware } from '../middleware/ensureUser.middleware';

const router = Router();

// GET /api/profile
router.get('/', checkJwt, ensureUserMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await db.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
});

// PUT /api/profile
router.put('/', checkJwt, ensureUserMiddleware, async (req: Request, res: Response) => {
  try {
    const { profile, name, username } = req.body;

    const existing = await db.getUserById(req.user!.id);
    if (!existing) return res.status(404).json({ success: false, error: 'User not found' });

    const patch: Partial<typeof existing> = {};

    // Allow updating top-level name and username
    if (name && typeof name === 'string') patch.name = name.trim();
    if (username && typeof username === 'string') {
      const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean.length >= 2) patch.username = clean;
    }

    // Merge nested profile object
    if (profile && typeof profile === 'object') {
      patch.profile = {
        ...existing.profile,
        ...profile,
        preferences: { ...existing.profile?.preferences, ...profile.preferences },
      };
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: 'Nothing to update' });
    }

    const updated = await db.updateUser(req.user!.id, patch);
    res.json({ success: true, data: updated, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update user profile' });
  }
});

export default router;
