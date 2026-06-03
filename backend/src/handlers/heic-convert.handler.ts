import { S3Event, Context } from 'aws-lambda';
import { getPhotoByS3Key, updatePhoto } from '../services/database.service';
import { isHeic, convertHeicToJpeg } from '../services/heic.service';

export async function handler(event: S3Event, _context: Context): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`HeicConvert: processing ${s3Key} from ${bucket}`);

    // Skip if not a HEIC file (safety check — S3 filter should handle this)
    if (!isHeic('image/heic', s3Key)) {
      console.log(`Skipping ${s3Key} — not a HEIC file`);
      continue;
    }

    try {
      // Convert HEIC → JPEG
      const { jpegS3Key, mimeType } = await convertHeicToJpeg(s3Key);
      console.log(`Converted ${s3Key} → ${jpegS3Key}`);

      // Update DB record to point to the JPEG
      const photo = await getPhotoByS3Key(s3Key);
      if (photo) {
        await updatePhoto(photo.photoId, photo.userId, { s3Key: jpegS3Key, mimeType });
        console.log(`Updated DB photo ${photo.photoId} → ${jpegS3Key}`);
      } else {
        console.warn(`No DB record found for s3Key: ${s3Key}`);
      }
    } catch (err) {
      console.error(`Failed to convert ${s3Key}:`, err instanceof Error ? err.message : String(err));
    }
  }
}
