import {
  RekognitionClient,
  IndexFacesCommand,
  SearchFacesCommand,
  DetectFacesCommand,
  DeleteFacesCommand,
  Attribute,
} from '@aws-sdk/client-rekognition';

const client = new RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' });
const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID || 'photovault-faces-prod-v1';
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'photovault-app-bucket-akhil';
const SIMILARITY_THRESHOLD = 70;

export interface DetectedFace {
  faceId: string;
  boundingBox: { left: number; top: number; width: number; height: number };
  confidence: number;
  // ALL similar faceIds found in collection (sorted by similarity desc)
  // Route uses this to find the first one that already has a person assigned
  similarFaceIds: string[];
  topSimilarity?: number;
}

export interface IndexResult {
  faces: DetectedFace[];
}

export async function detectAndIndexFaces(s3Key: string): Promise<IndexResult> {
  let detectRes;
  try {
    detectRes = await client.send(new DetectFacesCommand({
      Image: { S3Object: { Bucket: S3_BUCKET, Name: s3Key } },
      Attributes: [Attribute.DEFAULT],
    }));
  } catch (e: any) {
    // Unsupported format (HEIC, TIFF, etc) — skip silently
    if (e.name === 'InvalidImageFormatException' || e.name === 'InvalidParameterException') {
      console.log(`Skipping ${s3Key}: unsupported image format`);
      return { faces: [] };
    }
    throw e;
  }

  if (!detectRes.FaceDetails || detectRes.FaceDetails.length === 0) {
    return { faces: [] };
  }

  let indexRes;
  try {
    indexRes = await client.send(new IndexFacesCommand({
    CollectionId: COLLECTION_ID,
    Image: { S3Object: { Bucket: S3_BUCKET, Name: s3Key } },
    ExternalImageId: s3Key.replace(/[^a-zA-Z0-9_.\-:]/g, '_'),
    DetectionAttributes: [Attribute.DEFAULT],
      MaxFaces: 20,
      QualityFilter: 'AUTO',
    }));
  } catch (e: any) {
    if (e.name === 'InvalidImageFormatException' || e.name === 'InvalidParameterException') {
      console.log(`Skipping ${s3Key}: unsupported image format for indexing`);
      return { faces: [] };
    }
    throw e;
  }

  const indexedFaces = indexRes.FaceRecords ?? [];
  if (indexedFaces.length === 0) return { faces: [] };

  // Wait briefly for collection to propagate
  await new Promise(r => setTimeout(r, 500));

  const faces: DetectedFace[] = await Promise.all(
    indexedFaces.map(async (record) => {
      const faceId = record.Face?.FaceId ?? '';
      const bb = record.Face?.BoundingBox;

      let similarFaceIds: string[] = [];
      let topSimilarity: number | undefined;

      try {
        const searchRes = await client.send(new SearchFacesCommand({
          CollectionId: COLLECTION_ID,
          FaceId: faceId,
          FaceMatchThreshold: SIMILARITY_THRESHOLD,
          MaxFaces: 10, // get ALL similar faces, not just top 1
        }));

        const matches = (searchRes.FaceMatches ?? [])
          .sort((a, b) => (b.Similarity ?? 0) - (a.Similarity ?? 0));

        similarFaceIds = matches.map(m => m.Face?.FaceId ?? '').filter(Boolean);
        topSimilarity = matches[0]?.Similarity;

        console.log(`SearchFaces(${faceId}) found ${matches.length} similar faces`);
      } catch (e) {
        console.log(`SearchFaces error for ${faceId}:`, e instanceof Error ? e.message : String(e));
      }

      return {
        faceId,
        boundingBox: {
          left: bb?.Left ?? 0,
          top: bb?.Top ?? 0,
          width: bb?.Width ?? 0,
          height: bb?.Height ?? 0,
        },
        confidence: record.Face?.Confidence ?? 0,
        similarFaceIds,
        topSimilarity,
      };
    })
  );

  return { faces };
}

export async function deleteFaces(faceIds: string[]): Promise<void> {
  if (faceIds.length === 0) return;
  await client.send(new DeleteFacesCommand({
    CollectionId: COLLECTION_ID,
    FaceIds: faceIds,
  }));
}
