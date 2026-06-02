import {
  RekognitionClient,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DetectFacesCommand,
  DeleteFacesCommand,
  ListFacesCommand,
  Attribute,
} from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const client = new RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' });
const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID || 'photovault-faces-prod-v1';
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'photovault-app-bucket-akhil';

export interface DetectedFace {
  faceId?: string;         // assigned by Rekognition after indexing
  boundingBox: { left: number; top: number; width: number; height: number };
  confidence: number;
  matchedPersonId?: string; // if matched to existing person
  matchSimilarity?: number;
}

export interface IndexResult {
  faces: DetectedFace[];
}

/**
 * Detect faces in an image and index them into the Rekognition collection.
 * Returns detected faces with bounding boxes and any matches to existing people.
 */
export async function detectAndIndexFaces(s3Key: string): Promise<IndexResult> {
  // First detect faces to get bounding boxes and count
  const detectRes = await client.send(new DetectFacesCommand({
    Image: { S3Object: { Bucket: S3_BUCKET, Name: s3Key } },
    Attributes: [Attribute.DEFAULT],
  }));

  if (!detectRes.FaceDetails || detectRes.FaceDetails.length === 0) {
    return { faces: [] };
  }

  // Index faces into collection for future matching
  const indexRes = await client.send(new IndexFacesCommand({
    CollectionId: COLLECTION_ID,
    Image: { S3Object: { Bucket: S3_BUCKET, Name: s3Key } },
    ExternalImageId: s3Key.replace(/[^a-zA-Z0-9_.\-:]/g, '_'),
    DetectionAttributes: [Attribute.DEFAULT],
    MaxFaces: 20,
    QualityFilter: 'AUTO',
  }));

  const faces: DetectedFace[] = (indexRes.FaceRecords ?? []).map(record => ({
    faceId: record.Face?.FaceId,
    boundingBox: {
      left: record.Face?.BoundingBox?.Left ?? 0,
      top: record.Face?.BoundingBox?.Top ?? 0,
      width: record.Face?.BoundingBox?.Width ?? 0,
      height: record.Face?.BoundingBox?.Height ?? 0,
    },
    confidence: record.Face?.Confidence ?? 0,
  }));

  return { faces };
}

/**
 * Search for matching faces in the collection for a specific face region.
 * Used when assigning a face to an existing person.
 */
export async function searchSimilarFaces(s3Key: string, boundingBox: DetectedFace['boundingBox']): Promise<{ faceId: string; similarity: number }[]> {
  try {
    const res = await client.send(new SearchFacesByImageCommand({
      CollectionId: COLLECTION_ID,
      Image: { S3Object: { Bucket: S3_BUCKET, Name: s3Key } },
      FaceMatchThreshold: 80,
      MaxFaces: 5,
    }));

    return (res.FaceMatches ?? []).map(m => ({
      faceId: m.Face?.FaceId ?? '',
      similarity: m.Similarity ?? 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Delete face vectors from the Rekognition collection (when photo is deleted).
 */
export async function deleteFaces(faceIds: string[]): Promise<void> {
  if (faceIds.length === 0) return;
  await client.send(new DeleteFacesCommand({
    CollectionId: COLLECTION_ID,
    FaceIds: faceIds,
  }));
}
