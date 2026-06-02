import { Router, Request, Response } from 'express';
import * as db from '../services/database.service';
import { s3Service } from '../services/s3.service';
import { detectAndIndexFaces, deleteFaces } from '../services/rekognition.service';
import { checkJwt } from '../middleware/auth.middleware';
import { ensureUserMiddleware } from '../middleware/ensureUser.middleware';

const router = Router();
router.use(checkJwt);
router.use(ensureUserMiddleware);

// ─── People ───────────────────────────────────────────────────────────────────

// GET /api/people — list all people for the user
router.get('/', async (req: Request, res: Response) => {
  try {
    const people = await db.getPeopleByUserId(req.user!.id);

    // Generate face thumbnail presigned URLs for cover faces
    const peopleWithUrls = await Promise.all(people.map(async (person) => {
      let coverUrl: string | null = null;
      if (person.coverFaceS3Key) {
        try {
          const result = await s3Service.getObjectUrl(person.coverFaceS3Key, 7200);
          coverUrl = result.url;
        } catch { /* ignore */ }
      }
      return { ...person, coverUrl };
    }));

    res.json({ success: true, data: peopleWithUrls });
  } catch (error) {
    console.error('Error fetching people:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch people' });
  }
});

// GET /api/people/:id/photos — all photos containing this person
router.get('/:id/photos', async (req: Request, res: Response) => {
  try {
    const person = await db.getPersonById(req.params.id);
    if (!person || person.userId !== req.user!.id) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    const photoIds = await db.getPhotosByPersonId(req.params.id);
    const photos = await db.getPhotosByIds(photoIds);

    // Filter to only this user's photos
    const userPhotos = photos.filter(p => p.userId === req.user!.id);

    const { urls } = await s3Service.getBatchObjectUrls(userPhotos.map(p => p.s3Key), 7200);
    const photosWithUrls = userPhotos.map(p => ({
      ...p,
      downloadUrl: urls.find(u => u.key === p.s3Key)?.url ?? null,
    }));

    res.json({ success: true, data: { person, photos: photosWithUrls } });
  } catch (error) {
    console.error('Error fetching person photos:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch person photos' });
  }
});

// PUT /api/people/:id — rename a person
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'name is required' });

    const person = await db.getPersonById(req.params.id);
    if (!person || person.userId !== req.user!.id) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    const updated = await db.updatePerson(req.params.id, { name: name.trim() });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({ success: false, error: 'Failed to update person' });
  }
});

// DELETE /api/people/:id — remove a person (does not delete photos)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const person = await db.getPersonById(req.params.id);
    if (!person || person.userId !== req.user!.id) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    // Remove Rekognition face vectors
    if (person.faceIds.length > 0) {
      try { await deleteFaces(person.faceIds); } catch { /* ignore */ }
    }

    await db.deletePerson(req.params.id);
    res.json({ success: true, message: 'Person removed' });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({ success: false, error: 'Failed to delete person' });
  }
});

// ─── Face operations ──────────────────────────────────────────────────────────

