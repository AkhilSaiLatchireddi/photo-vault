import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'photovault-bucket';
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
