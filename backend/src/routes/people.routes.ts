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

// GET /api/people — list all people for the user + shared album owners
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Own people
    const ownPeople = await db.getPeopleByUserId(userId);

    // People from accounts that shared albums with this user (e.g. husband → wife)
    const sharedOwnerIds = await db.getSharedAlbumOwnerIds(userId);
    const sharedPeopleLists = await Promise.all(sharedOwnerIds.map(id => db.getPeopleByUserId(id)));
    const sharedPeople = sharedPeopleLists.flat();

    // Merge, dedup by personId, mark shared ones as readOnly
    const seen = new Set<string>();
    const all = [
      ...ownPeople.map(p => ({ ...p, readOnly: false })),
      ...sharedPeople.map(p => ({ ...p, readOnly: true })),
    ].filter(p => { if (seen.has(p.personId)) return false; seen.add(p.personId); return true; });

    const peopleWithUrls = await Promise.all(all.map(async (person) => {
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
    const userId = req.user!.id;
    // Allow if owner OR if person belongs to someone who shared albums with this user
    const sharedOwnerIds = await db.getSharedAlbumOwnerIds(userId);
    const canAccess = person && (person.userId === userId || sharedOwnerIds.includes(person.userId));
    if (!canAccess) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    const photoIds = await db.getPhotosByPersonId(req.params.id);
    const photos = await db.getPhotosByIds(photoIds);

    let visiblePhotos;
    if (person.userId === userId) {
      // Owner sees all their own photos for this person
      visiblePhotos = photos.filter(p => p.userId === userId);
    } else {
      // Shared user only sees photos that are in albums shared with them
      const visiblePhotoIds = await db.getPhotoIdsVisibleToSharedUser(userId);
      visiblePhotos = photos.filter(p => visiblePhotoIds.has(p.photoId));
    }

    const { urls } = await s3Service.getBatchObjectUrls(visiblePhotos.map(p => p.s3Key), 7200);
    const photosWithUrls = visiblePhotos.map(p => ({
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

      // All faceIds to check: own faceId + all similar faces from Rekognition
      const lookupIds = [face.faceId, ...(face.similarFaceIds ?? [])];
      // Find the FIRST existing person that has any of these faceIds
      let person = existingPeople.find(p => lookupIds.some(id => p.faceIds.includes(id)));

      if (!person) {
        // Genuinely new person — create with auto-name
        const autoName = `Person ${existingPeople.length + 1}`;
        person = await db.createPerson({
          userId,
          name: autoName,
          faceIds: [face.faceId],
          coverFaceS3Key: photo.s3Key,
          coverBoundingBox: face.boundingBox,
        });
        existingPeople.push(person);
      } else {
        // Known person — add new faceId to their record if not already there
        if (!person.faceIds.includes(face.faceId)) {
          const updatedFaceIds = [...person.faceIds, face.faceId];
          await db.updatePerson(person.personId, { faceIds: updatedFaceIds });
          person.faceIds = updatedFaceIds;
        }
      }

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
    const userId = req.user!.id;
    // Allow own photos OR photos that are in albums explicitly shared with this user
    let photo = await db.getPhotoById(req.params.photoId, userId);
    if (!photo) {
      // Check if this photoId is inside a shared album
      const visiblePhotoIds = await db.getPhotoIdsVisibleToSharedUser(userId);
      if (visiblePhotoIds.has(req.params.photoId)) {
        // Fetch the photo directly (bypassing owner check) since we confirmed it's visible
        const sharedOwnerIds = await db.getSharedAlbumOwnerIds(userId);
        for (const ownerId of sharedOwnerIds) {
          photo = await db.getPhotoById(req.params.photoId, ownerId) ?? null;
          if (photo) break;
        }
      }
    }
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

// POST /api/people/scan-all — detect faces on all unprocessed photos for this user
router.post('/scan-all', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    console.log('scan-all userId:', userId);
    const { photos } = await db.getUserPhotos(userId, 200);
    console.log('scan-all photos found:', photos.length);

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const photo of photos) {
      console.log('Processing photo:', photo.photoId, 'mime:', photo.mimeType);
      // Skip non-images
      if (!photo.mimeType.startsWith('image/')) { skipped++; console.log('Skipped - not image'); continue; }

      // Skip if already processed (unless force flag)
      const existing = await db.getPhotoFaces(photo.photoId);
      console.log('Existing faces:', existing ? 'yes' : 'no', 'force:', req.query.force);
      if (existing && !req.query.force) { skipped++; console.log('Skipped - already processed'); continue; }

      try {
        const { faces } = await detectAndIndexFaces(photo.s3Key);
        const existingPeople = await db.getPeopleByUserId(userId);
        const faceRecords: db.PhotoFace['faces'] = [];

        for (const face of faces) {
          if (!face.faceId) continue;
          const lookupIds = [face.faceId, ...(face.similarFaceIds ?? [])];
          let person = existingPeople.find(p => lookupIds.some(id => p.faceIds.includes(id)));
          console.log('scan-all person found:', person?.personId ?? 'none');
          if (!person) {
            const autoName = `Person ${existingPeople.length + 1}`;
            person = await db.createPerson({
              userId, name: autoName, faceIds: [face.faceId],
              coverFaceS3Key: photo.s3Key, coverBoundingBox: face.boundingBox,
            });
            existingPeople.push(person);
          } else if (!person.faceIds.includes(face.faceId)) {
            const updated = [...person.faceIds, face.faceId];
            await db.updatePerson(person.personId, { faceIds: updated });
            person.faceIds = updated;
          }
          await db.updatePerson(person.personId, { photoCount: person.photoCount + 1 });
          faceRecords.push({ faceId: face.faceId, personId: person.personId, boundingBox: face.boundingBox, confidence: face.confidence });
        }

        await db.savePhotoFaces(photo.photoId, userId, faceRecords);
        processed++;
      } catch (e) {
        console.error('Error processing photo', photo.photoId, ':', e instanceof Error ? e.message : String(e));
        errors.push(photo.photoId);
      }
    }

    // Post-scan dedup: merge people whose faceIds are all similar to each other
    // This fixes any split-person issues from parallel processing
    let merged = 0;
    try {
      const allPeople = await db.getPeopleByUserId(userId);
      const seen = new Set<string>();

      for (const person of allPeople) {
        if (seen.has(person.personId)) continue;
        {
          // Find all other people whose faceIds overlap with this person's faceIds
          const duplicates = allPeople.filter(p =>
            p.personId !== person.personId &&
            !seen.has(p.personId) &&
            p.faceIds.some(f => person.faceIds.includes(f))
          );
          for (const dup of duplicates) {
            // Merge dup into person
            const mergedFaceIds = [...new Set([...person.faceIds, ...dup.faceIds])];
            await db.updatePerson(person.personId, {
              faceIds: mergedFaceIds,
              photoCount: person.photoCount + dup.photoCount,
            });
            person.faceIds = mergedFaceIds;
            person.photoCount += dup.photoCount;
            const dupPhotoIds = await db.getPhotosByPersonId(dup.personId);
            for (const photoId of dupPhotoIds) {
              const faces = await db.getPhotoFaces(photoId);
              if (!faces) continue;
              const updated = faces.faces.map((f: any) => f.personId === dup.personId ? { ...f, personId: person.personId } : f);
              await db.savePhotoFaces(photoId, userId, updated);
            }
            await db.deletePerson(dup.personId);
            seen.add(dup.personId);
            merged++;
          }
        }
      }
    } catch (e) {
      console.error('Dedup error:', e);
    }

    res.json({ success: true, data: { processed, skipped, errors: errors.length, merged } });
  } catch (error) {
    console.error('Error scanning all photos:', error);
    res.status(500).json({ success: false, error: 'Failed to scan photos' });
  }
});

// POST /api/people/untag — remove a face assignment from a photo, making it a new unnamed person
router.post('/untag', async (req: Request, res: Response) => {
  try {
    const { photoId, faceId } = req.body;
    if (!photoId || !faceId) {
      return res.status(400).json({ success: false, error: 'photoId and faceId required' });
    }

    const userId = req.user!.id;
    const photo = await db.getPhotoById(photoId, userId);
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });

    const photoFaces = await db.getPhotoFaces(photoId);
    if (!photoFaces) return res.status(404).json({ success: false, error: 'No face data for this photo' });

    const face = photoFaces.faces.find(f => f.faceId === faceId);
    if (!face) return res.status(404).json({ success: false, error: 'Face not found in photo' });

    const oldPersonId = face.personId;

    // Create a new unnamed person for this face
    const newPerson = await db.createPerson({
      userId,
      name: 'Unknown Person',
      faceIds: [faceId],
      coverFaceS3Key: photo.s3Key,
      coverBoundingBox: face.boundingBox,
    });

    // Update this face in the photo to point to the new person
    await db.updatePhotoFacePersonId(photoId, faceId, newPerson.personId);

    // Remove faceId from old person's faceIds
    if (oldPersonId) {
      const oldPerson = await db.getPersonById(oldPersonId);
      if (oldPerson && oldPerson.userId === userId) {
        const updatedFaceIds = oldPerson.faceIds.filter(f => f !== faceId);
        if (updatedFaceIds.length === 0) {
          // Old person has no more faces — delete them
          await db.deletePerson(oldPersonId);
        } else {
          await db.updatePerson(oldPersonId, {
            faceIds: updatedFaceIds,
            photoCount: Math.max(0, oldPerson.photoCount - 1),
          });
        }
      }
    }

    res.json({ success: true, data: { newPersonId: newPerson.personId } });
  } catch (error) {
    console.error('Error untagging face:', error);
    res.status(500).json({ success: false, error: 'Failed to untag face' });
  }
});

// POST /api/people/merge — merge two people into one
router.post('/merge', async (req: Request, res: Response) => {
  try {
    const { keepPersonId, mergePersonId } = req.body;
    if (!keepPersonId || !mergePersonId) {
      return res.status(400).json({ success: false, error: 'keepPersonId and mergePersonId required' });
    }

    const userId = req.user!.id;
    const keepPerson = await db.getPersonById(keepPersonId);
    const mergePerson = await db.getPersonById(mergePersonId);

    if (!keepPerson || keepPerson.userId !== userId || !mergePerson || mergePerson.userId !== userId) {
      return res.status(404).json({ success: false, error: 'One or both people not found' });
    }

    // Merge faceIds from both people into the keeper
    const mergedFaceIds = [...new Set([...keepPerson.faceIds, ...mergePerson.faceIds])];
    await db.updatePerson(keepPersonId, {
      faceIds: mergedFaceIds,
      photoCount: keepPerson.photoCount + mergePerson.photoCount,
    });

    // Update all photo-faces records that reference the merged person
    const mergePhotoIds = await db.getPhotosByPersonId(mergePersonId);
    for (const photoId of mergePhotoIds) {
      const faces = await db.getPhotoFaces(photoId);
      if (!faces) continue;
      const updated = faces.faces.map(f => f.personId === mergePersonId ? { ...f, personId: keepPersonId } : f);
      await db.savePhotoFaces(photoId, userId, updated);
    }

    // Delete the merged person
    await db.deletePerson(mergePersonId);

    res.json({ success: true, message: `Merged into ${keepPerson.name}` });
  } catch (error) {
    console.error('Error merging people:', error);
    res.status(500).json({ success: false, error: 'Failed to merge people' });
  }
});

export default router;
