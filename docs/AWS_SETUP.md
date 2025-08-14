# AWS Setup Guide for PhotoVault

## 🎯 AWS Services Configuration

This guide will walk you through setting up all the required AWS services for PhotoVault.

## 1. S3 Bucket Setup

### Create S3 Bucket
```bash
# Using AWS CLI
aws s3 mb s3://photovault-storage-dev --region us-east-1
```

### Configure CORS Policy
Create a file `cors-policy.json`:
```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://yourdomain.com"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

Apply CORS policy:
```bash
aws s3api put-bucket-cors --bucket photovault-storage-dev --cors-configuration file://cors-policy.json
```

### Set Lifecycle Policy
Create `lifecycle-policy.json`:
```json
{
    "Rules": [
        {
            "ID": "PhotoVaultLifecycle",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "users/"
            },
            "Transitions": [
                {
                    "Days": 30,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                },
                {
                    "Days": 365,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ]
        }
    ]
}
```

Apply lifecycle policy:
```bash
aws s3api put-bucket-lifecycle-configuration --bucket photovault-storage-dev --lifecycle-configuration file://lifecycle-policy.json
```

## 2. Cognito User Pool Setup

### Create User Pool
```bash
aws cognito-idp create-user-pool \
    --pool-name PhotoVaultUsers \
    --policies '{
        "PasswordPolicy": {
            "MinimumLength": 8,
            "RequireUppercase": true,
            "RequireLowercase": true,
            "RequireNumbers": true,
            "RequireSymbols": true
        }
    }' \
    --auto-verified-attributes email \
    --schema '[
        {
            "Name": "email",
            "AttributeDataType": "String",
            "Required": true,
            "Mutable": true
        },
        {
            "Name": "given_name",
            "AttributeDataType": "String",
            "Required": true,
            "Mutable": true
        },
        {
            "Name": "family_name",
            "AttributeDataType": "String",
            "Required": true,
            "Mutable": true
        }
    ]'
```

### Create User Pool Client
```bash
aws cognito-idp create-user-pool-client \
    --user-pool-id us-east-1_XXXXXXXXX \
    --client-name PhotoVaultWebClient \
    --generate-secret \
    --explicit-auth-flows ADMIN_NO_SRP_AUTH USER_PASSWORD_AUTH \
    --supported-identity-providers COGNITO
```

## 3. IAM Roles and Policies

### Create S3 Access Policy
Create `s3-policy.json`:
```json
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
            "Resource": "arn:aws:s3:::photovault-storage-dev/users/${cognito-identity.amazonaws.com:sub}/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::photovault-storage-dev",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "users/${cognito-identity.amazonaws.com:sub}/*"
                }
            }
        }
    ]
}
```

### Create Lambda Execution Role
```bash
aws iam create-role \
    --role-name PhotoVaultLambdaRole \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "lambda.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }'
```

## 4. RDS PostgreSQL Setup

### Create DB Subnet Group
```bash
aws rds create-db-subnet-group \
    --db-subnet-group-name photovault-subnet-group \
    --db-subnet-group-description "PhotoVault Database Subnet Group" \
    --subnet-ids subnet-12345678 subnet-87654321
```

### Create RDS Instance
```bash
aws rds create-db-instance \
    --db-instance-identifier photovault-db-dev \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --master-username photovault \
    --master-user-password YourSecurePassword123! \
    --allocated-storage 20 \
    --db-subnet-group-name photovault-subnet-group \
    --vpc-security-group-ids sg-12345678
```

## 5. Lambda Function for Image Processing

### Create Lambda Function
```bash
aws lambda create-function \
    --function-name PhotoVaultImageProcessor \
    --runtime nodejs18.x \
    --role arn:aws:iam::123456789012:role/PhotoVaultLambdaRole \
    --handler index.handler \
    --zip-file fileb://image-processor.zip \
    --description "Process uploaded images and generate thumbnails"
```

## 6. CloudFront Distribution

### Create CloudFront Distribution
Create `cloudfront-config.json`:
```json
{
    "CallerReference": "photovault-cf-dev",
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
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-photovault-storage-dev",
        "ViewerProtocolPolicy": "redirect-to-https",
        "MinTTL": 0,
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        }
    },
    "Comment": "PhotoVault CDN",
    "Enabled": true
}
```

```bash
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

## 7. Environment Variables Template

After setting up AWS services, update your `.env.local`:
```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-from-iam
AWS_SECRET_ACCESS_KEY=your-secret-key-from-iam
AWS_S3_BUCKET=photovault-storage-dev
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net

# AWS Cognito
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_CLIENT_SECRET=your-cognito-client-secret

# Database
DATABASE_URL="postgresql://photovault:YourSecurePassword123!@photovault-db-dev.region.rds.amazonaws.com:5432/photovault"

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# API Configuration
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

## 8. Testing AWS Setup

### Test S3 Access
```bash
# Upload test file
aws s3 cp test-image.jpg s3://photovault-storage-dev/test/

# List bucket contents
aws s3 ls s3://photovault-storage-dev/
```

### Test Cognito
```bash
# Create test user
aws cognito-idp admin-create-user \
    --user-pool-id us-east-1_XXXXXXXXX \
    --username testuser \
    --user-attributes Name=email,Value=test@example.com \
    --temporary-password TempPass123! \
    --message-action SUPPRESS
```

## 🔒 Security Best Practices

1. **Use IAM Roles**: Never use root credentials
2. **Principle of Least Privilege**: Grant minimal required permissions
3. **Enable MFA**: On all AWS accounts
4. **Rotate Keys**: Regularly rotate access keys
5. **Monitor Usage**: Set up CloudWatch alarms for unusual activity

## 💰 Cost Monitoring

### Set Up Billing Alerts
```bash
aws budgets create-budget \
    --account-id 123456789012 \
    --budget '{
        "BudgetName": "PhotoVault-Monthly-Budget",
        "BudgetLimit": {
            "Amount": "50",
            "Unit": "USD"
        },
        "TimeUnit": "MONTHLY",
        "BudgetType": "COST"
    }'
```

Your AWS infrastructure is now ready for PhotoVault! 🚀
