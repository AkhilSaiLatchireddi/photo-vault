# SQLite Authentication & User-Specific Photo Storage

## 🎯 Overview
Complete authentication system with SQLite database and user-specific photo organization by date with metadata storage.

## 📋 Requirements

### Functional Requirements
- **User Registration**: Email/username + password registration
- **User Login**: Support login with email or username
- **JWT Authentication**: Secure token-based authentication
- **User-Specific Storage**: Photos organized by user and date in S3
- **Metadata Storage**: Photo metadata, upload timestamps, file information
- **Photo Management**: Upload, list, download, delete user photos
- **Date Organization**: Photos organized by year/month for easy retrieval

### Non-Functional Requirements
- **Performance**: SQLite for fast local database operations
- **Security**: Password hashing with bcrypt, JWT tokens
- **Scalability**: User-specific S3 folder structure
- **Data Integrity**: Foreign key constraints and validation

## 🏗️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Photos Table
```sql
CREATE TABLE photos (
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
);
```

## 📁 S3 Storage Structure

### User-Specific Organization
```
your-s3-bucket/
└── users/
    ├── john_doe/
    │   └── photos/
    │       ├── 2024/
    │       │   ├── 01/
    │       │   │   ├── uuid1.jpg
    │       │   │   └── uuid2.png
    │       │   ├── 02/
    │       │   └── 03/
    │       └── 2025/
    │           └── 01/
    ├── jane_smith/
    │   └── photos/
    │       └── 2024/
    └── another_user/
```

### Benefits of This Structure
- **User Isolation**: Each user has their own folder
- **Date Organization**: Easy to find photos by year/month
- **Scalable**: Can add more folder types (videos, thumbnails)
- **Backup Friendly**: Easy to backup specific user data

## 🔐 Authentication Flow

### Registration Process
1. **Validate Input**: Username, email, password validation
2. **Check Duplicates**: Ensure email/username uniqueness
3. **Hash Password**: bcrypt with 12 salt rounds
4. **Create User**: Save to SQLite database
5. **Generate JWT**: Return authentication token
6. **Create User Folder**: Initialize S3 folder structure

### Login Process
1. **Find User**: Search by email or username
2. **Verify Password**: Compare with hashed password
3. **Generate JWT**: Create authentication token
4. **Return User Data**: Username, email, token

### Token Verification
1. **Extract Token**: From Authorization header
2. **Verify JWT**: Validate signature and expiration
3. **Database Check**: Ensure user still exists
4. **Add to Request**: Attach user to req.user

## 📸 Photo Management

### Upload Process
1. **Authentication**: Verify user token
2. **Generate Path**: `users/{username}/photos/{year}/{month}/{uuid}.ext`
3. **Presigned URL**: Create S3 upload URL
4. **Database Entry**: Save metadata to SQLite
5. **Return Response**: Upload URL + photo record

### Metadata Extraction
- **File Information**: Size, type, original name
- **Image Dimensions**: Width/height (if applicable)
- **EXIF Data**: Camera settings, location, date taken
- **Upload Timestamp**: Server-side timestamp
- **User Association**: Link to user account

### Retrieval Options
- **All Photos**: Paginated list of user photos
- **By Date**: Filter by year/month
- **By ID**: Specific photo with download URL
- **Statistics**: Total count, storage used

## 🔧 API Endpoints

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/verify-token` - Verify JWT token

### Photo Endpoints
- `GET /api/files` - List user photos (with date filters)
- `POST /api/files/upload-url` - Get upload URL + save metadata
- `GET /api/files/:id/download` - Get download URL for photo
- `DELETE /api/files/:id` - Delete photo (S3 + database)
- `GET /api/files/stats` - Get user photo statistics

## 📊 Query Examples

### Get Photos by Year/Month
```typescript
// Get all photos from 2024
const photos2024 = await databaseService.getPhotosByYearMonth(userId, 2024);

