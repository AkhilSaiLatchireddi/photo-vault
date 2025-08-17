# 🚀 PhotoVault - Getting Started Guide

Welcome to PhotoVault! This guide will help you get your personal photo storage app up and running.

## 📋 Prerequisites Checklist

Before you begin, make sure you have:

- [ ] **Node.js 18+** installed ([Download here](https://nodejs.org/))
- [ ] **AWS Account** with some credits
- [ ] **MongoDB Atlas** account (free tier available)
- [ ] **Git** for version control
- [ ] **Code editor** (VS Code recommended)

## 🎯 Quick Start (15 minutes)

### Step 1: Install Dependencies
```bash
# Navigate to your project directory
cd /Users/asailatchireddi/Desktop/temp2

# Install all dependencies
npm install
npm run install:all
```

### Step 2: Environment Setup
```bash
# Copy the environment template
cp .env.example .env.local

# Open the file and add your credentials
code .env.local  # or use your preferred editor
```

**Required Environment Variables:**
```env
# AWS Configuration (Get from AWS Console > IAM > Users)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here
AWS_S3_BUCKET=photovault-storage-dev

# MongoDB Atlas Configuration
MONGODB_USERNAME=your_mongodb_username
MONGODB_PASSWORD=your_mongodb_password

# JWT Secret (Generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# API URLs
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

### Step 3: Set Up AWS Services

#### Option A: Quick Setup (Manual)
1. **Create S3 Bucket:**
   - Go to AWS Console > S3
   - Create bucket: `photovault-storage-dev`
   - Enable versioning and set to private

2. **Create MongoDB Atlas Cluster:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free account and cluster
   - Set up database access and network access
   - Get your connection credentials

#### Option B: Automated Setup (Recommended)
```bash
# Run the AWS setup script (coming soon)
npm run setup:aws
```

### Step 4: Database Setup
```bash
# Test MongoDB connection
cd backend
npm run test-connection
```

### Step 5: Start Development Servers
```bash
# Start both frontend and backend
npm run dev

# This will start:
# - Backend API on http://localhost:3001
# - Frontend app on http://localhost:3000
```

### Step 6: Test Your Setup
1. Open http://localhost:3000 in your browser
2. You should see the PhotoVault homepage
3. Check backend health: http://localhost:3001/health
4. Try creating an account (custom JWT authentication)

## 🛠️ Development Workflow

### Phase 1: Authentication (Week 1)
- [ ] Complete MongoDB Atlas setup
- [ ] Test user registration and login
- [ ] Implement password reset
- [ ] Add form validation

### Phase 2: File Upload (Week 2)
- [ ] Set up S3 bucket policies
- [ ] Implement drag-and-drop upload
- [ ] Add thumbnail generation
- [ ] Test file upload flow

### Phase 3: Photo Gallery (Week 3)
- [ ] Create photo grid component
- [ ] Implement photo viewer
- [ ] Add basic metadata display
- [ ] Make mobile responsive

## 🚨 Common Issues & Solutions

### 1. "Cannot find module" errors
```bash
# Delete node_modules and reinstall
rm -rf node_modules frontend/node_modules backend/node_modules
npm run install:all
```

### 2. Database connection errors
```bash
# Check if MongoDB is accessible
npm run test-connection

# Create database if it doesn't exist
createdb photovault_dev

# Reset MongoDB data (remove collections)
# This would need to be done through MongoDB Atlas interface
```

### 3. AWS Authentication errors
- Verify your AWS credentials in `.env.local`
- Check IAM permissions for S3 access
- Ensure regions match across all services

### 4. Port already in use
```bash
# Kill processes on ports 3000 and 3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

## 📊 Project Structure

```
photovault/
├── frontend/                    # Next.js React app
│   ├── app/                    # App router pages
│   ├── components/             # React components
│   ├── contexts/              # React contexts (auth, etc.)
│   └── lib/                   # Utilities
├── backend/                     # Node.js API server
│   ├── src/
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Express middleware
│   │   └── validators/        # Input validation
│   └── data/                  # MongoDB connection files
├── features/                    # Feature specifications
└── docs/                       # Documentation
```

## 🎯 Next Steps

Once you have the basic app running:

1. **Read Feature Specifications**: Check the `features/` directory for detailed implementation guides
2. **Follow the Roadmap**: Use `ROADMAP.md` for development phases
3. **AWS Setup**: Complete AWS infrastructure using `AWS_SETUP.md`
4. **Start Coding**: Begin with authentication feature (`features/01-authentication.md`)

## 🆘 Need Help?

- **Documentation**: Check the `features/` directory for detailed guides
- **AWS Issues**: Review `AWS_SETUP.md` for service configuration
- **Development**: Use `ROADMAP.md` for implementation order
- **Architecture**: See `README.md` for technical overview

## 🎉 What's Next?

Your PhotoVault foundation is ready! Start with:

1. **Authentication**: Get user login/register working
2. **File Upload**: Enable photo uploads to S3
3. **Gallery**: Display uploaded photos
4. **Memories**: Build the AI-powered memories feature

Happy coding! 🚀 You're building something amazing - your own personal Google Photos alternative with unlimited storage and complete data ownership.
