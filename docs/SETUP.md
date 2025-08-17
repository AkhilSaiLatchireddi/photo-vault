# PhotoVault Setup Guide

## 🚀 Quick Start Instructions

### Prerequisites
- Node.js 18+ installed
- AWS account with credits
- MongoDB Atlas account for database
- Git for version control

### 1. Install Dependencies
```bash
# Install root dependencies
npm install

# Install frontend and backend dependencies
npm run install:all
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env.local

# Edit the .env.local file with your AWS credentials and database details
```

### 3. Required Environment Variables
```env
# AWS Configuration (Get from AWS Console)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET=photovault-storage-dev

# MongoDB Atlas Configuration
MONGODB_USERNAME=your_mongodb_username
MONGODB_PASSWORD=your_mongodb_password

# MongoDB Configuration
MONGODB_USERNAME=your_mongodb_username
MONGODB_PASSWORD=your_mongodb_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 4. AWS Setup Required
Before running the app, you need to set up these AWS services:

#### S3 Bucket
- Create an S3 bucket for photo storage
- Enable CORS for web uploads
- Set up lifecycle policies for cost optimization

#### MongoDB Atlas Setup
- Set up MongoDB Atlas cluster
- Or use local MongoDB for development

### 5. Run Development Servers
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:frontend  # Runs on http://localhost:3000
npm run dev:backend   # Runs on http://localhost:3001
```

## 📁 Project Structure Explanation

```
photovault/
├── frontend/                 # Next.js 14 frontend
│   ├── app/                 # App router pages
│   ├── components/          # Reusable components
│   ├── lib/                # Utilities and configurations
│   └── public/             # Static assets
├── backend/                 # Node.js/Express API
│   ├── src/                # Source code
│   ├── data/               # Database files (MongoDB connection)
│   └── dist/               # Compiled JavaScript
├── features/                # Detailed feature specifications
│   ├── 01-authentication.md
│   ├── 02-file-upload.md
│   ├── 12-memories.md
│   └── ... (32+ feature files)
├── infrastructure/          # AWS CDK/Terraform (future)
└── docs/                   # Documentation
```

## 🎯 Development Workflow

### Phase 1: Core Setup (Week 1-2)
1. **Authentication System**
   - Implement MongoDB integration
   - Create login/register forms
   - Set up protected routes

2. **File Upload**
   - S3 integration for photo storage
   - Basic upload interface
   - Thumbnail generation

3. **Photo Gallery**
   - Display uploaded photos
   - Basic photo viewer
   - Responsive grid layout

### Phase 2: Enhanced Features (Week 3-4)
1. **Photo Organization**
   - Albums and collections
   - Metadata extraction
   - Basic search

2. **User Experience**
   - Improved photo viewer
   - Mobile optimizations
   - Performance improvements

### Phase 3: Smart Features (Month 2+)
1. **Memories Feature**
   - AI-powered photo collections
   - Location-based memories
   - Time-based memories

2. **Advanced Search**
   - AI-powered tagging
   - Face recognition
   - Object detection

## 🔧 Technical Architecture

### Frontend (Next.js 14)
- **Framework**: Next.js with App Router
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Query for server state
- **Authentication**: AWS Amplify
- **File Upload**: React Dropzone with S3 integration

### Backend (Node.js/Express)
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with middleware
- **Database**: MongoDB with native driver
- **Authentication**: JWT with custom user management
- **File Processing**: Sharp.js for images, FFmpeg for videos

### AWS Services
- **S3**: Photo and video storage with lifecycle policies
- **MongoDB Atlas**: Database for user data and metadata
- **MongoDB Atlas**: Database for user data and metadata
- **Lambda**: Image processing and thumbnail generation
- **CloudFront**: CDN for fast image delivery

## 📊 Cost Optimization

### Storage Costs
- S3 Intelligent Tiering for automatic cost optimization
- Lifecycle policies to move old photos to cheaper storage classes
- CloudFront caching to reduce bandwidth costs

### Compute Costs
- Lambda for serverless image processing
- ECS Fargate for containerized hosting (production)
- MongoDB Atlas for database scaling

### Expected Monthly Costs (1000 photos/month)
- S3 Storage: ~$2-5/month
- Lambda Processing: ~$1-2/month
- MongoDB Atlas: ~$9-25/month (depending on usage)
- CloudFront: ~$1-3/month
- **Total**: ~$15-30/month

## 🚨 Important Notes

### Security
- Never commit AWS credentials to git
- Use IAM roles with minimal permissions
- Enable MFA on your AWS account
- Regular security audits

### Development
- Start with Phase 1 features before moving to advanced features
- Test each feature thoroughly before deployment
- Follow the detailed sub-tasks in feature files
- Use the provided TypeScript types for better development experience

### Production Deployment
- Use environment-specific AWS resources
- Set up monitoring and alerting
- Implement proper backup strategies
- Use CloudFormation or CDK for infrastructure as code

## 📚 Learning Resources

### AWS Documentation
- [S3 Developer Guide](https://docs.aws.amazon.com/s3/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)

### Framework Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [MongoDB Documentation](https://docs.mongodb.com/)

## 🤝 Need Help?

1. Check the feature files in `features/` directory for detailed specifications
2. Review the `ROADMAP.md` for development phases
3. Check AWS documentation for service-specific issues
4. Use the health check endpoint: `http://localhost:3001/health`

Ready to build your personal Google Photos alternative! 🚀
