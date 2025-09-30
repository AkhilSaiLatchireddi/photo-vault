import { s3Service } from '../s3.service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn()
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn()
}));

describe('S3Service', () => {
  let mockS3Send: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get reference to the mocked S3 client's send method
    const { S3Client } = require('@aws-sdk/client-s3');
    const mockClient = new S3Client();
    mockS3Send = mockClient.send as jest.Mock;
  });

  describe('listObjects', () => {
    it('should list objects successfully', async () => {
      const mockResponse = {
        Contents: [
          {
            Key: 'user123/photo1.jpg',
            Size: 1024,
            LastModified: new Date('2024-01-01T00:00:00Z'),
            ETag: '"etag1"'
          },
          {
            Key: 'user123/photo2.jpg',
            Size: 2048,
            LastModified: new Date('2024-01-02T00:00:00Z'),
            ETag: '"etag2"'
          }
        ],
        KeyCount: 2
      };

      mockS3Send.mockResolvedValue(mockResponse);

      const result = await s3Service.listObjects('user123/');

      expect(result).toEqual({
        success: true,
        objects: [
          {
            key: 'user123/photo1.jpg',
            size: 1024,
            lastModified: new Date('2024-01-01T00:00:00Z'),
            etag: '"etag1"'
          },
          {
            key: 'user123/photo2.jpg',
            size: 2048,
            lastModified: new Date('2024-01-02T00:00:00Z'),
            etag: '"etag2"'
          }
        ],
        count: 2
      });

      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      expect(ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        Prefix: 'user123/',
        MaxKeys: 100
      });
    });

    it('should handle empty object list', async () => {
      mockS3Send.mockResolvedValue({
        Contents: [],
        KeyCount: 0
      });

      const result = await s3Service.listObjects();

      expect(result).toEqual({
        success: true,
        objects: [],
        count: 0
      });
    });

    it('should handle list objects errors', async () => {
      mockS3Send.mockRejectedValue(new Error('Access denied'));

      await expect(s3Service.listObjects()).rejects.toThrow('Failed to list objects from S3');
    });
  });

  describe('getObjectUrl', () => {
    it('should generate signed URL successfully', async () => {
      const mockSignedUrl = 'https://bucket.s3.amazonaws.com/test-file.jpg?signed=true';
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      
      getSignedUrl.mockResolvedValue(mockSignedUrl);

      const result = await s3Service.getObjectUrl('user123/test-file.jpg', 3600);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), // S3 client
        expect.any(Object), // GetObjectCommand
        { expiresIn: 3600 }
      );
      expect(result).toEqual({
        success: true,
        url: mockSignedUrl,
        expiresIn: 3600
      });
    });

    it('should handle signed URL generation errors', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockRejectedValue(new Error('URL generation failed'));

      await expect(s3Service.getObjectUrl('user123/test-file.jpg'))
        .rejects.toThrow('Failed to generate download URL');
    });

    it('should use default expiration time', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockResolvedValue('mock-url');

      await s3Service.getObjectUrl('user123/test-file.jpg');

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 3600 } // Default 1 hour
      );
    });
  });

  describe('getBatchObjectUrls', () => {
    it('should generate multiple signed URLs successfully', async () => {
      const keys = ['user123/photo1.jpg', 'user123/photo2.jpg'];
      const mockUrls = [
        'https://bucket.s3.amazonaws.com/photo1.jpg?signed=true',
        'https://bucket.s3.amazonaws.com/photo2.jpg?signed=true'
      ];
      
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl
        .mockResolvedValueOnce(mockUrls[0])
        .mockResolvedValueOnce(mockUrls[1]);

      const result = await s3Service.getBatchObjectUrls(keys, 7200);

      expect(result).toEqual({
        success: true,
        urls: [
          { key: 'user123/photo1.jpg', url: mockUrls[0] },
          { key: 'user123/photo2.jpg', url: mockUrls[1] }
        ],
        expiresIn: 7200,
        count: 2
      });

      expect(getSignedUrl).toHaveBeenCalledTimes(2);
    });

    it('should handle batch URL generation errors', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockRejectedValue(new Error('Batch URL generation failed'));

      await expect(s3Service.getBatchObjectUrls(['key1', 'key2']))
        .rejects.toThrow('Failed to generate batch download URLs');
    });
  });

  describe('getPublicUrl', () => {
    it('should generate public URL correctly', () => {
      const result = s3Service.getPublicUrl('user123/test-file.jpg');

      expect(result).toBe(
        `https://photovault-bucket.s3.us-east-1.amazonaws.com/user123/test-file.jpg`
      );
    });

    it('should handle different regions', () => {
      const originalRegion = process.env.AWS_REGION;
      process.env.AWS_REGION = 'eu-west-1';

      // Create new instance to pick up environment change
      const { S3Service } = require('../s3.service');
      const testService = new S3Service();
      
      const result = testService.getPublicUrl('test-file.jpg');

      expect(result).toBe(
        `https://photovault-bucket.s3.eu-west-1.amazonaws.com/test-file.jpg`
      );

      // Restore original region
      process.env.AWS_REGION = originalRegion;
    });
  });

  describe('getUploadUrl', () => {
    it('should generate upload URL successfully', async () => {
      const mockUploadUrl = 'https://bucket.s3.amazonaws.com/test-file.jpg?upload=true';
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      
      getSignedUrl.mockResolvedValue(mockUploadUrl);

      const result = await s3Service.getUploadUrl('user123/test-file.jpg', 'image/jpeg', 1800);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), // S3 client
        expect.any(Object), // PutObjectCommand
        { expiresIn: 1800 }
      );
      
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        Key: 'user123/test-file.jpg',
        ContentType: 'image/jpeg'
      });

      expect(result).toEqual({
        success: true,
        uploadUrl: mockUploadUrl,
        key: 'user123/test-file.jpg',
        expiresIn: 1800
      });
    });

    it('should handle upload URL generation errors', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockRejectedValue(new Error('Upload URL generation failed'));

      await expect(s3Service.getUploadUrl('test-file.jpg', 'image/jpeg'))
        .rejects.toThrow('Failed to generate upload URL');
    });
  });

  describe('deleteObject', () => {
    it('should delete object successfully', async () => {
      mockS3Send.mockResolvedValue({});

      const result = await s3Service.deleteObject('user123/test-file.jpg');

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: true,
        message: 'Object user123/test-file.jpg deleted successfully'
      });

      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        Key: 'user123/test-file.jpg'
      });
    });

    it('should handle delete errors', async () => {
      mockS3Send.mockRejectedValue(new Error('Delete failed'));

      await expect(s3Service.deleteObject('user123/test-file.jpg'))
        .rejects.toThrow('Failed to delete object from S3');
    });
  });

  describe('checkBucketAccess', () => {
    it('should verify bucket access successfully', async () => {
      mockS3Send.mockResolvedValue({
        Contents: []
      });

      const result = await s3Service.checkBucketAccess();

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: true,
        message: 'S3 bucket is accessible',
        bucket: expect.any(String)
      });

      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      expect(ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        MaxKeys: 1
      });
    });

    it('should handle bucket access errors', async () => {
      mockS3Send.mockRejectedValue(new Error('Access denied'));

      await expect(s3Service.checkBucketAccess())
        .rejects.toThrow('Failed to access S3 bucket');
    });
  });
});
