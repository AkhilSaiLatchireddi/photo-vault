# PhotoVault MCP Server

A Model Context Protocol (MCP) server for the PhotoVault photo management application. This server provides AI assistants with tools to deploy, manage, and monitor PhotoVault instances automatically.

## 🚀 Features

- **Complete Deployment Automation**: Deploy both frontend and backend with a single command
- **AWS Infrastructure Management**: Set up S3 buckets, Lambda functions, and IAM roles
- **Auth0 Configuration**: Generate authentication settings and integration guides  
- **Testing & Quality Assurance**: Run comprehensive test suites with coverage reporting
- **Secrets Management**: Handle AWS SSM Parameter Store secrets securely
- **Monitoring & Analytics**: Check deployment status and analyze AWS costs
- **Documentation Generation**: Create feature documentation templates
- **Database Operations**: Backup and restore MongoDB databases

## 📦 Installation

### Prerequisites

Before installing, ensure you have:

1. **Node.js 18+** installed on your system
2. **AWS CLI** configured with appropriate permissions
3. **Git** configured for GitHub access
4. **PhotoVault project** in your workspace

### Quick Install

```bash
# Install globally from npm (when published)
npm install -g photovault-mcp-server

# Or install from GitHub
git clone https://github.com/AkhilSaiLatchireddi/photo-vault.git
cd photo-vault/mcp-server
npm install
npm run build
npm install -g .
```

### MCP Client Configuration

Add to your MCP client configuration:

**Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):**
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

**Continue.dev:**
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

## ⚙️ Setup & Configuration

### AWS Configuration

Ensure your AWS CLI is configured with appropriate permissions:

```bash
# Configure AWS credentials
aws configure

# Verify access
aws sts get-caller-identity
```

Required AWS permissions:
- Lambda (create, deploy, invoke functions)
- S3 (create buckets, upload/download objects)
- IAM (create roles, attach policies)
- SSM (manage parameters)
- API Gateway (create, deploy APIs)

### Environment Setup

```bash
# Verify Node.js version
node --version  # Should be 18.0.0 or higher

# Check Git configuration
git config --global user.name
git config --global user.email

# Test PhotoVault project structure
ls -la  # Should show frontend/, backend/, docs/ directories
```

## 🛠️ Available Tools

### Deployment Tools

#### `deploy_backend`
Deploy PhotoVault backend to AWS Lambda using Serverless Framework.

**Usage:**
```
Deploy backend to production stage in us-west-2 region
```

**Parameters:**
- `stage` (string): Deployment stage (dev, staging, prod) - default: dev  
- `region` (string): AWS region - default: us-east-1

**Example Response:**
```
✅ Backend deployed successfully to prod stage!

🔗 API Gateway URL: https://abc123.execute-api.us-west-2.amazonaws.com/prod

📋 Next steps:
1. Update VITE_API_BASE_URL in GitHub secrets
2. Test API endpoints  
3. Deploy frontend with new API URL
```

#### `deploy_frontend`
Deploy PhotoVault frontend to GitHub Pages automatically.

**Usage:**
```
Deploy frontend with message "Add new photo zoom feature"
```

**Parameters:**
- `commit_message` (string): Git commit message - default: "Deploy frontend updates"

**Example Response:**
```
✅ Frontend deployment initiated!

🚀 GitHub Actions will deploy to: https://akhilsailatchireddi.github.io/photo-vault

📋 Monitor deployment:
1. Check GitHub Actions tab in your repository
2. Wait for deployment to complete (2-5 minutes)
3. Visit the live URL to verify
```

### Infrastructure Management

#### `setup_aws_infrastructure`
Set up complete AWS infrastructure for PhotoVault.

**Usage:**
```
Set up AWS infrastructure with bucket name "my-photovault-storage" for production
```

**Parameters:**
- `bucket_name` (string, required): S3 bucket name for photo storage
- `stage` (string): Deployment stage - default: dev

**What it creates:**
- S3 bucket with proper CORS configuration
- IAM roles for Lambda execution
- Bucket versioning and lifecycle policies
- Security policies and permissions

#### `manage_secrets`
Manage AWS SSM Parameter Store secrets securely.

