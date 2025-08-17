<<<<<<< Updated upstream
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
=======
<<<<<<< HEAD
import { MongoClient, ServerApiVersion, Db, Collection, ObjectId } from 'mongodb';
>>>>>>> Stashed changes

export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface Photo {
<<<<<<< Updated upstream
  id: number;
  user_id: number;
=======
  _id?: ObjectId;
  user_id: ObjectId;
=======
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';

export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: number;
  user_id: number;
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
  filename: string;
  s3_key: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
<<<<<<< Updated upstream
  taken_at?: string;
  uploaded_at: string;
  metadata?: string; // JSON string for EXIF data
}

class DatabaseService {
  private db: Database | null = null;
=======
<<<<<<< HEAD
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
=======
  taken_at?: string;
  uploaded_at: string;
  metadata?: string; // JSON string for EXIF data
}

class DatabaseService {
  private db: Database | null = null;
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes

  async initialize() {
    if (this.db) return this.db;

<<<<<<< Updated upstream
    const dbPath = path.join(__dirname, '../../data/photovault.db');
    
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await this.createTables();
    return this.db;
=======
<<<<<<< HEAD
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
>>>>>>> Stashed changes
  }

  private async createTables() {
    if (!this.db) throw new Error('Database not initialized');

<<<<<<< Updated upstream
=======
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
=======
    const dbPath = path.join(__dirname, '../../data/photovault.db');
    
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await this.createTables();
    return this.db;
  }

  private async createTables() {
    if (!this.db) throw new Error('Database not initialized');

>>>>>>> Stashed changes
    // Users table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Photos table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        s3_key TEXT UNIQUE NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        taken_at DATETIME,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
      CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON photos(uploaded_at);
      CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON photos(taken_at);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    console.log('✅ Database tables created successfully');
<<<<<<< Updated upstream
=======
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
  }

  async getDatabase() {
    if (!this.db) {
      await this.initialize();
    }
    return this.db!;
  }

<<<<<<< Updated upstream
=======
<<<<<<< HEAD
  private getUsersCollection(): Collection<User> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.collection<User>('users');
  }

  private getPhotosCollection(): Collection<Photo> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.collection<Photo>('photos');
  }

