"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Service = exports.S3Service = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
class S3Service {
    constructor() {
        // Initialize S3 client with Lambda-compatible configuration
        const region = process.env.AWS_REGION || 'us-east-1';
        // For Lambda, AWS credentials are automatically provided by the execution role
        // For local development, use AWS credentials from environment or AWS profile
        const s3Config = {
            region: region
        };
        // Only set credentials explicitly if running locally (not in Lambda)
        if (process.env.NODE_ENV !== 'production' && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            s3Config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            };
        }
        this.s3Client = new client_s3_1.S3Client(s3Config);
        // Get bucket name from environment (stored in AWS SSM Parameter Store for Lambda)
        this.bucketName = process.env.S3_BUCKET_NAME || 'photovault-bucket';
        console.log('🪣 S3 Service initialized:', {
            region: region,
            bucket: this.bucketName,
            environment: process.env.NODE_ENV || 'development'
        });
    }
    /**
     * List all objects in the S3 bucket
     */
    async listObjects(prefix) {
        try {
            const command = new client_s3_1.ListObjectsV2Command({
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
        }
        catch (error) {
            console.error('Error listing S3 objects:', error);
            throw new Error('Failed to list objects from S3');
        }
    }
    /**
     * Get a presigned URL for downloading an object
     * For photos, use longer expiry times for better performance
     */
    async getObjectUrl(key, expiresIn = 3600) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, {
                expiresIn
            });
            return {
                success: true,
                url: signedUrl,
                expiresIn,
            };
        }
        catch (error) {
            console.error('Error generating presigned URL:', error);
            throw new Error('Failed to generate download URL');
        }
    }
    /**
     * Get presigned URLs for multiple photos (batch operation)
     * Optimized for photo galleries
     */
    async getBatchObjectUrls(keys, expiresIn = 7200) {
        try {
            const urlPromises = keys.map(async (key) => {
                const command = new client_s3_1.GetObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                });
                const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, {
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
        }
        catch (error) {
            console.error('Error generating batch presigned URLs:', error);
            throw new Error('Failed to generate batch download URLs');
        }
    }
    /**
     * Get public URL for photos (if bucket allows public read)
     * Alternative to presigned URLs for better caching
     */
    getPublicUrl(key) {
        return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    }
    /**
     * Get a presigned URL for uploading an object
     */
    async getUploadUrl(key, contentType, expiresIn = 3600) {
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                ContentType: contentType,
            });
            const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, {
                expiresIn
            });
            return {
                success: true,
                uploadUrl: signedUrl,
                key,
                expiresIn,
            };
        }
        catch (error) {
            console.error('Error generating upload URL:', error);
            throw new Error('Failed to generate upload URL');
        }
    }
    /**
     * Delete an object from S3
     */
    async deleteObject(key) {
        try {
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            await this.s3Client.send(command);
            return {
                success: true,
                message: `Object ${key} deleted successfully`,
            };
        }
        catch (error) {
            console.error('Error deleting S3 object:', error);
            throw new Error('Failed to delete object from S3');
        }
    }
    /**
     * Check if bucket is accessible
     */
    async checkBucketAccess() {
        try {
            const command = new client_s3_1.ListObjectsV2Command({
                Bucket: this.bucketName,
                MaxKeys: 1,
            });
            await this.s3Client.send(command);
            return {
                success: true,
                message: 'S3 bucket is accessible',
                bucket: this.bucketName,
            };
        }
        catch (error) {
            console.error('Error accessing S3 bucket:', error);
            throw new Error('Failed to access S3 bucket');
        }
    }
}
exports.S3Service = S3Service;
exports.s3Service = new S3Service();
