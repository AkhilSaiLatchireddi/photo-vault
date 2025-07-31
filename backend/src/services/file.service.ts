// import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// import sharp from 'sharp';
// import { PrismaClient } from '@prisma/client';
// import { v4 as uuidv4 } from 'uuid';
// import path from 'path';

// const prisma = new PrismaClient();

// const s3Client = new S3Client({
//   region: process.env.AWS_REGION || 'us-east-1',
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// });

// export interface UploadedFile {
//   id: string;
//   filename: string;
//   originalFilename: string;
//   fileType: 'image' | 'video';
//   fileSize: number;
//   mimeType: string;
//   s3Key: string;
//   s3Bucket: string;
//   width?: number;
//   height?: number;
//   duration?: number;
//   thumbnails?: {
//     small: string;
//     medium: string;
//     large: string;
//   };
//   metadata?: any;
//   uploadedAt: Date;
// }

// export interface FileMetadata {
//   width?: number;
//   height?: number;
//   format?: string;
//   exif?: any;
//   location?: {
//     latitude: number;
//     longitude: number;
//   };
//   takenAt?: Date;
// }

// export class FileService {
//   private readonly bucketName = process.env.AWS_S3_BUCKET!;
//   private readonly cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;

//   /**
//    * Generate presigned URL for file upload
//    */
//   async generatePresignedUploadUrl(
//     userId: string,
//     filename: string,
//     mimeType: string,
//     fileSize: number
//   ): Promise<{
//     uploadUrl: string;
//     fileKey: string;
//     fileId: string;
//   }> {
//     try {
//       const fileId = uuidv4();
//       const fileExtension = path.extname(filename);
//       const cleanFilename = path.basename(filename, fileExtension);
//       const timestamp = Date.now();
//       const year = new Date().getFullYear();
//       const month = String(new Date().getMonth() + 1).padStart(2, '0');

//       // Create S3 key with organized structure
//       const s3Key = `users/${userId}/originals/${year}/${month}/${fileId}${fileExtension}`;

//       const command = new PutObjectCommand({
//         Bucket: this.bucketName,
//         Key: s3Key,
//         ContentType: mimeType,
//         ContentLength: fileSize,
//         Metadata: {
//           userId,
//           originalFilename: filename,
//           uploadedAt: new Date().toISOString(),
//         },
//       });

//       const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

//       return {
//         uploadUrl,
//         fileKey: s3Key,
//         fileId,
//       };
//     } catch (error) {
//       console.error('Error generating presigned URL:', error);
//       throw new Error('Failed to generate upload URL');
//     }
//   }

//   /**
//    * Process uploaded file
//    */
//   async processUploadedFile(
//     userId: string,
//     fileId: string,
//     s3Key: string,
//     originalFilename: string,
//     mimeType: string,
//     fileSize: number
//   ): Promise<UploadedFile> {
//     try {
//       // Download file from S3 for processing
//       const getCommand = new GetObjectCommand({
//         Bucket: this.bucketName,
//         Key: s3Key,
//       });

//       const response = await s3Client.send(getCommand);
//       const fileBuffer = await this.streamToBuffer(response.Body as NodeJS.ReadableStream);

//       // Extract metadata
//       const metadata = await this.extractMetadata(fileBuffer, mimeType);
//       const fileType = mimeType.startsWith('image/') ? 'image' : 'video';

//       // Generate thumbnails for images
//       let thumbnails;
//       if (fileType === 'image') {
//         thumbnails = await this.generateThumbnails(userId, fileId, fileBuffer);
//       }

//       // Save file record to database
//       const file = await prisma.file.create({
//         data: {
//           id: fileId,
//           userId,
//           filename: `${fileId}${path.extname(originalFilename)}`,
//           originalFilename,
//           fileType,
//           fileSize,
//           mimeType,
//           s3Key,
//           s3Bucket: this.bucketName,
//           width: metadata.width,
//           height: metadata.height,
//           duration: metadata.duration,
//           latitude: metadata.location?.latitude,
//           longitude: metadata.location?.longitude,
//           takenAt: metadata.takenAt,
//           status: 'READY',
//           metadata: metadata.exif || {},
//           thumbnails: thumbnails || {},
//         },
//       });

//       // Update user storage usage
//       await prisma.user.update({
//         where: { id: userId },
//         data: {
//           storageUsed: {
//             increment: fileSize,
//           },
//         },
//       });

//       return {
//         id: file.id,
//         filename: file.filename,
//         originalFilename: file.originalFilename,
//         fileType: file.fileType as 'image' | 'video',
//         fileSize: Number(file.fileSize),
//         mimeType: file.mimeType,
//         s3Key: file.s3Key,
//         s3Bucket: file.s3Bucket,
//         width: file.width || undefined,
//         height: file.height || undefined,
//         duration: file.duration || undefined,
//         thumbnails: file.thumbnails as any,
//         metadata: file.metadata as any,
//         uploadedAt: file.uploadedAt,
//       };
//     } catch (error) {
//       console.error('Error processing uploaded file:', error);
      
//       // Update file status to error
//       await prisma.file.update({
//         where: { id: fileId },
//         data: { status: 'ERROR' },
//       }).catch(() => {}); // Ignore errors in error handling

