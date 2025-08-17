import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
<<<<<<< Updated upstream
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
=======
<<<<<<< HEAD
    // Initialize S3 client with Lambda-compatible configuration
    const region = process.env.AWS_REGION || 'us-east-1';
    
    // For Lambda, AWS credentials are automatically provided by the execution role
    // For local development, use AWS credentials from environment or AWS profile
    const s3Config: any = {
      region: region
    };

    // Only set credentials explicitly if running locally (not in Lambda)
    if (process.env.NODE_ENV !== 'production' && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      s3Config.credentials = {
>>>>>>> Stashed changes
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
<<<<<<< Updated upstream
    this.bucketName = process.env.S3_BUCKET_NAME || 'photovault-bucket';
=======
=======
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'photovault-bucket';
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
  }

  /**
   * List all objects in the S3 bucket
   */
  async listObjects(prefix?: string) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: 100,
      });

      const response = await this.s3Client.send(command);
      
      return {
        success: true,
        objects: response.Contents?.map(obj => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          etag: obj.ETag,
        })) || [],
        count: response.KeyCount || 0,
      };
    } catch (error) {
      console.error('Error listing S3 objects:', error);
      throw new Error('Failed to list objects from S3');
    }
  }

  /**
   * Get a presigned URL for downloading an object
<<<<<<< Updated upstream
=======
<<<<<<< HEAD
   * For photos, use longer expiry times for better performance
=======
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
   */
  async getObjectUrl(key: string, expiresIn: number = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn 
      });

      return {
        success: true,
        url: signedUrl,
        expiresIn,
      };
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  /**
<<<<<<< Updated upstream
=======
<<<<<<< HEAD
   * Get presigned URLs for multiple photos (batch operation)
   * Optimized for photo galleries
   */
  async getBatchObjectUrls(keys: string[], expiresIn: number = 7200) {
    try {
      const urlPromises = keys.map(async (key) => {
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });

        const signedUrl = await getSignedUrl(this.s3Client, command, { 
          expiresIn 
        });

        return {
          key,
          url: signedUrl
        };
      });

      const urls = await Promise.all(urlPromises);

      return {
        success: true,
        urls,
        expiresIn,
        count: urls.length
      };
    } catch (error) {
      console.error('Error generating batch presigned URLs:', error);
      throw new Error('Failed to generate batch download URLs');
    }
  }

  /**
   * Get public URL for photos (if bucket allows public read)
   * Alternative to presigned URLs for better caching
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }

  /**
=======
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
   * Get a presigned URL for uploading an object
   */
  async getUploadUrl(key: string, contentType: string, expiresIn: number = 3600) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn 
      });

      return {
        success: true,
        uploadUrl: signedUrl,
        key,
        expiresIn,
      };
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Delete an object from S3
   */
  async deleteObject(key: string) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      return {
        success: true,
        message: `Object ${key} deleted successfully`,
      };
    } catch (error) {
      console.error('Error deleting S3 object:', error);
      throw new Error('Failed to delete object from S3');
    }
  }

  /**
   * Check if bucket is accessible
   */
  async checkBucketAccess() {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      });

      await this.s3Client.send(command);
      
      return {
        success: true,
        message: 'S3 bucket is accessible',
        bucket: this.bucketName,
      };
    } catch (error) {
      console.error('Error accessing S3 bucket:', error);
      throw new Error('Failed to access S3 bucket');
    }
  }
}

export const s3Service = new S3Service();
