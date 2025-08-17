"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongodb_1 = require("mongodb");
const s3_service_1 = require("../services/s3.service");
const database_service_1 = require("../services/database.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ensureUser_middleware_1 = require("../middleware/ensureUser.middleware");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
router.use(auth_middleware_1.checkJwt);
router.use(ensureUser_middleware_1.ensureUserMiddleware);
function formatFileSize(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const username = req.user.username;
        const { year, month, limit = '50', offset = '0' } = req.query;
        let photos;
        if (year) {
            const yearNum = parseInt(year);
            const monthNum = month ? parseInt(month) : undefined;
            photos = await database_service_1.databaseService.getPhotosByYearMonth(userId, yearNum, monthNum);
        }
        else {
            const limitNum = parseInt(limit);
            const offsetNum = parseInt(offset);
            photos = await database_service_1.databaseService.getUserPhotos(userId, limitNum, offsetNum);
        }
        const photoKeys = photos.map(photo => photo.s3_key);
        try {
            const batchUrlResult = await s3_service_1.s3Service.getBatchObjectUrls(photoKeys, 7200);
            const photosWithUrls = photos.map((photo) => {
                const urlData = batchUrlResult.urls.find(u => u.key === photo.s3_key);
                return {
                    ...photo,
                    id: photo._id.toString(),
                    downloadUrl: urlData?.url || null,
                    metadata: photo.metadata || null,
                };
            });
            res.json({
                success: true,
                data: {
                    photos: photosWithUrls,
                    count: photos.length,
                    user: username,
                    userId: userId,
                    urlsExpireAt: new Date(Date.now() + 7200 * 1000).toISOString(),
                },
            });
        }
        catch (urlError) {
            console.error('Error generating batch URLs, falling back to individual:', urlError);
            const photosWithUrls = await Promise.all(photos.map(async (photo) => {
                try {
                    const urlResult = await s3_service_1.s3Service.getObjectUrl(photo.s3_key, 3600);
                    return {
                        ...photo,
                        id: photo._id.toString(),
                        downloadUrl: urlResult.url,
                        metadata: photo.metadata || null,
                    };
                }
                catch (error) {
                    console.error(`Error getting URL for photo ${photo._id}:`, error);
                    return {
                        ...photo,
                        id: photo._id.toString(),
                        downloadUrl: null,
                        metadata: photo.metadata || null,
                    };
                }
            }));
            res.json({
                success: true,
                data: {
                    photos: photosWithUrls,
                    count: photos.length,
                    user: username,
                    userId: userId,
                },
            });
        }
    }
    catch (error) {
        console.error('Error listing photos:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list photos',
        });
    }
});
router.post('/refresh-urls', async (req, res) => {
    try {
        const { photoIds } = req.body;
        const userId = req.user.id;
        if (!Array.isArray(photoIds) || photoIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'photoIds array is required',
            });
        }
        const photos = await Promise.all(photoIds.map(async (id) => {
            if (!mongodb_1.ObjectId.isValid(id))
                return null;
            return await database_service_1.databaseService.getPhotoById(id, userId);
        }));
        const validPhotos = photos.filter(photo => photo !== null);
        if (validPhotos.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No valid photos found',
            });
        }
        const photoKeys = validPhotos.map(photo => photo.s3_key);
        const { urls } = await s3_service_1.s3Service.getBatchObjectUrls(photoKeys, 7200);
        const refreshedUrls = validPhotos.map(photo => {
            const urlData = urls.find(u => u.key === photo.s3_key);
            return {
                id: photo._id.toString(),
                downloadUrl: urlData?.url || null,
            };
        });
        res.json({
            success: true,
            data: {
                urls: refreshedUrls,
                urlsExpireAt: new Date(Date.now() + 7200 * 1000).toISOString(),
            },
        });
    }
    catch (error) {
        console.error('Error refreshing URLs:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to refresh URLs',
        });
    }
});
router.get('/:id/download', async (req, res) => {
    try {
        const photoId = req.params.id;
        const userId = req.user.id;
        if (!mongodb_1.ObjectId.isValid(photoId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid photo ID',
            });
        }
        const photo = await database_service_1.databaseService.getPhotoById(photoId, userId);
        if (!photo) {
            return res.status(404).json({
                success: false,
                error: 'Photo not found or you do not have permission to access it',
            });
        }
        const result = await s3_service_1.s3Service.getObjectUrl(photo.s3_key);
        res.json({
            success: true,
            data: {
                ...result,
                photo: {
                    id: photo._id.toString(),
                    filename: photo.original_name,
                    uploadedAt: photo.uploaded_at,
                },
            },
        });
    }
    catch (error) {
        console.error('Error getting download URL:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate download URL',
        });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;
        const stats = await database_service_1.databaseService.getPhotoStats(userId);
        res.json({
            success: true,
            data: {
                totalPhotos: stats.total_photos || 0,
                totalSize: stats.total_size || 0,
                totalSizeFormatted: formatFileSize(stats.total_size || 0),
                firstUpload: stats.first_upload,
                lastUpload: stats.last_upload,
                user: req.user.username,
            },
        });
    }
    catch (error) {
        console.error('Error getting photo stats:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get photo statistics',
        });
    }
});
router.post('/upload-url', async (req, res) => {
    try {
        const { fileName, contentType, fileSize, metadata } = req.body;
        const userId = req.user.id;
        const username = req.user.username;
        if (!fileName || !contentType) {
            return res.status(400).json({
                success: false,
                error: 'fileName and contentType are required',
            });
        }
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const fileExtension = fileName.split('.').pop();
        const uniqueFilename = `${(0, uuid_1.v4)()}.${fileExtension}`;
        const s3Key = `users/${username}/photos/${year}/${month}/${day}/${uniqueFilename}`;
        const uploadResult = await s3_service_1.s3Service.getUploadUrl(s3Key, contentType);
        const photoData = {
            user_id: new mongodb_1.ObjectId(userId),
            filename: uniqueFilename,
            s3_key: s3Key,
            original_name: fileName,
            mime_type: contentType,
            file_size: fileSize || 0,
            width: metadata?.width,
            height: metadata?.height,
            taken_at: metadata?.takenAt ? new Date(metadata.takenAt) : undefined,
            metadata: metadata || undefined,
        };
        const photo = await database_service_1.databaseService.createPhoto(photoData);
        res.json({
            success: true,
            data: {
                ...uploadResult,
                photo: {
                    id: photo._id.toString(),
                    filename: photo.filename,
                    s3_key: photo.s3_key,
                    uploadPath: `users/${username}/photos/${year}/${month}/${day}/`,
                },
            },
        });
    }
    catch (error) {
        console.error('Error generating upload URL:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate upload URL',
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const photoId = req.params.id;
        const userId = req.user.id;
        if (!mongodb_1.ObjectId.isValid(photoId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid photo ID',
            });
        }
        const photo = await database_service_1.databaseService.getPhotoById(photoId, userId);
        if (!photo) {
            return res.status(404).json({
                success: false,
                error: 'Photo not found or you do not have permission to delete it',
            });
        }
        try {
            await s3_service_1.s3Service.deleteObject(photo.s3_key);
        }
        catch (s3Error) {
            console.error('Error deleting from S3:', s3Error);
        }
        const deleted = await database_service_1.databaseService.deletePhoto(photoId, userId);
        if (deleted) {
            res.json({
                success: true,
                message: `Photo "${photo.original_name}" deleted successfully`,
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to delete photo from database',
            });
        }
    }
    catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete photo',
        });
    }
});
router.get('/health', async (req, res) => {
    try {
        const result = await s3_service_1.s3Service.checkBucketAccess();
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Error checking S3 health:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'S3 bucket not accessible',
        });
    }
});
exports.default = router;
