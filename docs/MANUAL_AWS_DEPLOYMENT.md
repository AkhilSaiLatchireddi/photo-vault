# 🔧 Manual AWS Deployment Guide for PhotoVault

## 📋 **Prerequisites**

1. AWS Account with billing set up
2. AWS CLI installed and configured
3. MongoDB Atlas account (free tier)
4. Auth0 account (free tier)
5. Node.js 18+ installed

## 🏗️ **Part 1: AWS Setup**

### **Step 1: Configure AWS CLI**

```bash
# Install AWS CLI if not already installed
# macOS:
brew install awscli

# Configure with your credentials
aws configure
```

Enter when prompted:
- **AWS Access Key ID**: Your access key
- **AWS Secret Access Key**: Your secret key  
- **Default region**: `us-east-1`
- **Default output format**: `json`

### **Step 2: Create S3 Bucket Manually**

```bash
# Set your unique bucket name
export S3_BUCKET_NAME="photovault-storage-$(whoami)-prod"

# Create the bucket
aws s3 mb "s3://$S3_BUCKET_NAME" --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket "$S3_BUCKET_NAME" \
  --versioning-configuration Status=Enabled

echo "✅ S3 bucket created: $S3_BUCKET_NAME"
```

### **Step 3: Configure S3 CORS**

```bash
# Create CORS configuration file
cat > /tmp/bucket-cors.json << 'EOF'
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": [
                "http://localhost:3000",
                "https://akhilsailatchireddi.github.io"
            ],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF

# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket "$S3_BUCKET_NAME" \
  --cors-configuration file:///tmp/bucket-cors.json

# Clean up
rm /tmp/bucket-cors.json

echo "✅ CORS configuration applied"
```

### **Step 4: Create IAM Role for Lambda**

```bash
# Create trust policy for Lambda
cat > /tmp/lambda-trust-policy.json << 'EOF'
{
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
}
EOF

# Create the IAM role
aws iam create-role \
  --role-name PhotoVaultLambdaRole \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name PhotoVaultLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

echo "✅ IAM role created: PhotoVaultLambdaRole"
```

### **Step 5: Create Custom IAM Policy for S3 and SSM Access**

```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create custom policy for S3 and SSM access
cat > /tmp/photovault-policy.json << EOF
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
            "Resource": "arn:aws:s3:::$S3_BUCKET_NAME/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::$S3_BUCKET_NAME"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameter",
                "ssm:GetParameters",
                "ssm:GetParametersByPath"
            ],
            "Resource": "arn:aws:ssm:us-east-1:$ACCOUNT_ID:parameter/photovault/*"
        }
    ]
}
EOF

# Create the policy
aws iam create-policy \
  --policy-name PhotoVaultS3SSMPolicy \
  --policy-document file:///tmp/photovault-policy.json

# Attach the policy to the role
aws iam attach-role-policy \
  --role-name PhotoVaultLambdaRole \
  --policy-arn "arn:aws:iam::$ACCOUNT_ID:policy/PhotoVaultS3SSMPolicy"

# Clean up
rm /tmp/lambda-trust-policy.json /tmp/photovault-policy.json

echo "✅ Custom IAM policy created and attached"
```

## 🔐 **Part 2: Store Secrets in AWS Systems Manager**

### **Step 6: Set Up MongoDB Atlas**

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (choose M0 free tier)
4. Create a database user:
   - Database Access → Add New Database User
   - Username: `photovault-user`
   - Password: Generate a secure password
   - Database User Privileges: Read and write to any database
5. Add network access:
   - Network Access → Add IP Address
   - Add `0.0.0.0/0` (allows access from anywhere - needed for Lambda)
6. Get connection string:
   - Cluster → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your database user password

### **Step 7: Store Secrets in AWS SSM Parameter Store**

