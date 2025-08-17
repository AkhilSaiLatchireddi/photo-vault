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
    if (this.db) return this.db;

    try {
      this.client = new MongoClient(this.uri, {
        serverApi: {
          version: ServerApiVersion.v1,
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
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error instanceof Error ? error.message : error);
      
      // Return a mock database object to prevent crashes
      return null;
    }
  }

  private async createIndexes() {
    if (!this.db) throw new Error('Database not initialized');

    const usersCollection = this.db.collection('users');
    const photosCollection = this.db.collection('photos');

    // Create indexes for users collection
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    await usersCollection.createIndex({ auth0Id: 1 }, { unique: true, sparse: true }); // Auth0 ID index

    // Create indexes for photos collection
    await photosCollection.createIndex({ user_id: 1 });
    await photosCollection.createIndex({ uploaded_at: -1 });
    await photosCollection.createIndex({ taken_at: -1 });
    await photosCollection.createIndex({ s3_key: 1 }, { unique: true });
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

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}

export const databaseService = new DatabaseService();