**Usage Examples:**
```
List all secrets for production stage
Get the mongodb-uri secret
Set auth0-client-secret to "new-secret-value" for dev stage  
Delete old-api-key parameter
```

**Parameters:**
- `action` (string, required): Action to perform (list, get, set, delete)
- `parameter_name` (string): Parameter name (required for get/set/delete)
- `parameter_value` (string): Parameter value (required for set)
- `stage` (string): Deployment stage - default: dev

### Authentication & Configuration

#### `configure_auth0`
Generate Auth0 configuration settings for PhotoVault.

**Usage:**
```
Configure Auth0 with domain "my-app.auth0.com" and client ID "abc123def456"
```

**Parameters:**
- `domain` (string, required): Auth0 domain
- `client_id` (string, required): Auth0 client ID  
- `frontend_url` (string): Frontend URL for callbacks

**Generated Output:**
- Allowed callback URLs
- Allowed logout URLs
- CORS origins configuration
- GitHub secrets setup guide

### Testing & Quality Assurance

#### `run_tests`
Execute comprehensive test suites for PhotoVault components.

**Usage:**
```
Run all tests with coverage report
Run only frontend tests
Run backend tests without coverage
```

**Parameters:**
- `component` (string): Component to test (frontend, backend, all) - default: all
- `coverage` (boolean): Generate coverage report - default: false

### Monitoring & Analytics

#### `check_deployment_status`
Monitor the health and status of PhotoVault deployments.

**Usage:**
```
Check status of all deployments
Check only backend Lambda functions
Check frontend GitHub Pages status
```

**Parameters:**
- `component` (string): Component to check (frontend, backend, all) - default: all

**Status Indicators:**
- 🟢 Green: Service is running and accessible
- 🔴 Red: Service is down or has issues  
- 🟡 Yellow: Service is partially operational

#### `analyze_costs`
Analyze AWS costs and optimize spending for PhotoVault.

**Usage:**
```
Analyze costs for the last 30 days
Analyze only S3 storage costs for last 7 days
Get cost breakdown for all services
```

**Parameters:**
- `days` (number): Number of days to analyze - default: 30
- `service` (string): AWS service to analyze - default: all

**Cost Breakdown:**
- Lambda function execution costs
- S3 storage and transfer costs  
- API Gateway request costs
- Data transfer charges

### Development Tools

#### `generate_feature_docs`
Create structured documentation for new PhotoVault features.

**Usage:**
```
Generate documentation for "Photo Tagging" feature
Create docs for "User Profiles" without API documentation
```

**Parameters:**
- `feature_name` (string, required): Name of the feature to document
- `include_api` (boolean): Include API documentation - default: true

**Generated Template Includes:**
- Feature overview and requirements
- Architecture diagrams
- API endpoint documentation
- Testing strategies
- Implementation roadmap

#### `backup_database`
Create comprehensive backup strategies for MongoDB data.

**Usage:**
```
Create database backup named "pre-migration-backup"
Create backup excluding photo metadata
```

**Parameters:**
- `backup_name` (string): Custom name for the backup
- `include_photos` (boolean): Include photo metadata - default: true

**Backup Options:**
- MongoDB Atlas cloud snapshots
- Manual mongodump exports  
- Automated backup scripts
- Restore procedures

## 🚀 Quick Start Guide

### 1. Initial Project Setup

```bash
# Clone PhotoVault project
git clone https://github.com/AkhilSaiLatchireddi/photo-vault.git
cd photo-vault

# Install MCP server
cd mcp-server
npm install
npm run build
npm install -g .
```

### 2. Configure MCP Client

Add PhotoVault server to your MCP client (Claude Desktop, Continue.dev, etc.)

### 3. Set Up Infrastructure

```
Set up AWS infrastructure with bucket name "my-photovault-storage" for dev
```

### 4. Configure Authentication

```
Configure Auth0 with domain "my-app.auth0.com" and client ID "your-client-id"
```

### 5. Store Secrets

```
Set mongodb-uri to your MongoDB connection string for dev
Set auth0-client-secret to your Auth0 client secret for dev  
Set jwt-secret to a secure random string for dev
```

