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

// GET /api/public/albums/:token/people — people list (no auth)
// Returns people sorted by photoCount desc. Does NOT scan face records —
// uses the person table directly so it stays fast regardless of album size.
router.get('/:token/people', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) {
      return res.status(400).json({ success: false, error: 'Invalid public token' });
    }

    const album = await db.getAlbumByToken(token);
    if (!album) return res.status(404).json({ success: false, error: 'Album not found or expired' });

    // Fetch all people for this album's owner — fast single DynamoDB query
    const people = await db.getPeopleByUserId(album.userId);

    // Sort by photoCount desc
    people.sort((a, b) => (b.photoCount ?? 0) - (a.photoCount ?? 0));

    // Paginate
    const PAGE_SIZE = parseInt(req.query.limit as string) || 30;
    const page = parseInt(req.query.page as string) || 1;
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = people.slice(start, start + PAGE_SIZE);

    // Generate cover URLs for this page only
    const peopleWithUrls = await Promise.all(pageItems.map(async person => {
      let coverUrl: string | null = null;
      if (person.coverFaceS3Key) {
        try { coverUrl = (await s3Service.getObjectUrl(person.coverFaceS3Key, 7200)).url; } catch { /* ignore */ }
      }
      // Return photoIds as empty — public viewer fetches person photos separately
      return { person: { ...person, coverUrl }, photoIds: [] as string[] };
    }));

    res.json({
      success: true,
      data: peopleWithUrls,
      totalCount: people.length,
      page,
      hasMore: start + PAGE_SIZE < people.length,
    });
  } catch (error) {
    console.error('Error fetching public album people:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch album people' });
  }
});

// GET /api/public/albums/:token/people/:personId/photos — paginated photos for one person
router.get('/:token/people/:personId/photos', async (req: Request, res: Response) => {
  try {
    const { token, personId } = req.params;
    if (!token || token.length !== 64) {
      return res.status(400).json({ success: false, error: 'Invalid public token' });
    }

    const album = await db.getAlbumByToken(token);
    if (!album) return res.status(404).json({ success: false, error: 'Album not found or expired' });

    // Verify person belongs to album owner
    const person = await db.getPersonById(personId);
    if (!person || person.userId !== album.userId) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    const allPhotoIds = await db.getPhotosByPersonId(personId);

    const PAGE_SIZE = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const start = (page - 1) * PAGE_SIZE;
    const pageIds = allPhotoIds.slice(start, start + PAGE_SIZE);
    const hasMore = start + PAGE_SIZE < allPhotoIds.length;

    const photos = await db.getPhotosByIds(pageIds);
    const listingKeys = photos.map(p => p.thumbnailS3Key ?? p.s3Key);
    const { urls } = await s3Service.getBatchObjectUrls(listingKeys, 7200);
    const photosWithUrls = photos.map((p, i) => ({
      ...p,
      thumbnailUrl: p.thumbnailS3Key ? (urls[i]?.url ?? null) : null,
      downloadUrl: p.thumbnailS3Key ? null : (urls[i]?.url ?? null),
    }));

    res.json({
      success: true,
      data: { photos: photosWithUrls, totalCount: allPhotoIds.length, page, hasMore },
    });
  } catch (error) {
    console.error('Error fetching public person photos:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch person photos' });
  }
});

export default router;