//       throw new Error('Failed to process uploaded file');
//     }
//   }

//   /**
//    * Generate file access URL
//    */
//   async generateFileUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
//     try {
//       if (this.cloudFrontDomain) {
//         // Use CloudFront for public access
//         return `https://${this.cloudFrontDomain}/${s3Key}`;
//       }

//       // Generate presigned URL for S3 access
//       const command = new GetObjectCommand({
//         Bucket: this.bucketName,
//         Key: s3Key,
//       });

//       return await getSignedUrl(s3Client, command, { expiresIn });
//     } catch (error) {
//       console.error('Error generating file URL:', error);
//       throw new Error('Failed to generate file URL');
//     }
//   }

//   /**
//    * Delete file
//    */
//   async deleteFile(userId: string, fileId: string): Promise<void> {
//     try {
//       const file = await prisma.file.findFirst({
//         where: { id: fileId, userId },
//       });

//       if (!file) {
//         throw new Error('File not found');
//       }

//       // Delete from S3
//       const deleteCommand = new DeleteObjectCommand({
//         Bucket: this.bucketName,
//         Key: file.s3Key,
//       });

//       await s3Client.send(deleteCommand);

//       // Delete thumbnails from S3
//       if (file.thumbnails && typeof file.thumbnails === 'object') {
//         const thumbnails = file.thumbnails as any;
//         for (const size of ['small', 'medium', 'large']) {
//           if (thumbnails[size]) {
//             const thumbnailKey = `users/${userId}/thumbnails/${fileId}/${size}.webp`;
//             const deleteThumbnailCommand = new DeleteObjectCommand({
//               Bucket: this.bucketName,
//               Key: thumbnailKey,
//             });
//             await s3Client.send(deleteThumbnailCommand).catch(() => {}); // Ignore errors
//           }
//         }
//       }

//       // Update user storage usage
//       await prisma.user.update({
//         where: { id: userId },
//         data: {
//           storageUsed: {
//             decrement: file.fileSize,
//           },
//         },
//       });

//       // Mark file as deleted in database
//       await prisma.file.update({
//         where: { id: fileId },
//         data: { status: 'DELETED' },
//       });
//     } catch (error) {
//       console.error('Error deleting file:', error);
//       throw new Error('Failed to delete file');
//     }
//   }

//   /**
//    * Extract metadata from file buffer
//    */
//   private async extractMetadata(buffer: Buffer, mimeType: string): Promise<FileMetadata> {
//     const metadata: FileMetadata = {};

//     try {
//       if (mimeType.startsWith('image/')) {
//         // Use sharp for image metadata
//         const image = sharp(buffer);
//         const imageMetadata = await image.metadata();

//         metadata.width = imageMetadata.width;
//         metadata.height = imageMetadata.height;
//         metadata.format = imageMetadata.format;

//         // Extract EXIF data
//         if (imageMetadata.exif) {
//           metadata.exif = imageMetadata.exif;
          
//           // Try to extract GPS coordinates and date taken
//           // This would need a proper EXIF parser like 'exifr'
//           // For now, we'll add placeholder logic
//         }
//       } else if (mimeType.startsWith('video/')) {
//         // For video metadata, you'd use ffprobe or similar
//         // Placeholder for video metadata extraction
//         metadata.width = 1920; // placeholder
//         metadata.height = 1080; // placeholder
//         metadata.duration = 120; // placeholder in seconds
//       }
//     } catch (error) {
//       console.error('Error extracting metadata:', error);
//     }

//     return metadata;
//   }

//   /**
//    * Generate thumbnails for images
//    */
//   private async generateThumbnails(
//     userId: string,
//     fileId: string,
//     buffer: Buffer
//   ): Promise<{ small: string; medium: string; large: string }> {
//     const sizes = {
//       small: 150,
//       medium: 500,
//       large: 1200,
//     };

//     const thumbnails: any = {};

//     try {
//       for (const [size, dimension] of Object.entries(sizes)) {
//         // Generate thumbnail
//         const thumbnailBuffer = await sharp(buffer)
//           .resize(dimension, dimension, {
//             fit: 'inside',
//             withoutEnlargement: true,
//           })
//           .webp({ quality: 80 })
//           .toBuffer();

//         // Upload thumbnail to S3
//         const thumbnailKey = `users/${userId}/thumbnails/${fileId}/${size}.webp`;
//         const uploadCommand = new PutObjectCommand({
//           Bucket: this.bucketName,
//           Key: thumbnailKey,
//           Body: thumbnailBuffer,
//           ContentType: 'image/webp',
//         });

//         await s3Client.send(uploadCommand);
//         thumbnails[size] = thumbnailKey;
//       }

//       return thumbnails;
//     } catch (error) {
//       console.error('Error generating thumbnails:', error);
//       return { small: '', medium: '', large: '' };
//     }
//   }

//   /**
//    * Convert stream to buffer
//    */
//   private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
//     return new Promise((resolve, reject) => {
//       const chunks: any[] = [];
//       stream.on('data', (chunk) => chunks.push(chunk));
//       stream.on('error', reject);
//       stream.on('end', () => resolve(Buffer.concat(chunks)));
//     });
//   }
// }

// export const fileService = new FileService();
