import { MongoClient, ServerApiVersion, Db, Collection, ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  username: string;
  email: string;
  password?: string; // Optional for Auth0 users
  auth0Id?: string; // Auth0 user ID
  name?: string; // Full name from Auth0
  picture?: string; // Profile picture from Auth0
  emailVerified?: boolean; // Email verification status from Auth0
  
  // Extended Profile Information
  profile?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    bio?: string;
    location?: string;
    website?: string;
    phone?: string;
    birthDate?: Date;
    occupation?: string;
    interests?: string[];
    socialLinks?: {
      twitter?: string;
      instagram?: string;
      linkedin?: string;
      github?: string;
    };
    preferences?: {
      theme?: 'light' | 'dark' | 'auto';
      privacy?: 'public' | 'private' | 'friends';
      notifications?: {
        email?: boolean;
        uploads?: boolean;
        sharing?: boolean;
      };
    };
  };
  
  created_at: Date;
  updated_at: Date;
}

export interface Photo {
  _id?: ObjectId;
  user_id: ObjectId;
  filename: string;
  s3_key: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  taken_at?: Date;
  uploaded_at: Date;
  metadata?: object; // EXIF data as object instead of JSON string
}

export interface Album {
  _id?: ObjectId;
  user_id: ObjectId; // Album owner
  title: string;
  description?: string;
  cover_photo_id?: ObjectId; // Reference to a photo for album cover
  photo_ids: ObjectId[]; // Array of photo references (no duplication)
  is_public: boolean; // Whether album can be accessed via public URL
  public_token?: string; // Unique token for public access
  public_expires_at?: Date; // Optional expiration for public access
  shared_with: {
    user_id?: ObjectId; // For registered users
    email?: string; // For non-registered users
    permission: 'view' | 'edit'; // Permission level
    shared_at: Date;
  }[];
  created_at: Date;
  updated_at: Date;
}

export interface AlbumShare {
  _id?: ObjectId;
  album_id: ObjectId;
  shared_by: ObjectId; // User who shared
  shared_with_email?: string; // Email for non-registered users
  shared_with_user_id?: ObjectId; // User ID for registered users
  permission: 'view' | 'edit';
  expires_at?: Date; // Optional expiration
  access_count: number; // Track how many times accessed
  last_accessed_at?: Date;
  created_at: Date;
}