// Get photos from January 2024
const photosJan2024 = await databaseService.getPhotosByYearMonth(userId, 2024, 1);
```

### Photo Statistics
```typescript
const stats = await databaseService.getPhotoStats(userId);
// Returns: total_photos, total_size, first_upload, last_upload
```

### Date Range Queries
```typescript
const photos = await databaseService.getPhotosByDateRange(
  userId, 
  '2024-01-01', 
  '2024-12-31'
);
```

## 🔒 Security Features

### Password Security
- **bcrypt Hashing**: 12 salt rounds for strong protection
- **No Plain Text**: Passwords never stored in plain text
- **Secure Comparison**: Constant-time password verification

### JWT Security
- **Strong Secret**: Configurable JWT secret key
- **Expiration**: 7-day default token lifetime
- **Verification**: Database user check on each request

### Access Control
- **User Isolation**: Users can only access their own photos
- **Path Validation**: S3 keys must match user folder structure
- **Database Constraints**: Foreign keys ensure data integrity

## 🚀 Future Enhancements

### OAuth Integration (Future)
- **Google OAuth**: One-click registration/login
- **GitHub OAuth**: Developer-friendly option
- **Apple/Facebook**: Additional social login options

### Advanced Features
- **Photo Albums**: Group photos into collections
- **Sharing**: Generate shareable links with expiration
- **Face Recognition**: Auto-tag people in photos
- **AI Tagging**: Automatic object/scene recognition
- **Backup/Sync**: Mobile app synchronization

## 📈 Performance Optimizations

### Database Indexes
```sql
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_photos_uploaded_at ON photos(uploaded_at);
CREATE INDEX idx_photos_taken_at ON photos(taken_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

### Caching Strategy
- **JWT Verification**: Cache user lookups
- **S3 URLs**: Cache presigned URLs
- **Photo Metadata**: Cache frequently accessed data

## 💰 Cost Optimization

### S3 Storage Costs
- **Intelligent Tiering**: Automatic cost optimization
- **Date-Based Structure**: Easy to implement lifecycle policies
- **User Quotas**: Implement storage limits per user

### Database Efficiency
- **SQLite**: No server costs, excellent performance
- **Efficient Queries**: Indexed lookups and pagination
- **Metadata Storage**: JSON in database vs separate files

## 🧪 Testing Strategy

### Unit Tests
- Authentication service methods
- Database operations
- S3 service functions
- File path generation

### Integration Tests
- Registration/login flow
- Photo upload process
- User-specific access control
- Database migrations

### API Tests
- All endpoint responses
- Error handling
- Authentication middleware
- File upload/download

## 🔗 Related Features

- [AWS Lambda Integration](./27-aws-lambda-integration.md) - Serverless processing
- [Terraform Infrastructure](./28-terraform-infrastructure.md) - Infrastructure as Code
- [GitHub Actions Pipeline](./29-github-actions.md) - CI/CD automation
- [Frontend Authentication](./future/frontend-auth.md) - React login forms

## ✅ Implementation Status

**Completed:**
- ✅ SQLite database setup with tables and indexes
- ✅ User registration and login with bcrypt
- ✅ JWT authentication middleware
- ✅ User-specific S3 folder structure
- ✅ Photo metadata storage and retrieval
- ✅ Date-based organization (year/month)
- ✅ Complete API endpoints with validation
- ✅ Database service with all CRUD operations
- ✅ S3 integration with presigned URLs
- ✅ Authentication routes with express-validator

**Ready for Testing:**
- Backend API server with authentication
- Photo upload with user-specific paths
- Photo listing with date filters
- Secure photo download and deletion
- User statistics and metadata retrieval

**Next Steps:**
1. Update frontend to use authentication
2. Add photo upload form with metadata
3. Create user dashboard with statistics
4. Implement photo gallery with date navigation
5. Add Gmail OAuth integration