>>>>>>> Stashed changes
  // User methods
  async createUser(username: string, email: string, hashedPassword: string): Promise<User> {
    const db = await this.getDatabase();
    
    const result = await db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    const user = await db.get(
      'SELECT * FROM users WHERE id = ?',
      [result.lastID]
    );

    return user as User;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const db = await this.getDatabase();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    return user as User | null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const db = await this.getDatabase();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    return user as User | null;
  }

  async getUserById(id: number): Promise<User | null> {
    const db = await this.getDatabase();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    return user as User | null;
  }

  // Photo methods
  async createPhoto(photoData: Omit<Photo, 'id' | 'uploaded_at'>): Promise<Photo> {
    const db = await this.getDatabase();
    
    const result = await db.run(`
      INSERT INTO photos (
        user_id, filename, s3_key, original_name, mime_type, 
        file_size, width, height, taken_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      photoData.user_id,
      photoData.filename,
      photoData.s3_key,
      photoData.original_name,
      photoData.mime_type,
      photoData.file_size,
      photoData.width,
      photoData.height,
      photoData.taken_at,
      photoData.metadata
    ]);

    const photo = await db.get('SELECT * FROM photos WHERE id = ?', [result.lastID]);
    return photo as Photo;
  }

  async getUserPhotos(userId: number, limit: number = 50, offset: number = 0): Promise<Photo[]> {
    const db = await this.getDatabase();
    const photos = await db.all(
      'SELECT * FROM photos WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return photos as Photo[];
  }

  async getPhotosByDateRange(userId: number, startDate: string, endDate: string): Promise<Photo[]> {
    const db = await this.getDatabase();
    const photos = await db.all(`
      SELECT * FROM photos 
      WHERE user_id = ? AND date(uploaded_at) BETWEEN ? AND ?
      ORDER BY uploaded_at DESC
    `, [userId, startDate, endDate]);
    return photos as Photo[];
  }

  async getPhotosByYearMonth(userId: number, year: number, month?: number): Promise<Photo[]> {
    const db = await this.getDatabase();
    
    let query = `
      SELECT * FROM photos 
      WHERE user_id = ? AND strftime('%Y', uploaded_at) = ?
    `;
    const params: any[] = [userId, year.toString()];

    if (month !== undefined) {
      query += ` AND strftime('%m', uploaded_at) = ?`;
      params.push(month.toString().padStart(2, '0'));
    }

    query += ` ORDER BY uploaded_at DESC`;

    const photos = await db.all(query, params);
    return photos as Photo[];
  }

  async getPhotoById(id: number, userId: number): Promise<Photo | null> {
    const db = await this.getDatabase();
    const photo = await db.get(
      'SELECT * FROM photos WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return photo as Photo | null;
  }

  async deletePhoto(id: number, userId: number): Promise<boolean> {
    const db = await this.getDatabase();
    const result = await db.run(
      'DELETE FROM photos WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return (result.changes || 0) > 0;
  }

  async getPhotoStats(userId: number) {
    const db = await this.getDatabase();
    
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_photos,
        SUM(file_size) as total_size,
        MIN(uploaded_at) as first_upload,
        MAX(uploaded_at) as last_upload
      FROM photos 
      WHERE user_id = ?
    `, [userId]);

    return stats;
  }

  async close() {
<<<<<<< Updated upstream
    if (this.db) {
      await this.db.close();
=======
    if (this.client) {
      await this.client.close();
      this.client = null;
=======
  // User methods
  async createUser(username: string, email: string, hashedPassword: string): Promise<User> {
    const db = await this.getDatabase();
    
    const result = await db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    const user = await db.get(
      'SELECT * FROM users WHERE id = ?',
      [result.lastID]
    );

    return user as User;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const db = await this.getDatabase();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    return user as User | null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const db = await this.getDatabase();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    return user as User | null;
  }

  async getUserById(id: number): Promise<User | null> {
    const db = await this.getDatabase();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    return user as User | null;
  }

  // Photo methods
  async createPhoto(photoData: Omit<Photo, 'id' | 'uploaded_at'>): Promise<Photo> {
    const db = await this.getDatabase();
    
    const result = await db.run(`
      INSERT INTO photos (
        user_id, filename, s3_key, original_name, mime_type, 
        file_size, width, height, taken_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      photoData.user_id,
      photoData.filename,
      photoData.s3_key,
      photoData.original_name,
      photoData.mime_type,
      photoData.file_size,
      photoData.width,
      photoData.height,
      photoData.taken_at,
      photoData.metadata
    ]);

    const photo = await db.get('SELECT * FROM photos WHERE id = ?', [result.lastID]);
    return photo as Photo;
  }

  async getUserPhotos(userId: number, limit: number = 50, offset: number = 0): Promise<Photo[]> {
    const db = await this.getDatabase();
    const photos = await db.all(
      'SELECT * FROM photos WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return photos as Photo[];
  }

  async getPhotosByDateRange(userId: number, startDate: string, endDate: string): Promise<Photo[]> {
    const db = await this.getDatabase();
    const photos = await db.all(`
      SELECT * FROM photos 
      WHERE user_id = ? AND date(uploaded_at) BETWEEN ? AND ?
      ORDER BY uploaded_at DESC
    `, [userId, startDate, endDate]);
    return photos as Photo[];
  }

  async getPhotosByYearMonth(userId: number, year: number, month?: number): Promise<Photo[]> {
    const db = await this.getDatabase();
    
    let query = `
      SELECT * FROM photos 
      WHERE user_id = ? AND strftime('%Y', uploaded_at) = ?
    `;
    const params: any[] = [userId, year.toString()];

    if (month !== undefined) {
      query += ` AND strftime('%m', uploaded_at) = ?`;
      params.push(month.toString().padStart(2, '0'));
    }

    query += ` ORDER BY uploaded_at DESC`;

    const photos = await db.all(query, params);
    return photos as Photo[];
  }

  async getPhotoById(id: number, userId: number): Promise<Photo | null> {
    const db = await this.getDatabase();
    const photo = await db.get(
      'SELECT * FROM photos WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return photo as Photo | null;
  }

  async deletePhoto(id: number, userId: number): Promise<boolean> {
    const db = await this.getDatabase();
    const result = await db.run(
      'DELETE FROM photos WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return (result.changes || 0) > 0;
  }

  async getPhotoStats(userId: number) {
    const db = await this.getDatabase();
    
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_photos,
        SUM(file_size) as total_size,
        MIN(uploaded_at) as first_upload,
        MAX(uploaded_at) as last_upload
      FROM photos 
      WHERE user_id = ?
    `, [userId]);

    return stats;
  }

  async close() {
    if (this.db) {
      await this.db.close();
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
      this.db = null;
    }
  }
}

export const databaseService = new DatabaseService();
