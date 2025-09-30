# PhotoVault MCP Server

A Model Context Protocol (MCP) server for the PhotoVault photo management application. This server provides AI assistants with tools to deploy, manage, and monitor PhotoVault instances.

## 🚀 Features

- **Deployment Management**: Deploy frontend and backend components
- **AWS Infrastructure**: Set up S3 buckets, Lambda functions, and IAM roles
- **Auth0 Configuration**: Configure authentication settings
- **Testing**: Run frontend and backend tests with coverage
- **Secrets Management**: Manage AWS SSM Parameter Store secrets
- **Monitoring**: Check deployment status and analyze costs
- **Documentation**: Generate feature documentation
- **Backup**: Create database backups

## 📦 Installation

### From GitHub MCP Registry

```bash
# Install via MCP registry
npx @modelcontextprotocol/cli install photovault-mcp-server
```

### From Source

```bash
# Clone the repository
git clone https://github.com/AkhilSaiLatchireddi/photo-vault.git
cd photo-vault/mcp-server

# Install dependencies
npm install

# Build the server
npm run build

# Install globally
npm install -g .
```

## ⚙️ Configuration

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Node.js 18+** installed
3. **Git** configured for GitHub access
4. **PhotoVault project** in your workspace

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

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

### Environment Setup

Ensure your environment has:

```bash
# AWS credentials
aws configure

# GitHub access (for deployment)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## 🛠️ Available Tools

### Deployment Tools

#### `deploy_backend`
Deploy PhotoVault backend to AWS Lambda using Serverless Framework.

**Parameters:**
- `stage` (string): Deployment stage (dev, staging, prod) - default: dev
- `region` (string): AWS region - default: us-east-1

**Example:**
```
Deploy backend to production stage in us-west-2 region
```

#### `deploy_frontend`
Deploy PhotoVault frontend to GitHub Pages.

**Parameters:**
- `commit_message` (string): Git commit message - default: "Deploy frontend updates"

**Example:**
```
Deploy frontend with message "Add new photo upload feature"
```

### Infrastructure Tools

#### `setup_aws_infrastructure`
Set up AWS infrastructure including S3 bucket, IAM roles, and configurations.

**Parameters:**
- `bucket_name` (string, required): S3 bucket name for photo storage
- `stage` (string): Deployment stage - default: dev

**Example:**
```
Set up AWS infrastructure with bucket name "photovault-storage-prod" for production stage
```

#### `manage_secrets`
Manage AWS SSM Parameter Store secrets.

**Parameters:**
- `action` (string, required): Action to perform (list, get, set, delete)
- `parameter_name` (string): Parameter name (required for get/set/delete)
- `parameter_value` (string): Parameter value (required for set)
- `stage` (string): Deployment stage - default: dev

**Examples:**
```
List all secrets for production stage
Get the mongodb-uri secret for development stage
Set jwt-secret to "new-secret-value" for production stage
```

### Authentication & Configuration

#### `configure_auth0`
Generate Auth0 configuration settings for PhotoVault.

**Parameters:**
- `domain` (string, required): Auth0 domain
- `client_id` (string, required): Auth0 client ID
- `frontend_url` (string): Frontend URL for callbacks - default: GitHub Pages URL

**Example:**
```
Configure Auth0 with domain "photovault.auth0.com" and client ID "abc123"
```

### Testing & Quality

#### `run_tests`
Run tests for frontend and/or backend components.

**Parameters:**
- `component` (string): Which component to test (frontend, backend, all) - default: all
- `coverage` (boolean): Generate coverage report - default: false

**Example:**
```
Run all tests with coverage report
Run only frontend tests
```

### Monitoring & Analysis

#### `check_deployment_status`
Check the status of PhotoVault deployments.

**Parameters:**
- `component` (string): Which component to check (frontend, backend, all) - default: all

**Example:**
```
Check status of all deployments
Check only backend deployment status
```

#### `analyze_costs`
Analyze AWS costs and usage for PhotoVault.

**Parameters:**
- `days` (number): Number of days to analyze - default: 30
- `service` (string): AWS service to analyze (all, lambda, s3, api-gateway) - default: all

**Example:**
```
Analyze costs for the last 30 days
Analyze only S3 costs for the last 7 days
```

### Documentation & Backup

#### `generate_feature_docs`
Generate documentation template for new PhotoVault features.

**Parameters:**
- `feature_name` (string, required): Name of the feature to document
- `include_api` (boolean): Include API documentation - default: true

**Example:**
```
Generate documentation for "Photo Tagging" feature
Generate docs for "User Profiles" without API documentation
```

#### `backup_database`
Create backup instructions and scripts for the MongoDB database.

**Parameters:**
- `backup_name` (string): Name for the backup
- `include_photos` (boolean): Include photo metadata - default: true

**Example:**
```
Create database backup named "pre-migration-backup"
Create backup without photo metadata
```

## 🚀 Quick Start Guide

### 1. Initial Setup

```
Set up AWS infrastructure with bucket name "my-photovault-bucket" for dev stage
Configure Auth0 with domain "my-app.auth0.com" and client ID "abc123def456"
```

### 2. Deploy Backend

```
Deploy backend to dev stage
```

### 3. Configure Secrets

```
Set mongodb-uri secret to your MongoDB connection string for dev stage
Set jwt-secret to a secure random string for dev stage
Set auth0-secret to your Auth0 client secret for dev stage
```

### 4. Deploy Frontend

```
Deploy frontend with message "Initial production deployment"
```

### 5. Verify Deployment

```
Check deployment status for all components
Test API endpoint health
```

## 🔧 Troubleshooting

### Common Issues

1. **AWS Permission Errors**
   - Ensure your AWS CLI is configured with appropriate IAM permissions
   - Check that your IAM user has Lambda, S3, and SSM permissions

2. **Git Push Errors**
   - Verify your GitHub credentials and repository access
   - Check if there are uncommitted changes

3. **Serverless Deployment Errors**
   - Ensure Serverless Framework is installed globally
   - Check that your AWS region supports all required services

### Debug Commands

```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Serverless installation
serverless --version

# Check Node.js version
node --version

# Test GitHub connectivity
git remote -v
```

## 📚 Integration Examples

### With Claude Desktop

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

### With Continue.dev

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see the [LICENSE](../LICENSE) file for details.

## 🔗 Links

- [PhotoVault Repository](https://github.com/AkhilSaiLatchireddi/photo-vault)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [AWS Documentation](https://docs.aws.amazon.com)
- [Serverless Framework](https://www.serverless.com)

## 📞 Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/AkhilSaiLatchireddi/photo-vault/issues)
- Check the [troubleshooting guide](../PRODUCTION_DEPLOYMENT.md)
- Review the [setup documentation](../docs/SETUP.md)