#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

class PhotoVaultMCPServer {
  private server: Server;
  private projectRoot: string;

  constructor() {
    this.server = new Server(
      {
        name: 'photovault-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.projectRoot = process.cwd();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'deploy_backend',
          description: 'Deploy the PhotoVault backend to AWS Lambda using Serverless',
          inputSchema: {
            type: 'object',
            properties: {
              stage: {
                type: 'string',
                enum: ['dev', 'staging', 'prod'],
                description: 'Deployment stage',
                default: 'dev'
              },
              region: {
                type: 'string',
                description: 'AWS region',
                default: 'us-east-1'
              }
            }
          }
        },
        {
          name: 'deploy_frontend',
          description: 'Deploy the PhotoVault frontend to GitHub Pages',
          inputSchema: {
            type: 'object',
            properties: {
              commit_message: {
                type: 'string',
                description: 'Git commit message',
                default: 'Deploy frontend updates'
              }
            }
          }
        },
        {
          name: 'setup_aws_infrastructure',
          description: 'Set up AWS infrastructure (S3 bucket, IAM roles, SSM parameters)',
          inputSchema: {
            type: 'object',
            properties: {
              bucket_name: {
                type: 'string',
                description: 'S3 bucket name for photo storage'
              },
              stage: {
                type: 'string',
                enum: ['dev', 'staging', 'prod'],
                default: 'dev'
              }
            },
            required: ['bucket_name']
          }
        },
        {
          name: 'configure_auth0',
          description: 'Configure Auth0 settings for PhotoVault',
          inputSchema: {
            type: 'object',
            properties: {
              domain: {
                type: 'string',
                description: 'Auth0 domain'
              },
              client_id: {
                type: 'string',
                description: 'Auth0 client ID'
              },
              frontend_url: {
                type: 'string',
                description: 'Frontend URL for callbacks',
                default: 'https://akhilsailatchireddi.github.io/photo-vault'
              }
            },
            required: ['domain', 'client_id']
          }
        },
        {
          name: 'run_tests',
          description: 'Run tests for frontend and/or backend',
          inputSchema: {
            type: 'object',
            properties: {
              component: {
                type: 'string',
                enum: ['frontend', 'backend', 'all'],
                description: 'Which component to test',
                default: 'all'
              },
              coverage: {
                type: 'boolean',
                description: 'Generate coverage report',
                default: false
              }
            }
          }
        },
        {
          name: 'manage_secrets',
          description: 'Manage AWS SSM Parameter Store secrets',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['list', 'get', 'set', 'delete'],
                description: 'Action to perform'
              },
              parameter_name: {
                type: 'string',
                description: 'Parameter name (required for get/set/delete)'
              },
              parameter_value: {
                type: 'string',
                description: 'Parameter value (required for set)'
              },
              stage: {
                type: 'string',
                enum: ['dev', 'staging', 'prod'],
                default: 'dev'
              }
            },
            required: ['action']
          }
        },
        {
          name: 'check_deployment_status',
          description: 'Check the status of PhotoVault deployments',
          inputSchema: {
            type: 'object',
            properties: {
              component: {
                type: 'string',
                enum: ['frontend', 'backend', 'all'],
                description: 'Which component to check',
                default: 'all'
              }
            }
          }
        },
        {
          name: 'generate_feature_docs',
          description: 'Generate documentation for PhotoVault features',
          inputSchema: {
            type: 'object',
            properties: {
              feature_name: {
                type: 'string',
                description: 'Name of the feature to document'
              },
              include_api: {
                type: 'boolean',
                description: 'Include API documentation',
                default: true
              }
            },
            required: ['feature_name']
          }
        },
        {
          name: 'analyze_costs',
          description: 'Analyze AWS costs and usage for PhotoVault',
          inputSchema: {
            type: 'object',
            properties: {
              days: {
                type: 'number',
                description: 'Number of days to analyze',
                default: 30
              },
              service: {
                type: 'string',
                enum: ['all', 'lambda', 's3', 'api-gateway'],
                description: 'AWS service to analyze',
                default: 'all'
              }
            }
          }
        },
        {
          name: 'backup_database',
          description: 'Create a backup of the MongoDB database',
          inputSchema: {
            type: 'object',
            properties: {
              backup_name: {
                type: 'string',
                description: 'Name for the backup'
              },
              include_photos: {
                type: 'boolean',
                description: 'Include photo metadata',
                default: true
              }
            }
          }
        }
      ] satisfies Tool[]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'deploy_backend':
            return await this.deployBackend(args);
          
          case 'deploy_frontend':
            return await this.deployFrontend(args);
          
          case 'setup_aws_infrastructure':
            return await this.setupAWSInfrastructure(args);
          
          case 'configure_auth0':
            return await this.configureAuth0(args);
          
          case 'run_tests':
            return await this.runTests(args);
          
          case 'manage_secrets':
            return await this.manageSecrets(args);
          
          case 'check_deployment_status':
            return await this.checkDeploymentStatus(args);
          
          case 'generate_feature_docs':
            return await this.generateFeatureDocs(args);
          
          case 'analyze_costs':
            return await this.analyzeCosts(args);
          
          case 'backup_database':
            return await this.backupDatabase(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    });
  }

  private async deployBackend(args: any) {
    const { stage = 'dev', region = 'us-east-1' } = args;
    
    try {
      const backendPath = path.join(this.projectRoot, 'backend');
      
      // Check if backend directory exists
      if (!existsSync(backendPath)) {
        throw new Error('Backend directory not found. Make sure you are in the PhotoVault project root.');
      }
      
      // Change to backend directory
      process.chdir(backendPath);
      
      // Install dependencies
      execSync('npm install', { stdio: 'inherit' });
      
      // Build the project
      execSync('npm run build', { stdio: 'inherit' });
      
      // Deploy using Serverless
      const deployCommand = `serverless deploy --stage ${stage} --region ${region}`;
      const output = execSync(deployCommand, { encoding: 'utf8' });
      
      // Extract API Gateway URL from output
      const apiUrlMatch = output.match(/https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com\/[a-z0-9]+/);
      const apiUrl = apiUrlMatch ? apiUrlMatch[0] : null;
      
      process.chdir(this.projectRoot);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Backend deployed successfully to ${stage} stage!\n\n` +
                  `🔗 API Gateway URL: ${apiUrl || 'Check serverless output'}\n\n` +
                  `📋 Next steps:\n` +
                  `1. Update VITE_API_BASE_URL in GitHub secrets\n` +
                  `2. Test API endpoints\n` +
                  `3. Deploy frontend with new API URL\n\n` +
                  `📄 Full output:\n${output}`
          }
        ]
      };
    } catch (error) {
      process.chdir(this.projectRoot);
      throw error;
    }
  }

  private async deployFrontend(args: any) {
    const { commit_message = 'Deploy frontend updates' } = args;
    
    try {
      // Add all changes
      execSync('git add .', { stdio: 'inherit' });
      
      // Commit changes
      execSync(`git commit -m "${commit_message}"`, { stdio: 'inherit' });
      
      // Push to main branch (triggers GitHub Actions)
      execSync('git push origin main', { stdio: 'inherit' });
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Frontend deployment initiated!\n\n` +
                  `🚀 GitHub Actions will deploy to: https://akhilsailatchireddi.github.io/photo-vault\n\n` +
                  `📋 Monitor deployment:\n` +
                  `1. Check GitHub Actions tab in your repository\n` +
                  `2. Wait for deployment to complete (2-5 minutes)\n` +
                  `3. Visit the live URL to verify\n\n` +
                  `💡 Commit message: "${commit_message}"`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to deploy frontend: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async setupAWSInfrastructure(args: any) {
    const { bucket_name, stage = 'dev' } = args;
    
    try {
      // Create S3 bucket
      const createBucketCmd = `aws s3 mb "s3://${bucket_name}" --region us-east-1`;
      execSync(createBucketCmd, { stdio: 'inherit' });
      
      // Configure CORS (if cors file exists)
      const corsPath = path.join(this.projectRoot, 'infrastructure', 'bucket-cors.json');
      if (existsSync(corsPath)) {
        const corsCmd = `aws s3api put-bucket-cors --bucket "${bucket_name}" --cors-configuration file://${corsPath}`;
        execSync(corsCmd, { stdio: 'inherit' });
      }
      
      // Enable versioning
      const versioningCmd = `aws s3api put-bucket-versioning --bucket "${bucket_name}" --versioning-configuration Status=Enabled`;
      execSync(versioningCmd, { stdio: 'inherit' });
      
      // Create IAM role for Lambda (if it doesn't exist)
      try {
        execSync(`aws iam get-role --role-name PhotoVaultLambdaRole-${stage}`, { stdio: 'pipe' });
      } catch {
        // Role doesn't exist, create it
        const trustPolicy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' },
              Action: 'sts:AssumeRole'
            }
          ]
        };
        
        const createRoleCmd = `aws iam create-role --role-name PhotoVaultLambdaRole-${stage} --assume-role-policy-document '${JSON.stringify(trustPolicy)}'`;
        execSync(createRoleCmd, { stdio: 'inherit' });
        
        // Attach policies
        execSync(`aws iam attach-role-policy --role-name PhotoVaultLambdaRole-${stage} --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`);
        execSync(`aws iam attach-role-policy --role-name PhotoVaultLambdaRole-${stage} --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess`);
        execSync(`aws iam attach-role-policy --role-name PhotoVaultLambdaRole-${stage} --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess`);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ AWS Infrastructure setup complete!\n\n` +
                  `📦 Created resources:\n` +
                  `- S3 Bucket: ${bucket_name}\n` +
                  `- IAM Role: PhotoVaultLambdaRole-${stage}\n` +
                  `- CORS configuration applied\n` +
                  `- Bucket versioning enabled\n\n` +
                  `📋 Next steps:\n` +
                  `1. Store secrets in AWS SSM Parameter Store\n` +
                  `2. Update serverless.yml with bucket name\n` +
                  `3. Deploy backend Lambda function`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to setup AWS infrastructure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async configureAuth0(args: any) {
    const { domain, client_id, frontend_url } = args;
    
    const auth0Config = {
      domain,
      clientId: client_id,
      callbacks: [
        'http://localhost:3000',
        frontend_url
      ],
      logoutUrls: [
        'http://localhost:3000',
        frontend_url
      ],
      webOrigins: [
        'http://localhost:3000',
        'https://akhilsailatchireddi.github.io'
      ],
      corsOrigins: [
        'http://localhost:3000',
        'https://akhilsailatchireddi.github.io'
      ]
    };
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Auth0 Configuration Generated!\n\n` +
                `🔧 Add these settings to your Auth0 application:\n\n` +
                `**Allowed Callback URLs:**\n${auth0Config.callbacks.join(', ')}\n\n` +
                `**Allowed Logout URLs:**\n${auth0Config.logoutUrls.join(', ')}\n\n` +
                `**Allowed Web Origins:**\n${auth0Config.webOrigins.join(', ')}\n\n` +
                `**Allowed Origins (CORS):**\n${auth0Config.corsOrigins.join(', ')}\n\n` +
                `📋 GitHub Secrets to add:\n` +
                `- VITE_AUTH0_DOMAIN: ${domain}\n` +
                `- VITE_AUTH0_CLIENT_ID: ${client_id}\n\n` +
                `💡 Don't forget to update your Auth0 application settings in the dashboard!`
        }
      ]
    };
  }

  private async runTests(args: any) {
    const { component = 'all', coverage = false } = args;
    const results: string[] = [];
    
    try {
      if (component === 'frontend' || component === 'all') {
        const frontendPath = path.join(this.projectRoot, 'frontend');
        if (existsSync(frontendPath)) {
          process.chdir(frontendPath);
          const frontendCmd = coverage ? 'npm run test:coverage' : 'npm test';
          const frontendOutput = execSync(frontendCmd, { encoding: 'utf8' });
          results.push(`Frontend Tests:\n${frontendOutput}`);
          process.chdir(this.projectRoot);
        } else {
          results.push('Frontend Tests: Directory not found');
        }
      }
      
      if (component === 'backend' || component === 'all') {
        const backendPath = path.join(this.projectRoot, 'backend');
        if (existsSync(backendPath)) {
          process.chdir(backendPath);
          const backendCmd = coverage ? 'npm run test:coverage' : 'npm test';
          const backendOutput = execSync(backendCmd, { encoding: 'utf8' });
          results.push(`Backend Tests:\n${backendOutput}`);
          process.chdir(this.projectRoot);
        } else {
          results.push('Backend Tests: Directory not found');
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Tests completed!\n\n${results.join('\n\n')}`
          }
        ]
      };
    } catch (error) {
      process.chdir(this.projectRoot);
      throw error;
    }
  }

  private async manageSecrets(args: any) {
    const { action, parameter_name, parameter_value, stage = 'dev' } = args;
    const prefix = `/photovault/${stage}`;
    
    try {
      switch (action) {
        case 'list':
          const listOutput = execSync(`aws ssm get-parameters-by-path --path "${prefix}" --recursive`, { encoding: 'utf8' });
          const params = JSON.parse(listOutput);
          const paramList = params.Parameters.map((p: any) => `- ${p.Name}: ${p.Type}`).join('\n');
          
          return {
            content: [
              {
                type: 'text',
                text: `📋 SSM Parameters for ${stage} stage:\n\n${paramList || 'No parameters found'}`
              }
            ]
          };
        
        case 'get':
          if (!parameter_name) throw new Error('parameter_name is required for get action');
          
          const getOutput = execSync(`aws ssm get-parameter --name "${prefix}/${parameter_name}" --with-decryption`, { encoding: 'utf8' });
          const param = JSON.parse(getOutput);
          
          return {
            content: [
              {
                type: 'text',
                text: `🔍 Parameter: ${param.Parameter.Name}\n` +
                      `📝 Value: ${param.Parameter.Value}\n` +
                      `🔒 Type: ${param.Parameter.Type}`
              }
            ]
          };
        
        case 'set':
          if (!parameter_name || !parameter_value) {
            throw new Error('parameter_name and parameter_value are required for set action');
          }
          
          const setCmd = `aws ssm put-parameter --name "${prefix}/${parameter_name}" --value "${parameter_value}" --type "SecureString" --overwrite`;
          execSync(setCmd, { stdio: 'inherit' });
          
          return {
            content: [
              {
                type: 'text',
                text: `✅ Parameter set: ${prefix}/${parameter_name}`
              }
            ]
          };
        
        case 'delete':
          if (!parameter_name) throw new Error('parameter_name is required for delete action');
          
          execSync(`aws ssm delete-parameter --name "${prefix}/${parameter_name}"`, { stdio: 'inherit' });
          
          return {
            content: [
              {
                type: 'text',
                text: `🗑️ Parameter deleted: ${prefix}/${parameter_name}`
              }
            ]
          };
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      throw new Error(`Failed to manage secrets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async checkDeploymentStatus(args: any) {
    const { component = 'all' } = args;
    const status: string[] = [];
    
    try {
      if (component === 'backend' || component === 'all') {
        // Check Lambda functions
        const lambdaOutput = execSync('aws lambda list-functions --query "Functions[?contains(FunctionName, \'photovault\')]"', { encoding: 'utf8' });
        const functions = JSON.parse(lambdaOutput);
        
        if (functions.length > 0) {
          status.push(`🟢 Backend: ${functions.length} Lambda function(s) deployed`);
          functions.forEach((fn: any) => {
            status.push(`  - ${fn.FunctionName}: ${fn.Runtime} (${fn.LastModified})`);
          });
        } else {
          status.push(`🔴 Backend: No Lambda functions found`);
        }
      }
      
      if (component === 'frontend' || component === 'all') {
        // Check if GitHub Pages is accessible
        try {
          const frontendUrl = 'https://akhilsailatchireddi.github.io/photo-vault';
          const statusCode = execSync(`curl -s -o /dev/null -w "%{http_code}" ${frontendUrl}`, { encoding: 'utf8' });
          if (statusCode.trim() === '200') {
            status.push(`🟢 Frontend: Deployed and accessible at ${frontendUrl}`);
          } else {
            status.push(`🔴 Frontend: HTTP ${statusCode} - Deployment may have failed`);
          }
        } catch {
          status.push(`🔴 Frontend: Not accessible or deployment failed`);
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `📊 Deployment Status:\n\n${status.join('\n')}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to check deployment status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateFeatureDocs(args: any) {
    const { feature_name, include_api = true } = args;
    
    const template = `# ${feature_name} Feature

## 🎯 Overview
Brief description of the ${feature_name} feature and its purpose in PhotoVault.

## 📋 Requirements

### Functional Requirements
- Feature requirement 1
- Feature requirement 2
- Feature requirement 3

### Non-Functional Requirements
- Performance requirements
- Security requirements
- Scalability requirements

## 🏗️ Architecture

### Frontend Components
\`\`\`
src/components/${feature_name}/
├── ${feature_name}Container.tsx
├── ${feature_name}View.tsx
├── ${feature_name}Form.tsx
└── types.ts
\`\`\`

### Backend Implementation
\`\`\`
backend/src/
├── routes/${feature_name}Routes.ts
├── controllers/${feature_name}Controller.ts
├── services/${feature_name}Service.ts
└── models/${feature_name}Model.ts
\`\`\`

${include_api ? `
## 🔌 API Endpoints

### Create ${feature_name}
\`\`\`http
POST /api/${feature_name.toLowerCase()}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "string",
  "description": "string"
}
\`\`\`

### Get ${feature_name}
\`\`\`http
GET /api/${feature_name.toLowerCase()}/:id
Authorization: Bearer <token>
\`\`\`

### Update ${feature_name}
\`\`\`http
PUT /api/${feature_name.toLowerCase()}/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "string",
  "description": "string"
}
\`\`\`

### Delete ${feature_name}
\`\`\`http
DELETE /api/${feature_name.toLowerCase()}/:id
Authorization: Bearer <token>
\`\`\`
` : ''}

## 🧪 Testing

### Unit Tests
- Component tests for React components
- Service tests for business logic
- Controller tests for API endpoints

### Integration Tests
- End-to-end user workflows
- API integration tests
- Database operations

## 🚀 Implementation Plan

### Phase 1: Backend Development
- [ ] Create database models
- [ ] Implement API routes
- [ ] Add authentication middleware
- [ ] Write unit tests

### Phase 2: Frontend Development
- [ ] Create React components
- [ ] Implement state management
- [ ] Add form validation
- [ ] Style with CSS/Tailwind

### Phase 3: Integration & Testing
- [ ] Connect frontend to backend
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation updates

## 📚 Dependencies
- Frontend: React, TypeScript, Auth0
- Backend: Express, TypeScript, MongoDB
- Testing: Jest, React Testing Library

## ✅ Acceptance Criteria
- [ ] Users can perform all CRUD operations
- [ ] Proper error handling and validation
- [ ] Responsive design for mobile devices
- [ ] Comprehensive test coverage (>80%)
- [ ] Security measures implemented
`;

    const docsDir = path.join(this.projectRoot, 'docs', 'features');
    const filePath = path.join(docsDir, `${feature_name.toLowerCase().replace(/\s+/g, '-')}.md`);
    
    try {
      // Create docs/features directory if it doesn't exist
      if (!existsSync(docsDir)) {
        mkdirSync(docsDir, { recursive: true });
      }
      
      writeFileSync(filePath, template, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Feature documentation generated!\n\n` +
                  `📄 File created: ${filePath}\n\n` +
                  `📋 Next steps:\n` +
                  `1. Review and customize the generated documentation\n` +
                  `2. Add specific requirements for your feature\n` +
                  `3. Update API endpoints as needed\n` +
                  `4. Add to your project documentation index`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to generate feature docs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async analyzeCosts(args: any) {
    const { days = 30, service = 'all' } = args;
    
    try {
      // This would typically integrate with AWS Cost Explorer API
      // For now, we'll provide estimated costs based on the documentation
      
      const estimatedCosts = {
        lambda: {
          requests: 100000,
          cost: 0.50,
          description: 'Based on 100K requests/month'
        },
        s3: {
          storage: '5GB',
          cost: 1.00,
          description: 'Storage for photos and metadata'
        },
        apiGateway: {
          requests: 100000,
          cost: 0.35,
          description: 'API Gateway requests'
        },
        mongodb: {
          tier: 'Free',
          cost: 0.00,
          description: 'MongoDB Atlas free tier (512MB)'
        },
        githubPages: {
          tier: 'Free',
          cost: 0.00,
          description: 'Static site hosting'
        }
      };
      
      const serviceFilter = service === 'all' ? Object.keys(estimatedCosts) : [service];
      const filteredCosts = Object.entries(estimatedCosts)
        .filter(([key]) => serviceFilter.includes(key))
        .map(([key, value]) => `- **${key.toUpperCase()}**: $${value.cost.toFixed(2)}/month (${value.description})`)
        .join('\n');
      
      const totalCost = Object.entries(estimatedCosts)
        .filter(([key]) => serviceFilter.includes(key))
        .reduce((sum, [, value]) => sum + value.cost, 0);
      
      return {
        content: [
          {
            type: 'text',
            text: `💰 PhotoVault Cost Analysis (${days} days)\n\n` +
                  `📊 Estimated Monthly Costs:\n${filteredCosts}\n\n` +
                  `💵 **Total Estimated Cost**: $${totalCost.toFixed(2)}/month\n\n` +
                  `📋 Cost Optimization Tips:\n` +
                  `- Keep within AWS free tier limits\n` +
                  `- Use MongoDB Atlas free tier (512MB)\n` +
                  `- Optimize Lambda function cold starts\n` +
                  `- Implement S3 lifecycle policies for old photos\n` +
                  `- Monitor usage with AWS Cost Explorer\n\n` +
                  `💡 Most costs come from S3 storage as your photo collection grows.`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to analyze costs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async backupDatabase(args: any) {
    const { backup_name, include_photos = true } = args;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = backup_name || `photovault-backup-${timestamp}`;
    
    try {
      // This would typically connect to MongoDB and create a backup
      // For now, we'll provide instructions and commands
      
      const backupInstructions = `
# MongoDB Atlas Backup Instructions

## Option 1: MongoDB Atlas Cloud Backup (Recommended)
1. Go to MongoDB Atlas dashboard
2. Select your cluster
3. Navigate to "Backup" tab
4. Click "Take Snapshot Now"
5. Name your snapshot: "${backupFileName}"

## Option 2: Manual Export with mongodump
\`\`\`bash
# Install MongoDB tools if not installed
brew install mongodb/brew/mongodb-database-tools

# Export database (replace with your connection string)
mongodump --uri="mongodb+srv://username:password@cluster.mongodb.net/photovault" --out=./backups/${backupFileName}

# Create archive
tar -czf ./backups/${backupFileName}.tar.gz ./backups/${backupFileName}
\`\`\`

## Option 3: Programmatic Backup
\`\`\`bash
# Use the backup script (if available)
cd backend
node scripts/backup-database.js --name="${backupFileName}" ${include_photos ? '--include-photos' : ''}
\`\`\`

## Restore Instructions
\`\`\`bash
# Restore from backup
mongorestore --uri="mongodb+srv://username:password@cluster.mongodb.net/photovault" ./backups/${backupFileName}
\`\`\`
`;

      return {
        content: [
          {
            type: 'text',
            text: `💾 Database Backup Instructions\n\n` +
                  `📦 Backup Name: ${backupFileName}\n` +
                  `📸 Include Photos: ${include_photos ? 'Yes' : 'No'}\n\n` +
                  backupInstructions +
                  `\n\n📋 Next Steps:\n` +
                  `1. Choose your preferred backup method\n` +
                  `2. Store backup in secure location\n` +
                  `3. Test restore process\n` +
                  `4. Schedule regular backups\n\n` +
                  `💡 For production, use MongoDB Atlas automated backups with point-in-time recovery.`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to create database backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Start the server
const server = new PhotoVaultMCPServer();
server.run().catch(console.error);
