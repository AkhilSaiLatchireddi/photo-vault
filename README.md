# PhotoVault - Personal Photo Storage App

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=flat)](CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security-policy-red.svg?style=flat)](SECURITY.md)

A modern, self-hosted photo storage application similar to Google Photos, built with AWS infrastructure and designed for personal use.

## 🎯 Project Overview

PhotoVault is a comprehensive photo and video storage solution that addresses the limitations of free cloud storage services. Built with modern web technologies and AWS services, it provides unlimited storage capacity (limited only by your AWS budget) with intelligent features like automated organization, memories, and cross-platform accessibility.

## 🚀 Key Features

- **Unlimited Storage**: Store photos and videos in AWS S3
- **Cross-Platform**: Web app with mobile-responsive design
- **Smart Organization**: AI-powered tagging and categorization
- **Memories**: Automated creation of photo memories and highlights
- **Face Recognition**: Group photos by people (future feature)
- **Search**: Intelligent search across photos and metadata
- **Sharing**: Secure photo sharing with family and friends
- **Backup**: Automatic backup from mobile devices

## 🏗️ Architecture

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Node.js with Express and TypeScript
- **Database**: MongoDB for user data and photo metadata
- **Storage**: Amazon S3 for photos and videos
- **CDN**: Amazon CloudFront for fast image delivery
- **Authentication**: JWT with bcrypt password hashing
- **Image Processing**: AWS Lambda for thumbnail generation
- **Search**: Amazon OpenSearch for metadata search
- **Hosting**: AWS ECS/Fargate for containerized deployment

## 📁 Project Structure

```
photovault/
├── frontend/          # Next.js frontend application
├── backend/           # Node.js backend API
├── mobile/           # React Native mobile app (future)
├── infrastructure/   # AWS CDK/Terraform configs
├── docs/            # Documentation
├── features/        # Feature specifications
└── scripts/         # Deployment and utility scripts
```

## 🛠️ Development Phases

### Phase 1: Core Infrastructure (Current)
- Basic project setup
- AWS S3 integration
- User authentication
- Photo upload and storage

### Phase 2: Basic Features
- Photo gallery and viewing
- Basic metadata extraction
- Simple search functionality
- Responsive web interface

### Phase 3: Advanced Features
- AI-powered tagging
- Memories generation
- Face recognition
- Advanced search and filters

### Phase 4: Mobile & Sharing
- Mobile app development
- Sharing capabilities
- Collaborative albums
- Advanced backup features

## 🚀 Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure AWS credentials
4. Set up environment variables
5. Run development server: `npm run dev`

## 📈 Roadmap

See the `features/` directory for detailed feature specifications and development roadmap.

## 🤝 Contributing

This is a personal project, but feel free to fork and adapt for your own use.

## 📄 License

MIT License - feel free to use this for your own personal photo storage needs.