```bash
# You'll need to replace these with your actual values
echo "📝 Please provide the following information:"

read -p "MongoDB Connection URI: " MONGODB_URI
read -p "Auth0 Domain (e.g., your-app.auth0.com): " AUTH0_DOMAIN  
read -p "Auth0 Client ID: " AUTH0_CLIENT_ID

# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Store all secrets in SSM Parameter Store
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
  --value "$S3_BUCKET_NAME" \
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

## 🚀 **Part 3: Deploy Lambda Function**

### **Step 8: Prepare Your Backend Code**

```bash
# Navigate to your project
cd /Users/asailatchireddi/Documents/intrest-projects/photo-vault

# Install backend dependencies
cd backend
npm install

# Install serverless dependencies
npm install serverless-http serverless serverless-offline serverless-plugin-typescript

# Build the backend
npm run build

echo "✅ Backend code prepared"
```

### **Step 9: Create Lambda Function Manually**

```bash
# Get the role ARN
ROLE_ARN=$(aws iam get-role --role-name PhotoVaultLambdaRole --query 'Role.Arn' --output text)

# Create an ultra-optimized deployment package (2MB instead of 500MB!)
./scripts/deploy-lambda-minimal.sh

# The minimal package will be created as photovault-lambda-minimal.zip

# Create the Lambda function
aws lambda create-function \
  --function-name photovault-api \
  --runtime nodejs18.x \
  --role "$ROLE_ARN" \
  --handler lambda.handler \
  --zip-file fileb://photovault-lambda-minimal.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{
    NODE_ENV=production,
    AWS_REGION=us-east-1,
    MONGODB_URI=\${ssm:/photovault/prod/mongodb-uri},
    JWT_SECRET=\${ssm:/photovault/prod/jwt-secret},
    S3_BUCKET_NAME=\${ssm:/photovault/prod/s3-bucket},
    AUTH0_DOMAIN=\${ssm:/photovault/prod/auth0-domain},
    AUTH0_CLIENT_ID=\${ssm:/photovault/prod/auth0-client-id}
  }"

echo "✅ Lambda function created: photovault-api"
```

### **Step 10: Create API Gateway**

```bash
# Create REST API
API_ID=$(aws apigateway create-rest-api \
  --name photovault-api \
  --description "PhotoVault API Gateway" \
  --query 'id' \
  --output text)

echo "API ID: $API_ID"

# Get the root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id "$API_ID" \
  --query 'items[0].id' \
  --output text)

# Create a proxy resource
PROXY_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id "$API_ID" \
  --parent-id "$ROOT_RESOURCE_ID" \
  --path-part "{proxy+}" \
  --query 'id' \
  --output text)

# Create ANY method for proxy resource
aws apigateway put-method \
  --rest-api-id "$API_ID" \
  --resource-id "$PROXY_RESOURCE_ID" \
  --http-method ANY \
  --authorization-type NONE

# Get Lambda function ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name photovault-api \
  --query 'Configuration.FunctionArn' \
  --output text)

# Set up integration
aws apigateway put-integration \
  --rest-api-id "$API_ID" \
  --resource-id "$PROXY_RESOURCE_ID" \
  --http-method ANY \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"

