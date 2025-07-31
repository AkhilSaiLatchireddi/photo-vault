# Terraform Infrastructure as Code

## 🎯 Overview
Implement Infrastructure as Code (IaC) using Terraform to manage all AWS resources for PhotoVault. This ensures reproducible, version-controlled, and scalable infrastructure deployment across multiple environments.

## 📋 Requirements

### Functional Requirements
- **Multi-Environment Support**: Dev, staging, and production environments
- **Resource Management**: All AWS services defined as Terraform resources
- **State Management**: Remote state storage and locking
- **Security**: IAM roles, policies, and security groups as code
- **Scalability**: Auto-scaling groups and load balancers
- **Monitoring**: CloudWatch, alarms, and dashboards
- **Backup**: Automated backup policies and retention

### Non-Functional Requirements
- **Modularity**: Reusable Terraform modules
- **Documentation**: Self-documenting infrastructure code
- **Compliance**: Security and compliance policies enforced
- **Cost Optimization**: Resource tagging and cost allocation
- **Disaster Recovery**: Multi-region deployment capability

## 🏗️ Terraform Project Structure

```
infrastructure/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── terraform.tfvars
├── modules/
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── s3/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── cognito/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── rds/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── lambda/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── cloudfront/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── monitoring/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── shared/
│   ├── backend.tf
│   ├── providers.tf
│   └── variables.tf
└── scripts/
    ├── deploy.sh
    ├── destroy.sh
    └── plan.sh
```

## 📝 Sub-Tasks

### Phase T1: Core Infrastructure Setup
- [ ] **Terraform Backend Configuration**
  - S3 bucket for state storage
  - DynamoDB table for state locking
  - IAM roles for Terraform execution
  - Backend configuration for all environments

**Effort:** 2 days
**Priority:** High

- [ ] **VPC and Networking Module**
  - VPC with public/private subnets
  - Internet Gateway and NAT Gateways
  - Route tables and security groups
  - Network ACLs and flow logs

**Effort:** 3 days
**Priority:** High

- [ ] **S3 Storage Module**
  - S3 buckets for photo storage
  - Bucket policies and CORS configuration
  - Lifecycle policies for cost optimization
  - CloudFront distribution setup

**Effort:** 2 days
**Priority:** High

### Phase T2: Application Infrastructure
- [ ] **Cognito Authentication Module**
  - User pools and identity pools
  - App clients and domain configuration
  - Custom attributes and policies
  - MFA and password policies

**Effort:** 2 days
**Priority:** High

- [ ] **RDS Database Module**
  - PostgreSQL RDS instance
  - Subnet groups and parameter groups
  - Backup and maintenance windows
  - Read replicas for scaling

**Effort:** 3 days
**Priority:** High

- [ ] **Lambda Functions Module**
  - Lambda functions and layers
  - IAM roles and policies
  - Environment variables management
  - Dead letter queues and monitoring

**Effort:** 4 days
**Priority:** Medium

### Phase T3: Advanced Services
- [ ] **API Gateway Module**
  - REST API and resources
  - Lambda integrations
  - Custom authorizers
  - Rate limiting and caching

**Effort:** 3 days
**Priority:** Medium

- [ ] **ElastiCache Module**
  - Redis cluster for caching
  - Subnet groups and security
  - Backup and maintenance
  - Parameter groups

**Effort:** 2 days
**Priority:** Low

- [ ] **Elasticsearch/OpenSearch Module**
  - Search domain configuration
  - Access policies and security
  - Index templates and mappings
  - Monitoring and alerting

**Effort:** 3 days
**Priority:** Low

### Phase T4: Monitoring and Security
- [ ] **CloudWatch Monitoring Module**
  - Log groups and retention
  - Custom metrics and alarms
  - Dashboards and insights
  - SNS notifications

**Effort:** 2 days
**Priority:** Medium

- [ ] **WAF and Security Module**
  - WAF web ACLs and rules
  - Shield protection
  - GuardDuty configuration
  - Config rules compliance

**Effort:** 3 days
**Priority:** Medium

- [ ] **Backup and DR Module**
  - AWS Backup configuration
  - Cross-region replication
  - Disaster recovery procedures
  - Recovery testing automation

**Effort:** 4 days
**Priority:** Low

## 🔧 Implementation Examples