### 6. Deploy Application

```
Deploy backend to dev stage
Deploy frontend with message "Initial deployment"
```

### 7. Verify Everything Works

```
Check deployment status for all components
Run all tests with coverage
Analyze costs for infrastructure
```

## 📋 Common Workflows

### Complete New Environment Setup

1. **Infrastructure**: `setup_aws_infrastructure` with your bucket name
2. **Authentication**: `configure_auth0` with your Auth0 details  
3. **Secrets**: Use `manage_secrets` to store all configuration
4. **Backend**: `deploy_backend` to your target stage
5. **Frontend**: `deploy_frontend` to GitHub Pages
6. **Verify**: `check_deployment_status` to confirm everything works

### Daily Development Workflow

1. **Test**: `run_tests` before making changes
2. **Deploy**: `deploy_backend` and `deploy_frontend` after changes
3. **Monitor**: `check_deployment_status` to verify deployments
4. **Document**: `generate_feature_docs` for new features

### Maintenance & Monitoring

1. **Weekly**: `backup_database` to create regular backups
2. **Monthly**: `analyze_costs` to optimize AWS spending
3. **As Needed**: `manage_secrets` to update configuration
4. **Before Updates**: `run_tests` with coverage to ensure quality

## 🔧 Troubleshooting

### Common Issues

#### AWS Permission Errors
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify required policies are attached
aws iam list-attached-user-policies --user-name YOUR_USERNAME
```

#### Git/GitHub Issues
```bash
# Check Git configuration
git config --list

# Verify repository access
git remote -v
git fetch origin
```

#### Serverless Deployment Errors
```bash  
# Check Serverless installation
serverless --version

# Verify AWS region support
aws ec2 describe-regions
```

#### Node.js/NPM Issues
```bash
# Check Node.js version
node --version
npm --version

# Clear npm cache
npm cache clean --force
```

### Debug Commands

```bash
# Test MCP server locally
cd mcp-server
npm run dev

# Check PhotoVault project structure
ls -la frontend/ backend/ docs/

# Verify AWS CLI access
aws lambda list-functions
aws s3 ls
```

### Getting Help

- **GitHub Issues**: [Report bugs or request features](https://github.com/AkhilSaiLatchireddi/photo-vault/issues)
- **Documentation**: Check the [PhotoVault docs](../docs/)
- **Deployment Guide**: See [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md)
- **MCP Community**: [Model Context Protocol Discord](https://discord.gg/modelcontextprotocol)

## 🤝 Contributing

We welcome contributions to improve the PhotoVault MCP Server!

### Development Setup

```bash
# Clone and setup
git clone https://github.com/AkhilSaiLatchireddi/photo-vault.git
cd photo-vault/mcp-server

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Adding New Tools

1. Add tool definition to `setupToolHandlers()` method
2. Implement tool logic as a private method
3. Add tool to the switch statement in request handler
4. Update documentation and examples
5. Test thoroughly before submitting PR

### Code Style

- Use TypeScript with strict mode
- Follow existing code patterns  
- Add proper error handling
- Include helpful user feedback
- Write clear documentation

## 📄 License

MIT License - see the [LICENSE](../LICENSE) file for details.

## 🔗 Links

- **Main Repository**: [PhotoVault on GitHub](https://github.com/AkhilSaiLatchireddi/photo-vault)
- **Live Demo**: [PhotoVault App](https://akhilsailatchireddi.github.io/photo-vault)
- **Model Context Protocol**: [Official Documentation](https://modelcontextprotocol.io)
- **AWS Documentation**: [AWS Services Guide](https://docs.aws.amazon.com)
- **Serverless Framework**: [Serverless.com](https://www.serverless.com)

## 📊 Metrics

- **10 Tools Available**: Complete deployment and management automation
- **Zero Configuration**: Works out of the box with PhotoVault projects
- **Multi-Environment**: Supports dev, staging, and production deployments
- **Cost Optimized**: Designed for AWS free tier usage
- **Fully Automated**: From infrastructure to monitoring

---

*Built with ❤️ for the PhotoVault community. Happy photo managing!* 📸