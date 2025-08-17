# 🚀 PhotoVault Production Deployment Guide

## Architecture Overview

**Frontend**: GitHub Pages (`https://akhilsailatchireddi.github.io/photo-vault`)  
**Backend**: AWS Lambda + API Gateway  
**Database**: MongoDB Atlas (Free Tier)  
**Storage**: AWS S3  
**Auth**: Auth0  

**Estimated Monthly Cost**: $1-15 (mostly free tiers!)

## 📋 Prerequisites

1. **GitHub Account** (for Pages hosting)
2. **AWS Account** (for backend & storage)
3. **MongoDB Atlas Account** (free tier)
4. **Auth0 Account** (free tier)
5. **Node.js 18+** installed locally
6. **AWS CLI** configured

## 🎯 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Clone and navigate to the project
cd photo-vault

# Run the automated setup script
./scripts/setup-production.sh
```

### Option 2: Manual Setup

Follow the detailed steps below.

## 🔧 Manual Setup Steps

### 1. AWS Setup

#### Configure AWS CLI
```bash
aws configure
# Enter your AWS Access Key ID and Secret Access Key
```

#### Create S3 Bucket
```bash
# Replace with your unique bucket name
export S3_BUCKET="photovault-storage-prod"
aws s3 mb "s3://$S3_BUCKET" --region us-east-1

# Configure CORS
aws s3api put-bucket-cors --bucket "$S3_BUCKET" --cors-configuration file://infrastructure/bucket-cors.json

# Enable versioning
aws s3api put-bucket-versioning --bucket "$S3_BUCKET" --versioning-configuration Status=Enabled
```

#### Store Secrets in AWS SSM Parameter Store
```bash
# MongoDB connection string (from MongoDB Atlas)
aws ssm put-parameter \
  --name "/photovault/prod/mongodb-uri" \
  --value "mongodb+srv://username:password@cluster.mongodb.net/photovault" \
  --type "SecureString"

# JWT Secret (generate a secure random string)
aws ssm put-parameter \
  --name "/photovault/prod/jwt-secret" \
  --value "$(openssl rand -base64 32)" \
  --type "SecureString"

# S3 Bucket Name
aws ssm put-parameter \
  --name "/photovault/prod/s3-bucket" \
  --value "$S3_BUCKET" \
  --type "String"

# Auth0 Configuration
aws ssm put-parameter \
  --name "/photovault/prod/auth0-domain" \
  --value "your-app.auth0.com" \
  --type "String"

aws ssm put-parameter \
  --name "/photovault/prod/auth0-client-id" \
  --value "your-auth0-client-id" \
  --type "String"
```

### 2. MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free M0 cluster
3. Create a database user
4. Add IP address `0.0.0.0/0` to network access (for Lambda)
5. Get the connection string

### 3. Auth0 Setup

#### Configure Auth0 Application Settings

1. **Allowed Callback URLs**:
   ```
   http://localhost:3000, https://akhilsailatchireddi.github.io/photo-vault
   ```

2. **Allowed Logout URLs**:
   ```
   http://localhost:3000, https://akhilsailatchireddi.github.io/photo-vault
   ```

3. **Allowed Web Origins**:
   ```
   http://localhost:3000, https://akhilsailatchireddi.github.io
   ```

4. **Allowed Origins (CORS)**:
   ```
   http://localhost:3000, https://akhilsailatchireddi.github.io
   ```

### 4. GitHub Repository Secrets

Go to: `https://github.com/AkhilSaiLatchireddi/photo-vault/settings/secrets/actions`

Add these secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key | For backend deployment |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key | For backend deployment |
| `VITE_AUTH0_DOMAIN` | `your-app.auth0.com` | Auth0 domain |
| `VITE_AUTH0_CLIENT_ID` | Your Auth0 client ID | Auth0 client ID |
| `VITE_API_BASE_URL` | Will be set after backend deployment | API Gateway URL |

### 5. Deploy Backend

```bash
# Install dependencies
cd backend
npm install

# Install Serverless Framework
npm install -g serverless

# Build the project
npm run build

# Deploy to AWS Lambda
serverless deploy --stage prod

# Note the API Gateway URL from the output
```

### 6. Update Frontend Configuration

After backend deployment, add the API Gateway URL to GitHub secrets:
- Secret name: `VITE_API_BASE_URL`
- Secret value: `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod`

### 7. Deploy Frontend

Push your changes to the `main` branch:
```bash
git add .
git commit -m "feat: add production configuration"
git push origin main
```

The GitHub Action will automatically deploy your frontend to GitHub Pages.

## 🔒 Security Checklist

- [ ] All secrets stored in AWS SSM Parameter Store (not in code)
- [ ] CORS properly configured for your domain only
- [ ] S3 bucket not publicly accessible
- [ ] Rate limiting enabled on API
- [ ] Auth0 URLs configured for production
- [ ] HTTPS enforced everywhere
- [ ] Environment validation in place

## 📊 Monitoring

### AWS CloudWatch
- Lambda function logs
- API Gateway metrics
- Error rates and performance

### Useful Commands
```bash
# View Lambda logs
serverless logs -f api --tail --stage prod

# Check S3 bucket
aws s3 ls s3://your-bucket-name

# Test API endpoint
curl https://your-api-gateway-url.amazonaws.com/prod/health
```

## 🆘 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check S3 bucket CORS configuration
   - Verify backend CORS settings include your GitHub Pages URL

2. **Auth0 Login Issues**
   - Verify callback URLs in Auth0 dashboard
   - Check Auth0 domain and client ID in GitHub secrets

3. **API Gateway Errors**
   - Check Lambda function logs in CloudWatch
   - Verify AWS SSM parameters are accessible

4. **Frontend Build Fails**
   - Check all required GitHub secrets are set
   - Verify environment variable names match

### Debug Commands

```bash
# Test AWS credentials
aws sts get-caller-identity

# Check SSM parameters
aws ssm get-parameter --name "/photovault/prod/mongodb-uri" --with-decryption

# Test S3 access
aws s3 ls s3://your-bucket-name

# View serverless info
cd backend && serverless info --stage prod
```

## 🔄 Updates & Maintenance

### Updating Backend
```bash
cd backend
npm run build
serverless deploy --stage prod
```

### Updating Frontend
Just push to the `main` branch - GitHub Actions will handle deployment.

### Rotating Secrets
```bash
# Generate new JWT secret
NEW_JWT_SECRET=$(openssl rand -base64 32)

# Update in SSM
aws ssm put-parameter \
  --name "/photovault/prod/jwt-secret" \
  --value "$NEW_JWT_SECRET" \
  --type "SecureString" \
  --overwrite

# Redeploy backend
cd backend && serverless deploy --stage prod
```

## 🎉 Success!

Your PhotoVault app should now be live at:
**https://akhilsailatchireddi.github.io/photo-vault**

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Verify all secrets are properly configured
4. Ensure Auth0 URLs are correctly set

## 💰 Cost Optimization

- **S3**: Use Intelligent Tiering for automatic cost optimization
- **Lambda**: Optimize memory allocation based on usage
- **MongoDB**: Monitor usage and upgrade only when needed
- **CloudWatch**: Set up billing alerts

Your app should cost less than $15/month in total! 🚀
