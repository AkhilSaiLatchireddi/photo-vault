import { EventBridgeEvent, Context } from 'aws-lambda';
import { getPhotoByS3Key, updatePhoto } from '../services/database.service';
import { isHeic, convertHeicToJpeg } from '../services/heic.service';

interface HeicConvertDetail {
  s3Key: string;
  photoId: string;
  userId: string;
}

export async function handler(
  event: EventBridgeEvent<'heic.convert', HeicConvertDetail>,
  _context: Context
): Promise<void> {
  const { s3Key, photoId } = event.detail;
  console.log(`HeicConvert (EventBridge): ${s3Key}`);

  if (!isHeic('image/heic', s3Key)) {
    console.log(`Not a HEIC file: ${s3Key}`);
    return;
  }

  try {
    const { jpegS3Key, mimeType } = await convertHeicToJpeg(s3Key);
    const photo = await getPhotoByS3Key(s3Key);
    if (photo) {
      await updatePhoto(photo.photoId, photo.userId, { s3Key: jpegS3Key, mimeType });
      console.log(`Converted ${photoId} → ${jpegS3Key}`);
    }
  } catch (err) {
    console.error(`HeicConvert EB failed for ${s3Key}:`, err instanceof Error ? err.message : String(err));
    throw err; // let EventBridge retry
  }
}
