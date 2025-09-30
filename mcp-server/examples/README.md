# PhotoVault MCP Server Examples

This directory contains practical examples of using the PhotoVault MCP Server with various AI assistants.

## Quick Start Example

### 1. Complete PhotoVault Setup

Here's how to set up a complete PhotoVault environment from scratch:

```
Set up AWS infrastructure with bucket name "my-photovault-prod" for production
```

```
Configure Auth0 with domain "my-app.auth0.com" and client ID "abc123def456"
```

```
Set mongodb-uri to "mongodb+srv://user:pass@cluster.mongodb.net/photovault" for production
Set auth0-client-secret to "your-secret-here" for production
Set jwt-secret to "your-jwt-secret" for production
```

```
Deploy backend to production stage
```

```
Deploy frontend with message "Initial production deployment"
```

```
Check deployment status for all components
```

### 2. Daily Development Workflow

```
Run all tests with coverage report
```

```
Deploy backend to dev stage
Deploy frontend with message "Add photo zoom feature"
```

```
Check deployment status
Analyze costs for last 7 days
```

### 3. Maintenance Tasks

```
Create database backup named "weekly-backup"
```

```
Generate documentation for "Photo Sharing" feature
```

```
List all secrets for production stage
```

## Expected Outputs

### Infrastructure Setup
```
✅ AWS Infrastructure setup complete!

📦 Created resources:
- S3 Bucket: my-photovault-prod
- IAM Role: PhotoVaultLambdaRole-production
- CORS configuration applied
- Bucket versioning enabled

📋 Next steps:
1. Store secrets in AWS SSM Parameter Store
2. Update serverless.yml with bucket name
3. Deploy backend Lambda function
```

### Deployment Success
```
✅ Backend deployed successfully to production stage!

🔗 API Gateway URL: https://abc123.execute-api.us-east-1.amazonaws.com/prod

📋 Next steps:
1. Update VITE_API_BASE_URL in GitHub secrets
2. Test API endpoints
3. Deploy frontend with new API URL
```

### Status Check
```
📊 Deployment Status:

🟢 Backend: 1 Lambda function(s) deployed
  - photovault-prod-api: nodejs18.x (2024-01-15T10:30:00.000Z)
🟢 Frontend: Deployed and accessible at https://akhilsailatchireddi.github.io/photo-vault
```

## MCP Client Configurations

### Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "photovault": {
      "command": "photovault-mcp-server",
      "args": []
    }
  }
}
```

### Continue.dev
Add to your Continue configuration:

```json
{
  "mcp": [
    {
      "name": "photovault",
      "command": "photovault-mcp-server"
    }
  ]
}
```

## Troubleshooting Examples

### AWS Permission Issues
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify required permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:user/your-user \
  --action-names lambda:CreateFunction s3:CreateBucket iam:CreateRole \
  --resource-arns "*"
```

### Serverless Deployment Errors
```bash
# Check Serverless Framework installation
serverless --version

# Debug deployment issues
cd backend && serverless deploy --verbose --stage dev
```

### GitHub Pages Deployment Issues
```bash
# Check GitHub Actions status
gh run list --repo AkhilSaiLatchireddi/photo-vault

# Check repository permissions
git remote -v
git push --dry-run
```

## Advanced Usage

### Multi-Environment Setup

Set up development, staging, and production environments:

```
# Development Environment
Set up AWS infrastructure with bucket name "photovault-dev" for dev
Set mongodb-uri to "mongodb://localhost:27017/photovault-dev" for dev
Deploy backend to dev stage

# Staging Environment  
Set up AWS infrastructure with bucket name "photovault-staging" for staging
Set mongodb-uri to "mongodb+srv://staging-cluster/photovault" for staging
Deploy backend to staging stage

# Production Environment
Set up AWS infrastructure with bucket name "photovault-prod" for prod
Set mongodb-uri to "mongodb+srv://prod-cluster/photovault" for prod
Deploy backend to prod stage
```

### Cost Optimization

```
Analyze costs for last 30 days
Analyze only S3 costs for last 90 days
Analyze Lambda costs for last 7 days
```

Expected output:
```
💰 PhotoVault Cost Analysis (30 days)

📊 Estimated Monthly Costs:
- **LAMBDA**: $0.50/month (Based on 100K requests/month)
- **S3**: $1.00/month (Storage for photos and metadata)
- **APIGATEWAY**: $0.35/month (API Gateway requests)
- **MONGODB**: $0.00/month (MongoDB Atlas free tier (512MB))
- **GITHUBPAGES**: $0.00/month (Static site hosting)

💵 **Total Estimated Cost**: $1.85/month

📋 Cost Optimization Tips:
- Keep within AWS free tier limits
- Use MongoDB Atlas free tier (512MB)
- Optimize Lambda function cold starts
- Implement S3 lifecycle policies for old photos
- Monitor usage with AWS Cost Explorer

💡 Most costs come from S3 storage as your photo collection grows.
```

### Feature Documentation Generation

```
Generate documentation for "Photo Tagging" feature with API documentation
```

This creates a comprehensive feature document at `docs/features/photo-tagging.md` with:
- Feature overview and requirements
- Architecture diagrams
- API endpoint documentation
- Testing strategies  
- Implementation roadmap

## Best Practices

### 1. Always Test Before Deploying
```
Run all tests with coverage report
```

### 2. Monitor Deployments
```
Check deployment status after each deploy
```

### 3. Regular Backups
```
Create database backup named "pre-update-backup"
```

### 4. Cost Monitoring
```
Analyze costs monthly for optimization
```

### 5. Keep Secrets Secure
```
List all secrets to audit what's stored
Get specific secret values only when needed
Delete unused secrets regularly
```

## Integration with CI/CD

The MCP server can be integrated into automated workflows:

### GitHub Actions Integration
Create `.github/workflows/mcp-deploy.yml`:

```yaml
name: Deploy with MCP Server

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install MCP Server
        run: |
          cd mcp-server
          npm install
          npm run build
          npm install -g .
      
      - name: Deploy Backend
        run: photovault-mcp-server deploy_backend --stage=prod
        
      - name: Deploy Frontend  
        run: photovault-mcp-server deploy_frontend --message="Automated deployment"
```

## Community Examples

Share your own usage patterns:

1. **Educational Institutions**: Bulk photo management for student projects
2. **Photography Studios**: Client gallery management with auth
3. **Family Archives**: Personal photo organization with sharing
4. **Event Management**: Wedding/event photo distribution

---

**Need Help?** 
- [Open an Issue](https://github.com/AkhilSaiLatchireddi/photo-vault/issues)
- [Join the Discussion](https://github.com/AkhilSaiLatchireddi/photo-vault/discussions)
- [Check the Docs](../README.md)