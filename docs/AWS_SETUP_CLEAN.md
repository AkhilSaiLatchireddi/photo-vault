# AWS Setup Guide for PhotoVault

This guide covers setting up AWS services for PhotoVault with MongoDB Atlas as the database.

## Prerequisites

- AWS CLI installed and configured
- MongoDB Atlas account (free tier available)
- Basic knowledge of AWS services

## 1. S3 Bucket Setup

### Create S3 Bucket
```bash
aws s3 mb s3://photovault-storage-dev --region us-east-1
```

### Configure CORS
```bash
cat > bucket-cors.json << EOF
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
            "ExposeHeaders": ["ETag"]
        }
    ]
}
EOF

aws s3api put-bucket-cors --bucket photovault-storage-dev --cors-configuration file://bucket-cors.json
```

### Enable Versioning
```bash
aws s3api put-bucket-versioning --bucket photovault-storage-dev --versioning-configuration Status=Enabled
```

## 2. MongoDB Atlas Setup

we use MongoDB Atlas for the database:

1. **Create Account**: Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. **Create Cluster**: Choose the free M0 tier for development
3. **Database Access**: Create a database user with read/write permissions
4. **Network Access**: Add your IP address to the whitelist (or 0.0.0.0/0 for development)
5. **Get Connection String**: Copy the connection string for your application

## 3. IAM Roles and Policies

### Create IAM Policy for S3 Access
```bash
cat > s3-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::photovault-storage-dev/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::photovault-storage-dev"
        }
    ]
}
EOF

aws iam create-policy \
    --policy-name PhotoVaultS3Policy \
    --policy-document file://s3-policy.json
```

### Create IAM User for Application
```bash
aws iam create-user --user-name photovault-app-user

aws iam attach-user-policy \
    --user-name photovault-app-user \
    --policy-arn arn:aws:iam::YOUR-ACCOUNT-ID:policy/PhotoVaultS3Policy

aws iam create-access-key --user-name photovault-app-user
```

## 4. CloudFront Distribution (Optional)

For better performance and CDN capabilities:

```bash
aws cloudfront create-distribution --distribution-config '{
    "CallerReference": "photovault-'$(date +%s)'",
    "Comment": "PhotoVault CDN",
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-photovault-storage-dev",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {"Forward": "none"}
        },
        "MinTTL": 0
    },
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-photovault-storage-dev",
                "DomainName": "photovault-storage-dev.s3.amazonaws.com",
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                }
            }
        ]
    },
    "Enabled": true
}'
```

## 5. Environment Configuration

Update your `.env` file with the AWS and MongoDB credentials:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
S3_BUCKET_NAME=photovault-storage-dev

# MongoDB Configuration
MONGODB_USERNAME=your_mongodb_username
MONGODB_PASSWORD=your_mongodb_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

## 6. Testing Setup

### Test S3 Access
```bash
# Upload a test file
echo "test content" > test.txt
aws s3 cp test.txt s3://photovault-storage-dev/test.txt

# Download the file
aws s3 cp s3://photovault-storage-dev/test.txt downloaded-test.txt

# Clean up
aws s3 rm s3://photovault-storage-dev/test.txt
rm test.txt downloaded-test.txt
```

### Test MongoDB Connection
Use the provided test script in your backend:
```bash
cd backend
npm run test-connection
```

## 7. Security Best Practices

1. **S3 Bucket**: Never make your bucket publicly readable
2. **IAM**: Use least-privilege access policies
3. **MongoDB**: Use strong passwords and IP whitelisting
4. **Environment Variables**: Never commit secrets to version control
5. **HTTPS**: Always use HTTPS in production

## 8. Cost Optimization

- **S3**: Use Intelligent Tiering for automatic cost optimization
- **MongoDB Atlas**: Start with M0 (free) tier, upgrade as needed
- **CloudFront**: Use only if you need CDN capabilities

## Troubleshooting

### Common Issues

1. **S3 Access Denied**: Check IAM policies and bucket permissions
2. **MongoDB Connection**: Verify IP whitelist and credentials
3. **CORS Issues**: Ensure proper CORS configuration on S3 bucket

### Useful Commands

```bash
# Check S3 bucket policy
aws s3api get-bucket-policy --bucket photovault-storage-dev

# List IAM policies for user
aws iam list-attached-user-policies --user-name photovault-app-user

# Test MongoDB connection
mongosh "mongodb+srv://username:password@cluster.mongodb.net/photovault"
```

## Next Steps

1. Set up your MongoDB Atlas cluster
2. Configure AWS credentials
3. Test the setup with the provided scripts
4. Deploy your application

For development, you can use the free tiers of both AWS and MongoDB Atlas to get started without any costs.
