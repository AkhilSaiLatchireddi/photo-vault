"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseService = void 0;
const mongodb_1 = require("mongodb");

// Debug logging setup
const DEBUG = process.env.DEBUG === 'true';
const debugLog = (message, data) => {
    if (DEBUG) {
        const timestamp = new Date().toISOString();
        console.log(`[DATABASE-DEBUG] ${timestamp}: ${message}`, data || '');
    }
};

class DatabaseService {
    constructor() {
        debugLog('DatabaseService constructor called');
        this.client = null;
        this.db = null;
        this.uri = process.env.MONGODB_URI || '';
        
        debugLog('Environment variables check', {
            hasMongoDbUri: !!process.env.MONGODB_URI,
            hasMongoDbUsername: !!process.env.MONGODB_USERNAME,
            hasMongoDbPassword: !!process.env.MONGODB_PASSWORD,
            nodeEnv: process.env.NODE_ENV,
            awsRegion: process.env.AWS_REGION
        });
        
        if (!this.uri) {
            debugLog('⚠️  MONGODB_URI environment variable is not set, constructing from username/password');
            console.error('⚠️  MONGODB_URI environment variable is not set');
            const username = process.env.MONGODB_USERNAME || '<db_username>';
            const password = process.env.MONGODB_PASSWORD || '<db_password>';
            this.uri = `mongodb+srv://${username}:${password}@photovault.czk6x9q.mongodb.net/?retryWrites=true&w=majority&appName=photovault&tls=true&tlsAllowInvalidCertificates=false`;
            debugLog('Constructed MongoDB URI from env vars', { 
                hasUsername: username !== '<db_username>',
                hasPassword: password !== '<db_password>',
                uriMasked: this.uri.replace(/\/\/.*@/, '//***@')
            });
        } else {
            debugLog('MongoDB URI found in environment', { 
                uriMasked: this.uri.replace(/\/\/.*@/, '//***@')
            });
        }
        
        console.log('🔗 MongoDB URI configured:', this.uri.replace(/\/\/.*@/, '//***@'));
        debugLog('DatabaseService constructor completed');
    }
    async initialize() {
        debugLog('initialize() method called');
        
        if (this.db) {
            debugLog('Database already initialized, returning existing connection');
            return this.db;
        }
        
        try {
            debugLog('Creating new MongoDB client', {
                uri: this.uri.replace(/\/\/.*@/, '//***@'),
                hasUri: !!this.uri,
                uriLength: this.uri.length
            });
            
            const clientOptions = {
                serverApi: {
                    version: mongodb_1.ServerApiVersion.v1,
                    strict: true,
                    deprecationErrors: true,
                },
                connectTimeoutMS: 30000,
                serverSelectionTimeoutMS: 30000,
                tls: true,
            };
            
            debugLog('MongoDB client options', clientOptions);
            
            this.client = new mongodb_1.MongoClient(this.uri, clientOptions);
            debugLog('MongoDB client created, attempting connection...');
            
            // Add connection event listeners for debugging
            this.client.on('open', () => {
                debugLog('MongoDB connection opened successfully');
            });
            
            this.client.on('close', () => {
                debugLog('MongoDB connection closed');
            });
            
            this.client.on('error', (error) => {
                debugLog('MongoDB client error', { 
                    error: error.message,
                    stack: error.stack,
                    name: error.name
                });
            });
            
            this.client.on('timeout', () => {
                debugLog('MongoDB connection timeout');
            });
            
            debugLog('Calling client.connect()...');
            await this.client.connect();
            debugLog('client.connect() completed successfully');
            
            debugLog('Getting database instance...');
            this.db = this.client.db('photovault');
            debugLog('Database instance obtained', { dbName: this.db.databaseName });
            
            debugLog('Testing database connection with ping...');
            await this.db.admin().ping();
            debugLog('Database ping successful');
            
            debugLog('Creating database indexes...');
            await this.createIndexes();
            debugLog('Database indexes created successfully');
            
            debugLog('Database initialization completed successfully');
            return this.db;
        }
        catch (error) {
            debugLog('❌ MongoDB connection failed with error', {
                errorMessage: error.message,
                errorName: error.name,
                errorCode: error.code,
                errorStack: error.stack,
                errorCause: error.cause,
                isMongoError: error instanceof mongodb_1.MongoError,
                isMongoServerError: error instanceof mongodb_1.MongoServerError,
                isMongoNetworkError: error instanceof mongodb_1.MongoNetworkError
            });
            
            console.error('❌ MongoDB connection failed:', error instanceof Error ? error.message : error);
            console.error('Full error details:', {
                message: error.message,
                stack: error.stack,
                code: error.code,
                name: error.name
            });
            
            // Clean up client if connection failed
            if (this.client) {
                try {
                    debugLog('Cleaning up failed client connection...');
                    await this.client.close();
                    this.client = null;
                    debugLog('Failed client connection cleaned up');
                } catch (closeError) {
                    debugLog('Error cleaning up failed client', { 
                        closeError: closeError.message 
                    });
                }
            }
            
            return null;
        }
    }
    async createIndexes() {
        debugLog('createIndexes() method called');
        
        if (!this.db) {
            debugLog('❌ Database not initialized, cannot create indexes');
            throw new Error('Database not initialized');
        }
        
        try {
            debugLog('Getting collections for index creation...');
            const usersCollection = this.db.collection('users');
            const photosCollection = this.db.collection('photos');
            debugLog('Collections obtained', { 
                usersCollectionName: usersCollection.collectionName,
                photosCollectionName: photosCollection.collectionName 
            });
            
            debugLog('Creating users collection indexes...');
            await usersCollection.createIndex({ email: 1 }, { unique: true });
            debugLog('Created email index');
            
            await usersCollection.createIndex({ username: 1 }, { unique: true });
            debugLog('Created username index');
            
            await usersCollection.createIndex({ auth0Id: 1 }, { unique: true, sparse: true });
            debugLog('Created auth0Id index');
            
            debugLog('Creating photos collection indexes...');
            await photosCollection.createIndex({ user_id: 1 });
            debugLog('Created user_id index');
            
            await photosCollection.createIndex({ uploaded_at: -1 });
            debugLog('Created uploaded_at index');
            
            await photosCollection.createIndex({ taken_at: -1 });
            debugLog('Created taken_at index');
            
            await photosCollection.createIndex({ s3_key: 1 }, { unique: true });
            debugLog('Created s3_key index');
            
            debugLog('All database indexes created successfully');
        } catch (error) {
            debugLog('❌ Error creating indexes', {
                errorMessage: error.message,
                errorName: error.name,
                errorCode: error.code,
                errorStack: error.stack
            });
            throw error;
        }
    }
    async getDatabase() {
        debugLog('getDatabase() method called');
        
        if (!this.db) {
            debugLog('Database not initialized, calling initialize()...');
            await this.initialize();
            debugLog('initialize() completed', { hasDb: !!this.db });
        } else {
            debugLog('Database already initialized, returning existing connection');
        }
        
        if (!this.db) {
            debugLog('❌ Database is still null after initialization attempt');
            throw new Error('Failed to initialize database');
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
            if (error.code === 11000 && error.keyPattern?.auth0Id) {
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
        return await usersCollection.findOne({ _id: objectId }, { projection: { password: 0 } });
    }
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
    async close() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
        }
    }
}
exports.databaseService = new DatabaseService();
