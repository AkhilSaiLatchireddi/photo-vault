import { EventBridgeEvent, Context } from 'aws-lambda';
import {
  getPhotoByS3Key, getPhotoFaces, savePhotoFaces,
  getPeopleByUserId, createPerson, updatePerson, PhotoFace,
} from '../services/database.service';
import { detectAndIndexFaces } from '../services/rekognition.service';
import { isHeic } from '../services/heic.service';

interface FaceDetectDetail {
  s3Key: string;
  photoId: string;
  userId: string;
  force?: boolean;
}

export async function handler(
  event: EventBridgeEvent<'face.detect', FaceDetectDetail>,
  _context: Context
): Promise<void> {
  const { s3Key, force } = event.detail;
  console.log(`FaceDetect (EventBridge): ${s3Key}`);

  const ext = s3Key.split('.').pop()?.toLowerCase();
  if (ext === 'heic' || ext === 'heif') {
    console.log(`Skipping HEIC ${s3Key} — will process after conversion`);
    return;
  }

  try {
    const photo = await getPhotoByS3Key(s3Key);
    if (!photo) {
      console.warn(`No DB record for ${s3Key}`);
      return;
    }

    if (!force) {
      const existing = await getPhotoFaces(photo.photoId);
      if (existing) {
        console.log(`Already processed ${photo.photoId}`);
        return;
      }
    }

    const userId = photo.userId;
    const { faces } = await detectAndIndexFaces(s3Key);

    if (faces.length === 0) {
      await savePhotoFaces(photo.photoId, userId, []);
      return;
    }

    const existingPeople = await getPeopleByUserId(userId);
    const faceRecords: PhotoFace['faces'] = [];

    for (const face of faces) {
      if (!face.faceId) continue;
      const lookupIds = [face.faceId, ...(face.similarFaceIds ?? [])];
      let person = existingPeople.find(p => lookupIds.some(id => p.faceIds.includes(id)));

      if (!person) {
        person = await createPerson({
          userId,
          name: `Person ${existingPeople.length + 1}`,
          faceIds: [face.faceId],
          coverFaceS3Key: s3Key,
          coverBoundingBox: face.boundingBox,
        });
        existingPeople.push(person);
      } else if (!person.faceIds.includes(face.faceId)) {
        const updated = [...person.faceIds, face.faceId];
        await updatePerson(person.personId, { faceIds: updated });
        person.faceIds = updated;
      }
      await updatePerson(person.personId, { photoCount: person.photoCount + 1 });
      faceRecords.push({ faceId: face.faceId, personId: person.personId, boundingBox: face.boundingBox, confidence: face.confidence });
    }

    await savePhotoFaces(photo.photoId, userId, faceRecords);
    console.log(`FaceDetect EB done: ${photo.photoId}, ${faceRecords.length} faces`);
  } catch (err) {
    console.error(`FaceDetect EB failed for ${s3Key}:`, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
