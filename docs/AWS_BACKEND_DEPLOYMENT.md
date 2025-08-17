# AWS Backend Deployment Guide

## 🚀 **Deployment Options (Ranked by Complexity & Cost)**

### **Option 1: AWS Lambda + API Gateway (Recommended for Starting)**
**Cost**: ~$0-5/month for low traffic
**Complexity**: Medium
**Scalability**: Excellent

```bash
# Install Serverless Framework
npm install -g serverless
serverless create --template aws-nodejs-typescript --path backend-serverless
```

### **Option 2: AWS ECS Fargate (Recommended for Production)**
**Cost**: ~$15-30/month
**Complexity**: Medium-High
**Scalability**: Excellent

### **Option 3: AWS EC2 (Traditional)**
**Cost**: ~$10-20/month
**Complexity**: Low-Medium
**Scalability**: Manual

## 🎯 **Recommended Approach: Lambda + API Gateway**

### **Step 1: Prepare Lambda-Compatible Backend**

Create `backend/serverless.yml`:
```yaml
service: photovault-backend

provider:
  name: aws
  runtime: nodejs18.x
  region: ${opt:region, 'us-east-1'}
  stage: ${opt:stage, 'dev'}
  
  environment:
    MONGODB_URI: ${ssm:/photovault/${self:provider.stage}/mongodb-uri}
    JWT_SECRET: ${ssm:/photovault/${self:provider.stage}/jwt-secret}
    AWS_S3_BUCKET: ${ssm:/photovault/${self:provider.stage}/s3-bucket}
    AUTH0_DOMAIN: ${ssm:/photovault/${self:provider.stage}/auth0-domain}
    AUTH0_CLIENT_ID: ${ssm:/photovault/${self:provider.stage}/auth0-client-id}
    
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - s3:GetObject
            - s3:PutObject
            - s3:DeleteObject
          Resource: "arn:aws:s3:::photovault-storage-${self:provider.stage}/*"
        - Effect: Allow
          Action:
            - s3:ListBucket
          Resource: "arn:aws:s3:::photovault-storage-${self:provider.stage}"

functions:
  app:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors:
            origin: https://akhilsailatchireddi.github.io
            headers:
              - Content-Type
              - X-Amz-Date
              - Authorization
              - X-Api-Key
              - X-Amz-Security-Token
              - X-Amz-User-Agent
            allowCredentials: true

plugins:
  - serverless-offline
  - serverless-plugin-typescript
```

### **Step 2: Create Lambda Handler**

Create `backend/src/lambda.ts`:
```typescript
import serverless from 'serverless-http';
import app from './index';

export const handler = serverless(app);
```

### **Step 3: AWS Systems Manager (SSM) for Secrets**

```bash
# Store secrets in AWS SSM Parameter Store
aws ssm put-parameter \
  --name "/photovault/prod/mongodb-uri" \
  --value "your-mongodb-connection-string" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/photovault/prod/jwt-secret" \
  --value "your-super-secret-jwt-key" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/photovault/prod/s3-bucket" \
  --value "photovault-storage-prod" \
  --type "String"

aws ssm put-parameter \
  --name "/photovault/prod/auth0-domain" \
  --value "your-auth0-domain" \
  --type "String"

aws ssm put-parameter \
  --name "/photovault/prod/auth0-client-id" \
  --value "your-auth0-client-id" \
  --type "String"
```

### **Step 4: Deploy Commands**

```bash
# Install dependencies
cd backend
npm install serverless serverless-offline serverless-plugin-typescript

# Build
npm run build

# Deploy to development
serverless deploy --stage dev

# Deploy to production
serverless deploy --stage prod
```

## 🔒 **Security & Secrets Management**

### **1. Environment Variables (Frontend)**
Store in GitHub Secrets:
- `VITE_API_BASE_URL`: `https://your-api-gateway-url.amazonaws.com/prod`
- `VITE_AUTH0_DOMAIN`: `your-app.auth0.com`
- `VITE_AUTH0_CLIENT_ID`: `your-auth0-client-id`

### **2. Backend Secrets (AWS SSM)**
All sensitive data stored in AWS Systems Manager Parameter Store:
- Database connection strings
- JWT secrets
- API keys
- Auth0 credentials

### **3. CORS Configuration**
Update your backend to allow GitHub Pages origin:

```typescript
// backend/src/index.ts
app.use(cors({
  origin: [
    'http://localhost:3000', // Development
    'https://akhilsailatchireddi.github.io' // Production
  ],
  credentials: true
}));
```

## 📊 **Cost Breakdown**

### **Monthly Costs (Estimated)**
- **Lambda**: $0-5 (1M requests free)
- **API Gateway**: $0-3 (1M requests = $3.50)
- **S3**: $1-5 (50GB storage)
- **MongoDB Atlas**: $0 (512MB free tier)
- **GitHub Pages**: Free
- **Total**: $1-13/month

### **Free Tier Benefits**
- Lambda: 1M requests + 400k GB-seconds free
- API Gateway: 1M API calls free
- S3: 5GB free storage
- MongoDB Atlas: 512MB free

## 🚀 **Alternative: ECS Fargate (For Scaling)**

If you need more control or expect high traffic:

Create `backend/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
EXPOSE 3001

CMD ["node", "dist/index.js"]
```

Create `docker-compose.yml` for local testing:
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://localhost:27017/photovault
```

## 🔧 **CI/CD Pipeline for Backend**

Create `.github/workflows/deploy-backend.yml`:
```yaml
name: Deploy Backend to AWS

on:
  push:
    branches: [main]
    paths: ['backend/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: cd backend && npm ci
        
      - name: Build
        run: cd backend && npm run build
        
      - name: Deploy to AWS
        run: cd backend && npx serverless deploy --stage prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## 📝 **Next Steps**

1. **Set up AWS CLI** with your credentials
2. **Choose deployment method** (Lambda recommended)
3. **Store secrets** in AWS SSM
4. **Update CORS** settings
5. **Deploy and test**

## 🆘 **Support Commands**

```bash
# Test Lambda locally
serverless offline

# View logs
serverless logs -f app --tail

# Remove deployment
serverless remove
```