class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private readonly uri: string;

  constructor() {
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
    if (this.db) {
      console.log('♻️  Reusing existing database connection');
      return this.db;
    }

    try {
      console.log('🔌 Creating new MongoDB connection...');
      this.client = new MongoClient(this.uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        // Optimized settings for Lambda
        connectTimeoutMS: 5000, // Faster timeout (5s instead of 30s)
        serverSelectionTimeoutMS: 5000, // Faster timeout
        socketTimeoutMS: 45000, // Socket timeout
        maxPoolSize: 10, // Limit pool size for Lambda
        minPoolSize: 1, // Keep at least 1 connection warm
        maxIdleTimeMS: 60000, // Close idle connections after 60s
        retryWrites: true,
        retryReads: true,
        tls: true,
      });

      await this.client.connect();
      this.db = this.client.db('photovault');

      // Create indexes in background (don't await)
      this.createIndexes().catch(err => {
        console.error('⚠️  Failed to create indexes:', err);
      });
      
      console.log('✅ MongoDB connection established');
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error instanceof Error ? error.message : error);
      // Reset so next attempt can retry
      this.client = null;
      this.db = null;
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.db !== null && this.client !== null;
  }

  private async createIndexes() {
    if (!this.db) throw new Error('Database not initialized');

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
    return this.db!;
  }

  private getUsersCollection(): Collection<User> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.collection<User>('users');
  }

  private getPhotosCollection(): Collection<Photo> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.collection<Photo>('photos');
  }

  private getAlbumsCollection(): Collection<Album> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.collection<Album>('albums');
  }

  private getAlbumSharesCollection(): Collection<AlbumShare> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.collection<AlbumShare>('album_shares');
  }

  // User methods
  async createUser(username: string, email: string, hashedPassword: string): Promise<User> {
    await this.getDatabase();
    const usersCollection = this.getUsersCollection();
    
    const now = new Date();
    const userData: Omit<User, '_id'> = {
      username,
      email,
      password: hashedPassword,
      created_at: now,
      updated_at: now
    };

    const result = await usersCollection.insertOne(userData);
    const user = await usersCollection.findOne({ _id: result.insertedId });
    
    if (!user) throw new Error('Failed to create user');
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    await this.getDatabase();
    const usersCollection = this.getUsersCollection();
    return await usersCollection.findOne({ email });
  }

  async getUserByUsername(username: string): Promise<User | null> {
    await this.getDatabase();
    const usersCollection = this.getUsersCollection();
    return await usersCollection.findOne({ username });
  }

  async getUserById(id: string | ObjectId): Promise<User | null> {
    await this.getDatabase();
    const usersCollection = this.getUsersCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await usersCollection.findOne({ _id: objectId });
  }

  async getUserByAuth0Id(auth0Id: string): Promise<User | null> {
    await this.getDatabase();
    const usersCollection = this.getUsersCollection();
    return await usersCollection.findOne({ auth0Id });
  }

  async createAuth0User(userData: {
    auth0Id: string;
    username: string;
    email: string;
    name?: string;
    picture?: string;
    emailVerified?: boolean;
  }): Promise<User> {
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
    const user: Omit<User, '_id'> = {
      ...userData,
      username: uniqueUsername,
      created_at: now,
      updated_at: now
    };

    try {
      const result = await usersCollection.insertOne(user);
      const createdUser = await usersCollection.findOne({ _id: result.insertedId });
      
      if (!createdUser) throw new Error('Failed to create Auth0 user');
      return createdUser;
    } catch (error: any) {
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

  async updateAuth0User(userId: string, updateData: {
    email?: string;
    name?: string;
    picture?: string;
    emailVerified?: boolean;
  }): Promise<User> {
    await this.getDatabase();
    const usersCollection = this.getUsersCollection();
    const objectId = new ObjectId(userId);
    
    const result = await usersCollection.findOneAndUpdate(
      { _id: objectId },
      { 
        $set: { 
          ...updateData,
          updated_at: new Date() 
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!result) throw new Error('Failed to update Auth0 user');
    return result;
  }

  async updateUserProfile(userId: string, profileData: Partial<User['profile']>): Promise<User> {
    await this.getDatabase();
    const usersCollection = this.getUsersCollection();
    const objectId = new ObjectId(userId);
    
    const result = await usersCollection.findOneAndUpdate(
      { _id: objectId },
      { 
        $set: { 
          profile: profileData,
          updated_at: new Date() 
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!result) throw new Error('Failed to update user profile');
    return result;
  }

  async updateUserProfileField(userId: string, fieldPath: string, value: any): Promise<User> {
    await this.getDatabase();
    const usersCollection = this.getUsersCollection();
    const objectId = new ObjectId(userId);
    
    const updateQuery: any = {
      updated_at: new Date()
    };
    updateQuery[`profile.${fieldPath}`] = value;
    
    const result = await usersCollection.findOneAndUpdate(
      { _id: objectId },
      { $set: updateQuery },
      { returnDocument: 'after' }
    );
    
    if (!result) throw new Error('Failed to update user profile field');
    return result;
  }

  async getUserProfile(userId: string): Promise<User | null> {
    await this.getDatabase();
    const usersCollection = this.getUsersCollection();
    const objectId = new ObjectId(userId);
    
    return await usersCollection.findOne(
      { _id: objectId },
      { projection: { password: 0 } } // Exclude password from response
    );
  }

  // Photo methods
  async createPhoto(photoData: Omit<Photo, '_id' | 'uploaded_at'>): Promise<Photo> {
    await this.getDatabase();
    const photosCollection = this.getPhotosCollection();
    
    const photoDocument: Omit<Photo, '_id'> = {
      ...photoData,
      uploaded_at: new Date()
    };

    const result = await photosCollection.insertOne(photoDocument);
    const photo = await photosCollection.findOne({ _id: result.insertedId });
    
    if (!photo) throw new Error('Failed to create photo');
    return photo;
  }

  async getUserPhotos(userId: string | ObjectId, limit: number = 50, offset: number = 0): Promise<Photo[]> {
    await this.getDatabase();
    const photosCollection = this.getPhotosCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    return await photosCollection
      .find({ user_id: objectId })
      .sort({ uploaded_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async getPhotosByDateRange(userId: string | ObjectId, startDate: Date, endDate: Date): Promise<Photo[]> {
    await this.getDatabase();
    const photosCollection = this.getPhotosCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
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

  async getPhotosByYearMonth(userId: string | ObjectId, year: number, month?: number): Promise<Photo[]> {
    await this.getDatabase();
    const photosCollection = this.getPhotosCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    let startDate: Date;
    let endDate: Date;

    if (month !== undefined) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
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

  async getPhotoById(id: string | ObjectId, userId: string | ObjectId): Promise<Photo | null> {
    await this.getDatabase();
    const photosCollection = this.getPhotosCollection();
    const photoObjectId = typeof id === 'string' ? new ObjectId(id) : id;
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    return await photosCollection.findOne({
      _id: photoObjectId,
      user_id: userObjectId
    });
  }

  async deletePhoto(id: string | ObjectId, userId: string | ObjectId): Promise<boolean> {
    await this.getDatabase();
    const photosCollection = this.getPhotosCollection();
    const photoObjectId = typeof id === 'string' ? new ObjectId(id) : id;
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    const result = await photosCollection.deleteOne({
      _id: photoObjectId,
      user_id: userObjectId
    });
    
    return result.deletedCount > 0;
  }

  async getPhotoStats(userId: string | ObjectId) {
    await this.getDatabase();
    const photosCollection = this.getPhotosCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
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
  async createAlbum(albumData: Omit<Album, '_id' | 'created_at' | 'updated_at' | 'photo_ids' | 'shared_with'>): Promise<Album> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    
    const now = new Date();
    const albumDocument: Omit<Album, '_id'> = {
      ...albumData,
      photo_ids: [],
      shared_with: [],
      created_at: now,
      updated_at: now
    };

    const result = await albumsCollection.insertOne(albumDocument);
    const album = await albumsCollection.findOne({ _id: result.insertedId });
    
    if (!album) throw new Error('Failed to create album');
    return album;
  }

  async getUserAlbums(userId: string | ObjectId): Promise<Album[]> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    return await albumsCollection
      .find({ user_id: objectId })
      .sort({ created_at: -1 })
      .toArray();
  }

  async getSharedAlbums(userId: string | ObjectId, email?: string): Promise<Album[]> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    const query: any = {
      $or: [
        { 'shared_with.user_id': objectId }
      ]
    };
    
    if (email) {
      query.$or.push({ 'shared_with.email': email });
    }
    
    return await albumsCollection.find(query).sort({ created_at: -1 }).toArray();
  }

  async getAlbumById(albumId: string | ObjectId, userId?: string | ObjectId): Promise<Album | null> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const albumObjectId = typeof albumId === 'string' ? new ObjectId(albumId) : albumId;
    
    const query: any = { _id: albumObjectId };
    
    // If userId provided, ensure user has access (owner or shared with)
    if (userId) {
      const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
      query.$or = [
        { user_id: userObjectId }, // Owner
        { 'shared_with.user_id': userObjectId }, // Shared with user
        { is_public: true } // Public album
      ];
    }
    
    return await albumsCollection.findOne(query);
  }

  async getAlbumByToken(publicToken: string): Promise<Album | null> {
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

  async updateAlbum(albumId: string | ObjectId, userId: string | ObjectId, updateData: Partial<Omit<Album, '_id' | 'user_id' | 'created_at'>>): Promise<Album | null> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const albumObjectId = typeof albumId === 'string' ? new ObjectId(albumId) : albumId;
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    const result = await albumsCollection.findOneAndUpdate(
      { _id: albumObjectId, user_id: userObjectId }, // Only owner can update
      { 
        $set: { 
          ...updateData,
          updated_at: new Date() 
        } 
      },
      { returnDocument: 'after' }
    );
    
    return result;
  }

  async deleteAlbum(albumId: string | ObjectId, userId: string | ObjectId): Promise<boolean> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const albumObjectId = typeof albumId === 'string' ? new ObjectId(albumId) : albumId;
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    const result = await albumsCollection.deleteOne({
      _id: albumObjectId,
      user_id: userObjectId
    });
    
    return result.deletedCount > 0;
  }

  async addPhotoToAlbum(albumId: string | ObjectId, photoId: string | ObjectId, userId: string | ObjectId): Promise<boolean> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const albumObjectId = typeof albumId === 'string' ? new ObjectId(albumId) : albumId;
    const photoObjectId = typeof photoId === 'string' ? new ObjectId(photoId) : photoId;
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    // Verify user owns the album
    const album = await albumsCollection.findOne({ _id: albumObjectId, user_id: userObjectId });
    if (!album) return false;
    
    // Verify photo exists and user owns it
    const photo = await this.getPhotoById(photoObjectId, userObjectId);
    if (!photo) return false;
    
    // Add photo to album if not already present
    const result = await albumsCollection.updateOne(
      { _id: albumObjectId, photo_ids: { $ne: photoObjectId } },
      { 
        $push: { photo_ids: photoObjectId },
        $set: { updated_at: new Date() }
      }
    );
    
    return result.modifiedCount > 0;
  }

  async removePhotoFromAlbum(albumId: string | ObjectId, photoId: string | ObjectId, userId: string | ObjectId): Promise<boolean> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const albumObjectId = typeof albumId === 'string' ? new ObjectId(albumId) : albumId;
    const photoObjectId = typeof photoId === 'string' ? new ObjectId(photoId) : photoId;
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    const result = await albumsCollection.updateOne(
      { _id: albumObjectId, user_id: userObjectId },
      { 
        $pull: { photo_ids: photoObjectId },
        $set: { updated_at: new Date() }
      }
    );
    
    return result.modifiedCount > 0;
  }

  async getAlbumPhotos(albumId: string | ObjectId, userId?: string | ObjectId): Promise<Photo[]> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const photosCollection = this.getPhotosCollection();
    const albumObjectId = typeof albumId === 'string' ? new ObjectId(albumId) : albumId;
    
    // Get album and verify access
    const album = await this.getAlbumById(albumObjectId, userId);
    if (!album) return [];
    
    // Get all photos for this album
    return await photosCollection
      .find({ _id: { $in: album.photo_ids } })
      .sort({ uploaded_at: -1 })
      .toArray();
  }

  async shareAlbum(albumId: string | ObjectId, ownerId: string | ObjectId, shareData: {
    email?: string;
    username?: string;
    permission: 'view' | 'edit';
    expires_at?: Date;
  }): Promise<boolean> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const usersCollection = this.getUsersCollection();
    const albumObjectId = typeof albumId === 'string' ? new ObjectId(albumId) : albumId;
    const ownerObjectId = typeof ownerId === 'string' ? new ObjectId(ownerId) : ownerId;
    
    // Verify album ownership
    const album = await albumsCollection.findOne({ _id: albumObjectId, user_id: ownerObjectId });
    if (!album) return false;
    
    let shareWith: { user_id?: ObjectId; email?: string; permission: 'view' | 'edit'; shared_at: Date } = {
      permission: shareData.permission,
      shared_at: new Date()
    };
    
    if (shareData.username) {
      // Find user by username
      const user = await usersCollection.findOne({ username: shareData.username });
      if (user) {
        shareWith.user_id = user._id;
      } else {
        return false; // User not found
      }
    } else if (shareData.email) {
      // Check if user exists with this email
      const user = await usersCollection.findOne({ email: shareData.email });
      if (user) {
        shareWith.user_id = user._id;
      } else {
        shareWith.email = shareData.email; // Share with email for future registration
      }
    }
    
    // Add to shared_with array if not already shared
    const result = await albumsCollection.updateOne(
      { 
        _id: albumObjectId,
        $nor: [
          { 'shared_with.user_id': shareWith.user_id },
          { 'shared_with.email': shareWith.email }
        ]
      },
      { 
        $push: { shared_with: shareWith },
        $set: { updated_at: new Date() }
      }
    );
    
    return result.modifiedCount > 0;
  }

  async generatePublicToken(albumId: string | ObjectId, userId: string | ObjectId, expiresAt?: Date): Promise<string | null> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const albumObjectId = typeof albumId === 'string' ? new ObjectId(albumId) : albumId;
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    const crypto = await import('crypto');
    const publicToken = crypto.randomBytes(32).toString('hex');
    
    const result = await albumsCollection.updateOne(
      { _id: albumObjectId, user_id: userObjectId },
      { 
        $set: { 
          is_public: true,
          public_token: publicToken,
          public_expires_at: expiresAt,
          updated_at: new Date()
        } 
      }
    );
    
    return result.modifiedCount > 0 ? publicToken : null;
  }

  async revokePublicAccess(albumId: string | ObjectId, userId: string | ObjectId): Promise<boolean> {
    await this.getDatabase();
    const albumsCollection = this.getAlbumsCollection();
    const albumObjectId = typeof albumId === 'string' ? new ObjectId(albumId) : albumId;
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    const result = await albumsCollection.updateOne(
      { _id: albumObjectId, user_id: userObjectId },
      { 
        $set: { 
          is_public: false,
          updated_at: new Date()
        },
        $unset: { 
          public_token: "",
          public_expires_at: ""
        }
      }
    );
    
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

export const databaseService = new DatabaseService();
