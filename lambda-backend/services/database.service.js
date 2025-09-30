"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseService = void 0;
const mongodb_1 = require("mongodb");
class DatabaseService {
    constructor() {
        this.client = null;
        this.db = null;
        // Use MONGODB_URI environment variable for Lambda deployment
        // This will be populated from AWS SSM Parameter Store
        this.uri = process.env.MONGODB_URI || '';
        if (!this.uri) {
            console.error('⚠️  MONGODB_URI environment variable is not set');
            // Fallback to old format for local development
            const username = process.env.MONGODB_USERNAME || '<db_username>';
            const password = process.env.MONGODB_PASSWORD || '<db_password>';
            this.uri = `mongodb+srv://${username}:${password}@photovault.czk6x9q.mongodb.net/?retryWrites=true&w=majority&appName=photovault&tls=true&tlsAllowInvalidCertificates=false`;
        }
        console.log('🔗 MongoDB URI configured:', this.uri.replace(/\/\/.*@/, '//***@')); // Hide credentials in logs
    }
    async initialize() {
        if (this.db)
            return this.db;
        try {
            this.client = new mongodb_1.MongoClient(this.uri, {
                serverApi: {
                    version: mongodb_1.ServerApiVersion.v1,
                    strict: true,
                    deprecationErrors: true,
                },
                connectTimeoutMS: 30000,
                serverSelectionTimeoutMS: 30000,
                tls: true,
            });
            await this.client.connect();
            this.db = this.client.db('photovault');
            await this.createIndexes();
            return this.db;
        }
        catch (error) {
            console.error('❌ MongoDB connection failed:', error instanceof Error ? error.message : error);
            // Return a mock database object to prevent crashes
            return null;
        }
    }
    async createIndexes() {
        if (!this.db)
            throw new Error('Database not initialized');
        const usersCollection = this.db.collection('users');
        const photosCollection = this.db.collection('photos');
        const albumsCollection = this.db.collection('albums');
        const albumSharesCollection = this.db.collection('album_shares');
        // Create indexes for users collection
        await usersCollection.createIndex({ email: 1 }, { unique: true });
        await usersCollection.createIndex({ username: 1 }, { unique: true });
        await usersCollection.createIndex({ auth0Id: 1 }, { unique: true, sparse: true }); // Auth0 ID index
        // Create indexes for photos collection
        await photosCollection.createIndex({ user_id: 1 });
        await photosCollection.createIndex({ uploaded_at: -1 });
        await photosCollection.createIndex({ taken_at: -1 });
        await photosCollection.createIndex({ s3_key: 1 }, { unique: true });
        // Create indexes for albums collection
        await albumsCollection.createIndex({ user_id: 1 });
        await albumsCollection.createIndex({ created_at: -1 });
        await albumsCollection.createIndex({ public_token: 1 }, { unique: true, sparse: true });
        await albumsCollection.createIndex({ is_public: 1 });
        await albumsCollection.createIndex({ 'shared_with.user_id': 1 });
        await albumsCollection.createIndex({ 'shared_with.email': 1 });
        // Create indexes for album shares collection
        await albumSharesCollection.createIndex({ album_id: 1 });
        await albumSharesCollection.createIndex({ shared_with_user_id: 1 });
        await albumSharesCollection.createIndex({ shared_with_email: 1 });
        await albumSharesCollection.createIndex({ expires_at: 1 }, { sparse: true });
    }
    async getDatabase() {
        if (!this.db) {
            await this.initialize();
        }
        return this.db;
    }
    getUsersCollection() {
        if (!this.db)
            throw new Error('Database not initialized');
        return this.db.collection('users');
    }
    getPhotosCollection() {
        if (!this.db)
            throw new Error('Database not initialized');
        return this.db.collection('photos');
    }
    getAlbumsCollection() {
        if (!this.db)
            throw new Error('Database not initialized');
        return this.db.collection('albums');
    }
    getAlbumSharesCollection() {
        if (!this.db)
            throw new Error('Database not initialized');
        return this.db.collection('album_shares');
    }
    // User methods
    async createUser(username, email, hashedPassword) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        const now = new Date();
        const userData = {
            username,
            email,
            password: hashedPassword,
            created_at: now,
            updated_at: now
        };
        const result = await usersCollection.insertOne(userData);
        const user = await usersCollection.findOne({ _id: result.insertedId });
        if (!user)
            throw new Error('Failed to create user');
        return user;
    }
    async getUserByEmail(email) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        return await usersCollection.findOne({ email });
    }
    async getUserByUsername(username) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        return await usersCollection.findOne({ username });
    }
    async getUserById(id) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        const objectId = typeof id === 'string' ? new mongodb_1.ObjectId(id) : id;
        return await usersCollection.findOne({ _id: objectId });
    }
    async getUserByAuth0Id(auth0Id) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        return await usersCollection.findOne({ auth0Id });
    }
    async createAuth0User(userData) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        // Check if username already exists and make it unique if needed
        let uniqueUsername = userData.username;
        let counter = 1;
        while (await usersCollection.findOne({ username: uniqueUsername })) {
            uniqueUsername = `${userData.username}_${counter}`;
            counter++;
        }
        const now = new Date();
        const user = {
            ...userData,
            username: uniqueUsername,
            created_at: now,
            updated_at: now
        };
        try {
            const result = await usersCollection.insertOne(user);
            const createdUser = await usersCollection.findOne({ _id: result.insertedId });
            if (!createdUser)
                throw new Error('Failed to create Auth0 user');
            return createdUser;
        }
        catch (error) {
            // Handle duplicate auth0Id error specifically
            if (error.code === 11000 && error.keyPattern?.auth0Id) {
                // User already exists, try to find and return them
                const existingUser = await usersCollection.findOne({ auth0Id: userData.auth0Id });
                if (existingUser) {
                    return existingUser;
                }
            }
            throw error;
        }
    }
    async updateAuth0User(userId, updateData) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        const objectId = new mongodb_1.ObjectId(userId);
        const result = await usersCollection.findOneAndUpdate({ _id: objectId }, {
            $set: {
                ...updateData,
                updated_at: new Date()
            }
        }, { returnDocument: 'after' });
        if (!result)
            throw new Error('Failed to update Auth0 user');
        return result;
    }
    async updateUserProfile(userId, profileData) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        const objectId = new mongodb_1.ObjectId(userId);
        const result = await usersCollection.findOneAndUpdate({ _id: objectId }, {
            $set: {
                profile: profileData,
                updated_at: new Date()
            }
        }, { returnDocument: 'after' });
        if (!result)
            throw new Error('Failed to update user profile');
        return result;
    }
    async updateUserProfileField(userId, fieldPath, value) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        const objectId = new mongodb_1.ObjectId(userId);
        const updateQuery = {
            updated_at: new Date()
        };
        updateQuery[`profile.${fieldPath}`] = value;
        const result = await usersCollection.findOneAndUpdate({ _id: objectId }, { $set: updateQuery }, { returnDocument: 'after' });
        if (!result)
            throw new Error('Failed to update user profile field');
        return result;
    }
    async getUserProfile(userId) {
        await this.getDatabase();
        const usersCollection = this.getUsersCollection();
        const objectId = new mongodb_1.ObjectId(userId);
        return await usersCollection.findOne({ _id: objectId }, { projection: { password: 0 } } // Exclude password from response
        );
    }
    // Photo methods
    async createPhoto(photoData) {
        await this.getDatabase();
        const photosCollection = this.getPhotosCollection();
        const photoDocument = {
            ...photoData,
            uploaded_at: new Date()
        };
        const result = await photosCollection.insertOne(photoDocument);
        const photo = await photosCollection.findOne({ _id: result.insertedId });
        if (!photo)
            throw new Error('Failed to create photo');
        return photo;
    }
    async getUserPhotos(userId, limit = 50, offset = 0) {
        await this.getDatabase();
        const photosCollection = this.getPhotosCollection();
        const objectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        return await photosCollection
            .find({ user_id: objectId })
            .sort({ uploaded_at: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();
    }
    async getPhotosByDateRange(userId, startDate, endDate) {
        await this.getDatabase();
        const photosCollection = this.getPhotosCollection();
        const objectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        return await photosCollection
            .find({
            user_id: objectId,
            uploaded_at: {
                $gte: startDate,
                $lte: endDate
            }
        })
            .sort({ uploaded_at: -1 })
            .toArray();
    }
    async getPhotosByYearMonth(userId, year, month) {
        await this.getDatabase();
        const photosCollection = this.getPhotosCollection();
        const objectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        let startDate;
        let endDate;
        if (month !== undefined) {
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59, 999);
        }
        else {
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        }
        return await photosCollection
            .find({
            user_id: objectId,
            uploaded_at: {
                $gte: startDate,
                $lte: endDate
            }
        })
            .sort({ uploaded_at: -1 })
            .toArray();
    }
    async getPhotoById(id, userId) {
        await this.getDatabase();
        const photosCollection = this.getPhotosCollection();
        const photoObjectId = typeof id === 'string' ? new mongodb_1.ObjectId(id) : id;
        const userObjectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        return await photosCollection.findOne({
            _id: photoObjectId,
            user_id: userObjectId
        });
    }
    async deletePhoto(id, userId) {
        await this.getDatabase();
        const photosCollection = this.getPhotosCollection();
        const photoObjectId = typeof id === 'string' ? new mongodb_1.ObjectId(id) : id;
        const userObjectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        const result = await photosCollection.deleteOne({
            _id: photoObjectId,
            user_id: userObjectId
        });
        return result.deletedCount > 0;
    }
    async getPhotoStats(userId) {
        await this.getDatabase();
        const photosCollection = this.getPhotosCollection();
        const objectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        const stats = await photosCollection.aggregate([
            { $match: { user_id: objectId } },
            {
                $group: {
                    _id: null,
                    total_photos: { $sum: 1 },
                    total_size: { $sum: '$file_size' },
                    first_upload: { $min: '$uploaded_at' },
                    last_upload: { $max: '$uploaded_at' }
                }
            }
        ]).toArray();
        return stats.length > 0 ? stats[0] : {
            total_photos: 0,
            total_size: 0,
            first_upload: null,
            last_upload: null
        };
    }
    // Album methods
    async createAlbum(albumData) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const now = new Date();
        const albumDocument = {
            ...albumData,
            photo_ids: [],
            shared_with: [],
            created_at: now,
            updated_at: now
        };
        const result = await albumsCollection.insertOne(albumDocument);
        const album = await albumsCollection.findOne({ _id: result.insertedId });
        if (!album)
            throw new Error('Failed to create album');
        return album;
    }
    async getUserAlbums(userId) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const objectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        return await albumsCollection
            .find({ user_id: objectId })
            .sort({ created_at: -1 })
            .toArray();
    }
    async getSharedAlbums(userId, email) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const objectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        const query = {
            $or: [
                { 'shared_with.user_id': objectId }
            ]
        };
        if (email) {
            query.$or.push({ 'shared_with.email': email });
        }
        return await albumsCollection.find(query).sort({ created_at: -1 }).toArray();
    }
    async getAlbumById(albumId, userId) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const albumObjectId = typeof albumId === 'string' ? new mongodb_1.ObjectId(albumId) : albumId;
        const query = { _id: albumObjectId };
        // If userId provided, ensure user has access (owner or shared with)
        if (userId) {
            const userObjectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
            query.$or = [
                { user_id: userObjectId }, // Owner
                { 'shared_with.user_id': userObjectId }, // Shared with user
                { is_public: true } // Public album
            ];
        }
        return await albumsCollection.findOne(query);
    }
    async getAlbumByToken(publicToken) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        return await albumsCollection.findOne({
            public_token: publicToken,
            is_public: true,
            $or: [
                { public_expires_at: { $exists: false } },
                { public_expires_at: { $eq: undefined } },
                { public_expires_at: { $gt: new Date() } }
            ]
        });
    }
    async updateAlbum(albumId, userId, updateData) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const albumObjectId = typeof albumId === 'string' ? new mongodb_1.ObjectId(albumId) : albumId;
        const userObjectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        const result = await albumsCollection.findOneAndUpdate({ _id: albumObjectId, user_id: userObjectId }, // Only owner can update
        {
            $set: {
                ...updateData,
                updated_at: new Date()
            }
        }, { returnDocument: 'after' });
        return result;
    }
    async deleteAlbum(albumId, userId) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const albumObjectId = typeof albumId === 'string' ? new mongodb_1.ObjectId(albumId) : albumId;
        const userObjectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        const result = await albumsCollection.deleteOne({
            _id: albumObjectId,
            user_id: userObjectId
        });
        return result.deletedCount > 0;
    }
    async addPhotoToAlbum(albumId, photoId, userId) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const albumObjectId = typeof albumId === 'string' ? new mongodb_1.ObjectId(albumId) : albumId;
        const photoObjectId = typeof photoId === 'string' ? new mongodb_1.ObjectId(photoId) : photoId;
        const userObjectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        // Verify user owns the album
        const album = await albumsCollection.findOne({ _id: albumObjectId, user_id: userObjectId });
        if (!album)
            return false;
        // Verify photo exists and user owns it
        const photo = await this.getPhotoById(photoObjectId, userObjectId);
        if (!photo)
            return false;
        // Add photo to album if not already present
        const result = await albumsCollection.updateOne({ _id: albumObjectId, photo_ids: { $ne: photoObjectId } }, {
            $push: { photo_ids: photoObjectId },
            $set: { updated_at: new Date() }
        });
        return result.modifiedCount > 0;
    }
    async removePhotoFromAlbum(albumId, photoId, userId) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const albumObjectId = typeof albumId === 'string' ? new mongodb_1.ObjectId(albumId) : albumId;
        const photoObjectId = typeof photoId === 'string' ? new mongodb_1.ObjectId(photoId) : photoId;
        const userObjectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        const result = await albumsCollection.updateOne({ _id: albumObjectId, user_id: userObjectId }, {
            $pull: { photo_ids: photoObjectId },
            $set: { updated_at: new Date() }
        });
        return result.modifiedCount > 0;
    }
    async getAlbumPhotos(albumId, userId) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const photosCollection = this.getPhotosCollection();
        const albumObjectId = typeof albumId === 'string' ? new mongodb_1.ObjectId(albumId) : albumId;
        // Get album and verify access
        const album = await this.getAlbumById(albumObjectId, userId);
        if (!album)
            return [];
        // Get all photos for this album
        return await photosCollection
            .find({ _id: { $in: album.photo_ids } })
            .sort({ uploaded_at: -1 })
            .toArray();
    }
    async shareAlbum(albumId, ownerId, shareData) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const usersCollection = this.getUsersCollection();
        const albumObjectId = typeof albumId === 'string' ? new mongodb_1.ObjectId(albumId) : albumId;
        const ownerObjectId = typeof ownerId === 'string' ? new mongodb_1.ObjectId(ownerId) : ownerId;
        // Verify album ownership
        const album = await albumsCollection.findOne({ _id: albumObjectId, user_id: ownerObjectId });
        if (!album)
            return false;
        let shareWith = {
            permission: shareData.permission,
            shared_at: new Date()
        };
        if (shareData.username) {
            // Find user by username
            const user = await usersCollection.findOne({ username: shareData.username });
            if (user) {
                shareWith.user_id = user._id;
            }
            else {
                return false; // User not found
            }
        }
        else if (shareData.email) {
            // Check if user exists with this email
            const user = await usersCollection.findOne({ email: shareData.email });
            if (user) {
                shareWith.user_id = user._id;
            }
            else {
                shareWith.email = shareData.email; // Share with email for future registration
            }
        }
        // Add to shared_with array if not already shared
        const result = await albumsCollection.updateOne({
            _id: albumObjectId,
            $nor: [
                { 'shared_with.user_id': shareWith.user_id },
                { 'shared_with.email': shareWith.email }
            ]
        }, {
            $push: { shared_with: shareWith },
            $set: { updated_at: new Date() }
        });
        return result.modifiedCount > 0;
    }
    async generatePublicToken(albumId, userId, expiresAt) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const albumObjectId = typeof albumId === 'string' ? new mongodb_1.ObjectId(albumId) : albumId;
        const userObjectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        const publicToken = crypto.randomBytes(32).toString('hex');
        const result = await albumsCollection.updateOne({ _id: albumObjectId, user_id: userObjectId }, {
            $set: {
                is_public: true,
                public_token: publicToken,
                public_expires_at: expiresAt,
                updated_at: new Date()
            }
        });
        return result.modifiedCount > 0 ? publicToken : null;
    }
    async revokePublicAccess(albumId, userId) {
        await this.getDatabase();
        const albumsCollection = this.getAlbumsCollection();
        const albumObjectId = typeof albumId === 'string' ? new mongodb_1.ObjectId(albumId) : albumId;
        const userObjectId = typeof userId === 'string' ? new mongodb_1.ObjectId(userId) : userId;
        const result = await albumsCollection.updateOne({ _id: albumObjectId, user_id: userObjectId }, {
            $set: {
                is_public: false,
                updated_at: new Date()
            },
            $unset: {
                public_token: "",
                public_expires_at: ""
            }
        });
        return result.modifiedCount > 0;
    }
    async close() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
        }
    }
}
exports.databaseService = new DatabaseService();