### Main Environment Configuration
```hcl
# environments/dev/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "photovault-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "PhotoVault"
      ManagedBy   = "Terraform"
    }
  }
}

module "vpc" {
  source = "../../modules/vpc"
  
  environment = var.environment
  cidr_block  = var.vpc_cidr
  
  availability_zones = var.availability_zones
  public_subnets     = var.public_subnets
  private_subnets    = var.private_subnets
}

module "s3" {
  source = "../../modules/s3"
  
  environment = var.environment
  bucket_name = var.s3_bucket_name
  
  lifecycle_rules = var.s3_lifecycle_rules
  cors_rules     = var.s3_cors_rules
}

module "cognito" {
  source = "../../modules/cognito"
  
  environment = var.environment
  user_pool_name = var.cognito_user_pool_name
  
  password_policy = var.cognito_password_policy
  mfa_configuration = var.cognito_mfa_config
}
```

### S3 Module
```hcl
# modules/s3/main.tf
resource "aws_s3_bucket" "photos" {
  bucket = "${var.bucket_name}-${var.environment}"
}

resource "aws_s3_bucket_versioning" "photos" {
  bucket = aws_s3_bucket.photos.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "photos" {
  bucket = aws_s3_bucket.photos.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  dynamic "rule" {
    for_each = var.lifecycle_rules
    content {
      id     = rule.value.id
      status = rule.value.status

      transition {
        days          = rule.value.transition_days
        storage_class = rule.value.storage_class
      }
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  dynamic "cors_rule" {
    for_each = var.cors_rules
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      expose_headers  = cors_rule.value.expose_headers
      max_age_seconds = cors_rule.value.max_age_seconds
    }
  }
}
```

### Lambda Module
```hcl
# modules/lambda/main.tf
resource "aws_iam_role" "lambda_role" {
  name = "${var.function_name}-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_role.name
}

resource "aws_lambda_function" "function" {
  filename         = var.zip_file
  function_name    = "${var.function_name}-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = var.handler
  runtime         = var.runtime
  timeout         = var.timeout
  memory_size     = var.memory_size

  dynamic "environment" {
    for_each = var.environment_variables != null ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  dynamic "vpc_config" {
    for_each = var.vpc_config != null ? [1] : []
    content {
      subnet_ids         = var.vpc_config.subnet_ids
      security_group_ids = var.vpc_config.security_group_ids
    }
  }
}
```

## 🧪 Testing Strategy

### Infrastructure Testing
- **Terraform Plan**: Validate changes before apply
- **Terratest**: Automated infrastructure testing
- **Compliance Testing**: Policy validation
- **Cost Analysis**: Resource cost estimation

### Environment Validation
- **Health Checks**: Service availability tests
- **Integration Tests**: Cross-service communication
- **Performance Tests**: Load and stress testing
- **Security Scans**: Vulnerability assessments

## 🚀 Deployment Strategy

### GitOps Workflow
```yaml
# .github/workflows/terraform.yml
name: Terraform Infrastructure

on:
  push:
    paths:
      - 'infrastructure/**'
    branches:
      - main
      - develop
  pull_request:
    paths:
      - 'infrastructure/**'

jobs:
  terraform:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, prod]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.5.0
      
      - name: Terraform Plan
        run: |
          cd infrastructure/environments/${{ matrix.environment }}
          terraform init
          terraform plan -var-file=terraform.tfvars
      
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: |
          cd infrastructure/environments/${{ matrix.environment }}
          terraform apply -auto-approve -var-file=terraform.tfvars
```

### Environment Promotion
- **Dev Environment**: Automatic deployment on PR merge
- **Staging Environment**: Manual approval required
- **Production Environment**: Tagged releases only

## 💰 Cost Management

### Resource Tagging Strategy
```hcl
locals {
  common_tags = {
    Environment = var.environment
    Project     = "PhotoVault"
    ManagedBy   = "Terraform"
    Owner       = var.owner
    CostCenter  = var.cost_center
  }
}
```

### Cost Optimization
- **Right-sizing**: Instance and storage optimization
- **Reserved Instances**: For predictable workloads
- **Spot Instances**: For non-critical batch jobs
- **Lifecycle Policies**: Automated storage tiering

## 📊 Monitoring and Alerting

### CloudWatch Integration
- **Resource Metrics**: CPU, memory, storage usage
- **Custom Metrics**: Application-specific metrics
- **Log Aggregation**: Centralized logging
- **Alerting**: SNS notifications for issues

### Cost Monitoring
- **Budget Alerts**: Monthly cost thresholds
- **Resource Utilization**: Underused resources
- **Cost Attribution**: Environment and service costs

## 🔗 Related Features

- [AWS Lambda Integration](./27-aws-lambda-integration.md) - Serverless functions
- [GitHub Actions CI/CD](./29-github-actions.md) - Deployment pipeline
- [Monitoring & Observability](./30-monitoring.md) - System monitoring
- [Security & Compliance](./31-security.md) - Infrastructure security
