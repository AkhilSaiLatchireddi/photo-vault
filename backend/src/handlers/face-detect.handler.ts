import { S3Event, Context } from 'aws-lambda';
import { getPhotoByS3Key, getPeopleByUserId, createPerson, updatePerson, savePhotoFaces, getPhotoFaces, PhotoFace } from '../services/database.service';
import { detectAndIndexFaces } from '../services/rekognition.service';
import { isHeic } from '../services/heic.service';

export async function handler(event: S3Event, _context: Context): Promise<void> {
  for (const record of event.Records) {
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`FaceDetect: processing ${s3Key}`);

    // Skip HEIC files — they'll be converted first, then the .jpg triggers this again
    // Skip HEIC/HEIF files — the heic-convert Lambda will write a .jpg which triggers us again
    const ext = s3Key.split('.').pop()?.toLowerCase();
    if (ext === 'heic' || ext === 'heif') {
      console.log(`Skipping HEIC ${s3Key} — will process after conversion`);
      continue;
    }

    // Skip non-image files
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'];
    if (!ext || !imageExts.includes(ext)) {
      console.log(`Skipping ${s3Key} — not a supported image`);
      continue;
    }

    try {
      // Find the photo record in DB
      const photo = await getPhotoByS3Key(s3Key);
      if (!photo) {
        console.warn(`No DB record for ${s3Key} — may not be uploaded yet, skipping`);
        continue;
      }

      // Skip if already processed
      const existing = await getPhotoFaces(photo.photoId);
      if (existing) {
        console.log(`Already processed ${photo.photoId}, skipping`);
        continue;
      }

      const userId = photo.userId;
      const { faces } = await detectAndIndexFaces(s3Key);

      if (faces.length === 0) {
        await savePhotoFaces(photo.photoId, userId, []);
        console.log(`No faces found in ${photo.photoId}`);
        continue;
      }

      const existingPeople = await getPeopleByUserId(userId);
      const faceRecords: PhotoFace['faces'] = [];

      for (const face of faces) {
        if (!face.faceId) continue;

        const lookupIds = [face.faceId, ...(face.similarFaceIds ?? [])];
        let person = existingPeople.find(p => lookupIds.some(id => p.faceIds.includes(id)));

        if (!person) {
          const autoName = `Person ${existingPeople.length + 1}`;
          person = await createPerson({
            userId,
            name: autoName,
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
        faceRecords.push({
          faceId: face.faceId,
          personId: person.personId,
          boundingBox: face.boundingBox,
          confidence: face.confidence,
        });
      }

      await savePhotoFaces(photo.photoId, userId, faceRecords);
      console.log(`Face detection complete for ${photo.photoId}: ${faceRecords.length} faces`);
    } catch (err) {
      console.error(`FaceDetect failed for ${s3Key}:`, err instanceof Error ? err.message : String(err));
    }
  }
}
