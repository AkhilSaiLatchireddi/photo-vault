# 🔐 Production Security & Configuration Guide

## 🎯 **Frontend Environment Variables**

### **GitHub Repository Secrets**
Go to: `https://github.com/AkhilSaiLatchireddi/photo-vault/settings/secrets/actions`

Add these secrets:
```
VITE_API_BASE_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
VITE_AUTH0_DOMAIN=your-app.auth0.com  
VITE_AUTH0_CLIENT_ID=your-auth0-client-id-here
```

### **Frontend Configuration File**

Create `frontend/src/config/env.ts`:
```typescript
// Frontend environment configuration
export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  AUTH0_DOMAIN: import.meta.env.VITE_AUTH0_DOMAIN || '',
  AUTH0_CLIENT_ID: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
  ENVIRONMENT: import.meta.env.NODE_ENV || 'development',
  
  // Derived values
  get isProduction() {
    return this.ENVIRONMENT === 'production';
  },
  
  get isDevelopment() {
    return this.ENVIRONMENT === 'development';
  }
};

// Validation
if (config.isProduction) {
  if (!config.AUTH0_DOMAIN || !config.AUTH0_CLIENT_ID) {
    throw new Error('Missing required Auth0 configuration for production');
  }
}
```

## 🛡️ **Auth0 Configuration**

### **Update Auth0 Settings**

1. **Allowed Callback URLs**:
```
http://localhost:3000,
https://akhilsailatchireddi.github.io/photo-vault
```

2. **Allowed Logout URLs**:
```
http://localhost:3000,
https://akhilsailatchireddi.github.io/photo-vault
```

3. **Allowed Web Origins**:
```
http://localhost:3000,
https://akhilsailatchireddi.github.io
```

4. **Allowed Origins (CORS)**:
```
http://localhost:3000,
https://akhilsailatchireddi.github.io
```

### **Update Frontend Auth Configuration**

Update your `frontend/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App.tsx';
import './index.css';
import { config } from './config/env';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider
      domain={config.AUTH0_DOMAIN}
      clientId={config.AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: config.isProduction 
          ? 'https://akhilsailatchireddi.github.io/photo-vault'
          : window.location.origin,
        audience: config.API_BASE_URL
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>,
);
```

## 🔧 **Backend Security Configuration**

### **Update CORS Settings**

Update `backend/src/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.github.com"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://akhilsailatchireddi.github.io'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

## 🔐 **AWS Secrets Management**

### **Store Secrets in AWS SSM Parameter Store**

```bash
#!/bin/bash
# Script: setup-aws-secrets.sh

# Set your values here
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/photovault"
JWT_SECRET="your-super-secret-jwt-key-min-32-characters-long"
S3_BUCKET="photovault-storage-prod"
AUTH0_DOMAIN="your-app.auth0.com"
AUTH0_CLIENT_ID="your-auth0-client-id"

# Store in AWS SSM Parameter Store
aws ssm put-parameter \
  --name "/photovault/prod/mongodb-uri" \
  --value "$MONGODB_URI" \
  --type "SecureString" \
  --description "MongoDB connection URI for PhotoVault"

aws ssm put-parameter \
  --name "/photovault/prod/jwt-secret" \
  --value "$JWT_SECRET" \
  --type "SecureString" \
  --description "JWT secret for PhotoVault"

aws ssm put-parameter \
  --name "/photovault/prod/s3-bucket" \
  --value "$S3_BUCKET" \
  --type "String" \
  --description "S3 bucket name for PhotoVault"

aws ssm put-parameter \
  --name "/photovault/prod/auth0-domain" \
  --value "$AUTH0_DOMAIN" \
  --type "String" \
  --description "Auth0 domain for PhotoVault"

aws ssm put-parameter \
  --name "/photovault/prod/auth0-client-id" \
  --value "$AUTH0_CLIENT_ID" \
  --type "String" \
  --description "Auth0 client ID for PhotoVault"

echo "✅ All secrets stored in AWS SSM Parameter Store"
```

### **AWS IAM Permissions for Lambda**

Create IAM policy for your Lambda execution role:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/photovault/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::photovault-storage-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::photovault-storage-*"
    }
  ]
}
```

## 🛠️ **S3 Bucket Security**

### **Bucket Policy (Strict)**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::photovault-storage-prod",
        "arn:aws:s3:::photovault-storage-prod/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    },
    {
      "Sid": "AllowApplicationAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR-ACCOUNT-ID:role/photovault-lambda-role"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::photovault-storage-prod/*"
    }
  ]
}
```

### **CORS Configuration for S3**
```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": [
        "https://akhilsailatchireddi.github.io"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

## 📱 **API Security Headers**

Add to your backend middleware:
```typescript
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
});
```

## 🔍 **Environment Validation**

Create `backend/src/config/validation.ts`:
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  AWS_REGION: z.string().default('us-east-1'),
  S3_BUCKET_NAME: z.string(),
  AUTH0_DOMAIN: z.string(),
  AUTH0_CLIENT_ID: z.string(),
});

export const config = envSchema.parse(process.env);
```

## 🚨 **Security Checklist**

### ✅ **Production Readiness**

- [ ] All secrets in AWS SSM Parameter Store (not in code)
- [ ] CORS properly configured for your domain
- [ ] Rate limiting enabled
- [ ] Security headers implemented
- [ ] HTTPS enforced everywhere
- [ ] S3 bucket not publicly accessible
- [ ] Auth0 URLs configured for production
- [ ] Environment validation in place
- [ ] Error handling doesn't expose sensitive data
- [ ] Logging configured (but not logging secrets)

### 🔒 **Security Features Implemented**

- **Authentication**: Auth0 JWT tokens
- **Authorization**: User-specific resource access
- **CORS**: Restricted to your domain
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Prevent injection attacks
- **Secure Headers**: XSS and clickjacking protection
- **HTTPS Only**: All communication encrypted
- **Secret Management**: AWS SSM Parameter Store

## 📊 **Monitoring & Alerting**

Set up CloudWatch alarms for:
- Lambda errors
- API Gateway 5xx errors
- High request rates
- S3 access errors

## 🆘 **Emergency Procedures**

### **Rotate Secrets**
```bash
# Generate new JWT secret
NEW_JWT_SECRET=$(openssl rand -base64 32)

# Update in SSM
aws ssm put-parameter \
  --name "/photovault/prod/jwt-secret" \
  --value "$NEW_JWT_SECRET" \
  --type "SecureString" \
  --overwrite

# Redeploy
serverless deploy --stage prod
```

### **Disable API (Emergency)**
```bash
# Temporarily disable API Gateway stage
aws apigateway update-stage \
  --rest-api-id YOUR-API-ID \
  --stage-name prod \
  --patch-ops op=replace,path=/throttle/rateLimit,value=0
```

This setup gives you enterprise-grade security while keeping costs minimal! 🚀
