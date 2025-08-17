# File Upload & Storage

## 🎯 Overview
Implement secure file upload and storage system using AWS S3 for photos and videos with proper metadata handling and thumbnail generation.

## 📋 Requirements

### Functional Requirements
- Upload photos and videos to AWS S3
- Support multiple file formats (JPEG, PNG, HEIC, MP4, MOV, etc.)
- Generate thumbnails automatically
- Extract and store metadata (EXIF, GPS, etc.)
- Progress tracking for uploads
- Drag and drop interface
- Batch upload support
- Resume interrupted uploads

### Non-Functional Requirements
- Maximum file size: 100MB per file
- Supported formats: JPEG, PNG, HEIC, WEBP, MP4, MOV, AVI
- Upload speed optimization
- Storage cost optimization
- 99.9% upload success rate
- Thumbnail generation within 5 seconds

## 🏗️ Technical Specifications

### AWS S3 Configuration
```json
{
  "BucketName": "photovault-storage-{environment}",
  "Region": "us-east-1",
  "StorageClass": "STANDARD_IA",
  "LifecycleRules": [
    {
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        },
        {
          "Days": 365,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ]
    }
  ],
  "CORS": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["https://yourdomain.com"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

### File Storage Structure
```
s3://photovault-storage/
├── users/
│   └── {userId}/
│       ├── originals/
│       │   └── {year}/
│       │       └── {month}/
│       │           └── {fileId}.{ext}
│       ├── thumbnails/
│       │   └── {fileId}/
│       │       ├── small.webp (150x150)
│       │       ├── medium.webp (500x500)
│       │       └── large.webp (1200x1200)
│       └── metadata/
│           └── {fileId}.json
```

### Database Schema
```sql
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    s3_bucket VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    duration INTEGER, -- for videos
    taken_at TIMESTAMP,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB,
    thumbnails JSONB,
    status VARCHAR(20) DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_taken_at ON files(taken_at);
CREATE INDEX idx_files_status ON files(status);
```

## 📝 Sub-Tasks

### Phase 2.1: S3 Setup & Configuration
- [ ] Create S3 bucket with proper policies
- [ ] Configure CORS for web uploads
- [ ] Set up lifecycle policies
- [ ] Create IAM roles and policies
- [ ] Configure CloudFront distribution

**Effort:** 1 day
**Priority:** High

### Phase 2.2: Backend Upload API
- [ ] Create file upload endpoints
- [ ] Implement multipart upload for large files
- [ ] Add file validation and sanitization
- [ ] Create presigned URL generation
- [ ] Implement upload progress tracking
- [ ] Add metadata extraction service
- [ ] Create database models and migrations

**Effort:** 4 days
**Priority:** High

### Phase 2.3: Thumbnail Generation Service
- [ ] Set up AWS Lambda for image processing
- [ ] Implement Sharp.js for image resizing
- [ ] Create video thumbnail extraction
- [ ] Add WebP conversion
- [ ] Implement async processing queue
- [ ] Add error handling and retries

**Effort:** 3 days
**Priority:** High

### Phase 2.4: Frontend Upload Interface
- [ ] Create drag-and-drop upload component
- [ ] Implement file selection dialog
- [ ] Add upload progress indicators
- [ ] Create batch upload interface
- [ ] Add file preview before upload
- [ ] Implement client-side validation
- [ ] Add error handling and retry logic

**Effort:** 4 days
**Priority:** High

### Phase 2.5: Upload Optimization
- [ ] Implement chunked uploads
- [ ] Add upload resume capability
- [ ] Optimize for mobile networks
- [ ] Add compression options
- [ ] Implement parallel uploads
- [ ] Add upload queue management

**Effort:** 3 days
**Priority:** Medium

## 🔧 Implementation Details

### Environment Variables
```env
AWS_S3_BUCKET=photovault-storage-prod
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/heic,video/mp4,video/quicktime
```

### Dependencies
**Backend:**
- aws-sdk
- multer
- multer-s3
- sharp (image processing)
- exifr (metadata extraction)
- ffmpeg (video processing)
- uuid

**Frontend:**
- react-dropzone
- aws-sdk (for presigned URLs)
- @tanstack/react-query
- react-use-gesture

### API Endpoints
```
POST /api/upload/initiate        # Start upload session
POST /api/upload/chunk           # Upload file chunk
POST /api/upload/complete        # Complete upload
GET  /api/upload/presigned       # Get presigned URL
POST /api/upload/metadata        # Extract metadata
GET  /api/files/:id/thumbnails   # Get thumbnail URLs
DELETE /api/files/:id            # Delete file
```

## 🧪 Testing Strategy

### Unit Tests
- File validation functions
- Metadata extraction
- Thumbnail generation
- S3 upload utilities

### Integration Tests
- Complete upload flow
- Thumbnail generation pipeline
- Metadata extraction pipeline
- Error handling scenarios

### Load Tests
- Concurrent upload performance
- Large file upload stability
- Thumbnail generation performance

## 🚀 Deployment Considerations

- S3 bucket policies and permissions
- Lambda function configuration
- CloudFront cache settings
- Environment-specific bucket names
- Monitoring and alerting setup

## 📊 Success Metrics

- Upload success rate > 99.5%
- Average upload time < 30 seconds for 10MB files
- Thumbnail generation success rate > 99%
- Average thumbnail generation time < 5 seconds
- Storage cost per GB < $0.025/month

## 🔗 Related Features

- [Database Schema](./03-database-schema.md) - File metadata storage
- [AWS Infrastructure](./04-aws-infrastructure.md) - S3 and Lambda setup
- [Image Optimization](./25-image-optimization.md) - Performance optimization
- [Metadata Extraction](./09-metadata-extraction.md) - EXIF and GPS data
