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

    const subAlbumMeta = await db.getSubAlbums(album.subAlbumIds ?? []);
    const childAlbums = subAlbumMeta
      .filter(a => a.publicToken)
      .map(a => ({
        name: a.title,
        albumId: a.albumId,
        token: a.publicToken!,
        publicUrl: `${process.env.FRONTEND_URL || 'https://akhilsailatchireddi.github.io/photo-vault'}/album/public/${a.publicToken}`,
      }));

    // For parent albums with no direct photos, aggregate IDs from sub-albums
    let directIds = album.photoIds;
    let totalPhotos = directIds.length;
    if (directIds.length === 0 && (album.subAlbumIds ?? []).length > 0) {
      const subAlbums = await Promise.all(
        (album.subAlbumIds ?? []).map(id => db.getAlbumById(id))
      );
      directIds = subAlbums.flatMap(s => s?.photoIds ?? []);
      totalPhotos = directIds.length;
    }

    const PAGE_SIZE = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const start = (page - 1) * PAGE_SIZE;
    const pageIds = directIds.slice(start, start + PAGE_SIZE);
    const hasMore = start + PAGE_SIZE < directIds.length;

    const photos = await db.getPhotosByIds(pageIds);
    const listingKeys = photos.map(p => p.thumbnailS3Key ?? p.s3Key);
    const { urls } = await s3Service.getBatchObjectUrls(listingKeys, 7200);
    const photosWithUrls = photos.map((p, i) => ({
      ...p,
      downloadUrl: p.thumbnailS3Key ? null : (urls[i]?.url ?? null),
      thumbnailUrl: p.thumbnailS3Key ? (urls[i]?.url ?? null) : null,
    }));

    res.json({
      success: true,
      data: {
        albumId: album.albumId,
        title: album.title,
        description: album.description,
        createdAt: album.createdAt,
        photos: photosWithUrls,
        photoCount: totalPhotos,
        page,
        pageSize: PAGE_SIZE,
        totalPhotos,
        hasMore,
        childAlbums,
        isMasterAlbum: childAlbums.length > 0,
      },
    });
  } catch (error) {
    console.error('Error fetching public album:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch album' });
  }
});

// GET /api/public/albums/:token/people — people grouped view (no auth)
router.get('/:token/people', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) {
      return res.status(400).json({ success: false, error: 'Invalid public token' });
    }

    const album = await db.getAlbumByToken(token);
    if (!album) return res.status(404).json({ success: false, error: 'Album not found or expired' });

    let photoIds = album.photoIds;
    if (photoIds.length === 0 && (album.subAlbumIds ?? []).length > 0) {
      const subAlbums = await Promise.all(
        (album.subAlbumIds ?? []).map(id => db.getAlbumById(id))
      );
      photoIds = subAlbums.flatMap(s => s?.photoIds ?? []);
    }

    const groups = await db.getPeopleInPhotoSet(photoIds, album.userId);

    const groupsWithUrls = await Promise.all(groups.map(async g => {
      let coverUrl: string | null = null;
      if (g.person.coverFaceS3Key) {
        try { coverUrl = (await s3Service.getObjectUrl(g.person.coverFaceS3Key, 7200)).url; } catch { /* ignore */ }
      }
      return { person: { ...g.person, coverUrl }, photoIds: g.photoIds };
    }));

    res.json({ success: true, data: groupsWithUrls });
  } catch (error) {
    console.error('Error fetching public album people:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch album people' });
  }
});

export default router;