// POST /api/people/detect/:photoId — detect faces in a photo
router.post('/detect/:photoId', async (req: Request, res: Response) => {
  try {
    const photo = await db.getPhotoById(req.params.photoId, req.user!.id);
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });

    // Check if already processed
    const existing = await db.getPhotoFaces(photo.photoId);
    if (existing && existing.faces.length >= 0 && !req.query.force) {
      return res.json({ success: true, data: existing, cached: true });
    }

    // Detect and index faces via Rekognition
    const { faces } = await detectAndIndexFaces(photo.s3Key);

    if (faces.length === 0) {
      const record = await db.savePhotoFaces(photo.photoId, req.user!.id, []);
      return res.json({ success: true, data: record, peopleFound: 0 });
    }

    // For each face, find or create a person
    const userId = req.user!.id;
    const existingPeople = await db.getPeopleByUserId(userId);
    const faceRecords: db.PhotoFace['faces'] = [];

    for (const face of faces) {
      if (!face.faceId) continue;

      // Check if this faceId already belongs to a person
      let person = existingPeople.find(p => p.faceIds.includes(face.faceId!));

      if (!person) {
        // New person — create with auto-name
        const autoName = `Person ${existingPeople.length + faceRecords.filter(f => !f.personId).length + 1}`;
        person = await db.createPerson({
          userId,
          name: autoName,
          faceIds: [face.faceId],
          coverFaceS3Key: photo.s3Key,
          coverBoundingBox: face.boundingBox,
        });
        existingPeople.push(person);
      } else {
        // Add faceId to existing person if not already there
        if (!person.faceIds.includes(face.faceId)) {
          const updatedFaceIds = [...person.faceIds, face.faceId];
          await db.updatePerson(person.personId, { faceIds: updatedFaceIds });
          person.faceIds = updatedFaceIds;
        }
      }

      // Update photo count
      await db.updatePerson(person.personId, { photoCount: person.photoCount + 1 });

      faceRecords.push({
        faceId: face.faceId,
        personId: person.personId,
        boundingBox: face.boundingBox,
        confidence: face.confidence,
      });
    }

    const photoFaces = await db.savePhotoFaces(photo.photoId, userId, faceRecords);
    res.json({ success: true, data: photoFaces, peopleFound: faceRecords.length });
  } catch (error) {
    console.error('Error detecting faces:', error);
    res.status(500).json({ success: false, error: 'Failed to detect faces' });
  }
});

// GET /api/people/faces/:photoId — get face data for a photo
router.get('/faces/:photoId', async (req: Request, res: Response) => {
  try {
    const photo = await db.getPhotoById(req.params.photoId, req.user!.id);
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });

    const faces = await db.getPhotoFaces(photo.photoId);
    if (!faces) return res.json({ success: true, data: null });

    // Enrich with person names
    const peopleMap = new Map<string, db.Person>();
    for (const face of faces.faces) {
      if (face.personId && !peopleMap.has(face.personId)) {
        const person = await db.getPersonById(face.personId);
        if (person) peopleMap.set(face.personId, person);
      }
    }

    const enriched = faces.faces.map(f => ({
      ...f,
      personName: f.personId ? (peopleMap.get(f.personId)?.name ?? 'Unknown') : null,
    }));

    res.json({ success: true, data: { ...faces, faces: enriched } });
  } catch (error) {
    console.error('Error getting photo faces:', error);
    res.status(500).json({ success: false, error: 'Failed to get face data' });
  }
});

// POST /api/people/assign — assign a face to a person (or new named person)
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const { photoId, faceId, personId, newPersonName } = req.body;
    if (!photoId || !faceId) {
      return res.status(400).json({ success: false, error: 'photoId and faceId are required' });
    }

    const photo = await db.getPhotoById(photoId, req.user!.id);
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });

    const userId = req.user!.id;
    let targetPersonId = personId;

    if (!targetPersonId && newPersonName) {
      // Create a new named person
      const photoFaces = await db.getPhotoFaces(photoId);
      const face = photoFaces?.faces.find(f => f.faceId === faceId);
      const person = await db.createPerson({
        userId,
        name: newPersonName.trim(),
        faceIds: [faceId],
        coverFaceS3Key: photo.s3Key,
        coverBoundingBox: face?.boundingBox,
      });
      targetPersonId = person.personId;
    } else if (targetPersonId) {
      // Add faceId to existing person
      const person = await db.getPersonById(targetPersonId);
      if (!person || person.userId !== userId) {
        return res.status(404).json({ success: false, error: 'Person not found' });
      }
      if (!person.faceIds.includes(faceId)) {
        await db.updatePerson(targetPersonId, { faceIds: [...person.faceIds, faceId] });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Provide personId or newPersonName' });
    }

    await db.updatePhotoFacePersonId(photoId, faceId, targetPersonId);
    res.json({ success: true, data: { personId: targetPersonId } });
  } catch (error) {
    console.error('Error assigning face:', error);
    res.status(500).json({ success: false, error: 'Failed to assign face' });
  }
});

export default router;