# Add permission for API Gateway to invoke Lambda
aws lambda add-permission \
  --function-name photovault-api \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:$ACCOUNT_ID:$API_ID/*/*"

# Deploy the API
aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --stage-name prod

# Get the API endpoint
API_ENDPOINT="https://$API_ID.execute-api.us-east-1.amazonaws.com/prod"

echo "✅ API Gateway created and deployed"
echo "🌐 Your API endpoint: $API_ENDPOINT"
```

## 🔧 **Part 4: Configure CORS for API Gateway**

```bash
# Create OPTIONS method for CORS preflight
aws apigateway put-method \
  --rest-api-id "$API_ID" \
  --resource-id "$PROXY_RESOURCE_ID" \
  --http-method OPTIONS \
  --authorization-type NONE

# Set up CORS integration
aws apigateway put-integration \
  --rest-api-id "$API_ID" \
  --resource-id "$PROXY_RESOURCE_ID" \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}'

# Set up CORS method response
aws apigateway put-method-response \
  --rest-api-id "$API_ID" \
  --resource-id "$PROXY_RESOURCE_ID" \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": false,
    "method.response.header.Access-Control-Allow-Methods": false,
    "method.response.header.Access-Control-Allow-Origin": false
  }'

# Set up CORS integration response
aws apigateway put-integration-response \
  --rest-api-id "$API_ID" \
  --resource-id "$PROXY_RESOURCE_ID" \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": "\"Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token\"",
    "method.response.header.Access-Control-Allow-Methods": "\"GET,POST,PUT,DELETE,OPTIONS\"",
    "method.response.header.Access-Control-Allow-Origin": "\"https://akhilsailatchireddi.github.io\""
  }'

# Redeploy API
aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --stage-name prod

echo "✅ CORS configured for API Gateway"
```

## 🔍 **Part 5: Test Your Deployment**

```bash
# Test the health endpoint
curl "$API_ENDPOINT/health"

# Expected response: {"status":"OK","message":"PhotoVault API is running",...}

echo "✅ Testing completed"
```

## 📝 **Part 6: Configure Frontend**

### **Step 11: Update GitHub Repository Secrets**

Go to: `https://github.com/AkhilSaiLatchireddi/photo-vault/settings/secrets/actions`

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key ID |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret access key |
| `VITE_API_BASE_URL` | `https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod` |
| `VITE_AUTH0_DOMAIN` | `your-app.auth0.com` |
| `VITE_AUTH0_CLIENT_ID` | Your Auth0 client ID |

**Replace `YOUR-API-ID` with the actual API ID from Step 10!**

### **Step 12: Configure Auth0**

1. Go to your Auth0 Dashboard
2. Navigate to Applications → Your PhotoVault App
3. Update these settings:

**Allowed Callback URLs:**
```
http://localhost:3000, https://akhilsailatchireddi.github.io/photo-vault
```

**Allowed Logout URLs:**
```
http://localhost:3000, https://akhilsailatchireddi.github.io/photo-vault
```

**Allowed Web Origins:**
```
http://localhost:3000, https://akhilsailatchireddi.github.io
```

**Allowed Origins (CORS):**
```
http://localhost:3000, https://akhilsailatchireddi.github.io
```

## 🚀 **Part 7: Deploy Frontend**

```bash
# Commit and push your changes
cd /Users/asailatchireddi/Documents/intrest-projects/photo-vault

git add .
git commit -m "feat: add production configuration and deployment setup"
git push origin main
```

GitHub Actions will automatically deploy your frontend to: `https://akhilsailatchireddi.github.io/photo-vault`

## 🎉 **Verification Steps**

1. **Check S3 bucket**: `aws s3 ls s3://$S3_BUCKET_NAME`
2. **Check Lambda function**: `aws lambda list-functions | grep photovault`
3. **Check API Gateway**: `curl "$API_ENDPOINT/health"`
4. **Check frontend**: Visit `https://akhilsailatchireddi.github.io/photo-vault`

## 🔧 **Updating Your Deployment**

To update Lambda function:
```bash
cd backend
./scripts/deploy-lambda-minimal.sh

aws lambda update-function-code \
  --function-name photovault-api \
  --zip-file fileb://photovault-lambda-minimal.zip
```

## 💰 **Cost Summary**

With this setup, your monthly costs will be:
- **S3**: $1-3 (storage)
- **Lambda**: $0-5 (execution)
- **API Gateway**: $0-3 (requests)
- **MongoDB Atlas**: $0 (free tier)
- **Total**: $1-11/month

## 🆘 **Troubleshooting**

If something goes wrong:

1. **Check Lambda logs**:
   ```bash
   aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/photovault-api"
   ```

2. **Check SSM parameters**:
   ```bash
   aws ssm get-parameter --name "/photovault/prod/mongodb-uri"
   ```

3. **Test API directly**:
   ```bash
   curl -X GET "$API_ENDPOINT/health" -v
   ```

This manual setup gives you complete control and understanding of your AWS infrastructure! 🚀
