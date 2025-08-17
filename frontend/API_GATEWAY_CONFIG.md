# 🌐 Frontend → API Gateway Configuration

## ✅ **Configuration Complete**

Your frontend is now configured to use the AWS Lambda API Gateway instead of the local backend!

### **API Endpoint Configuration**
```bash
# Previous (Local Backend)
VITE_API_BASE_URL=http://localhost:3001

# Current (AWS API Gateway)
VITE_API_BASE_URL=https://gpfrcq5qz2.execute-api.us-east-1.amazonaws.com/prod-v1
```

### **Frontend Status**
- 🚀 **Running on**: http://localhost:3000
- 🌐 **API Target**: AWS Lambda via API Gateway
- ✅ **CORS**: Configured and working
- 🔐 **Auth0**: Configured for production

## 🧪 **Verification Results**

### **API Gateway Health Check**
```json
{
  "status": "OK",
  "message": "PhotoVault API is running",
  "timestamp": "2025-08-17T10:47:18.029Z",
  "version": "1.0.0",
  "environment": "production",
  "region": "us-east-1"
}
```

### **CORS Configuration**
```
✅ Access-Control-Allow-Origin: *
✅ Access-Control-Allow-Methods: DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT
✅ Access-Control-Allow-Headers: Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token
```

## 🎯 **What This Means**

1. **Frontend Development**: Your React app runs locally on `localhost:3000`
2. **API Calls**: All API requests go to AWS Lambda (production backend)
3. **Authentication**: Uses production Auth0 configuration
4. **File Storage**: Connects to production S3 bucket
5. **Database**: Uses production MongoDB cluster

## 🔍 **Testing Your Setup**

### **1. Open Frontend**
Visit: http://localhost:3000

### **2. Check Browser DevTools**
- **Network Tab**: Should show requests to `gpfrcq5qz2.execute-api.us-east-1.amazonaws.com`
- **Console**: Should show successful API responses
- **Application Tab**: Auth0 tokens should be stored

### **3. Test Key Features**
- ✅ Login with Auth0
- ✅ View health status
- ✅ Upload photos (to production S3)
- ✅ View photo gallery
- ✅ Download photos

## 🚨 **Important Notes**

### **Production Data**
- **Database**: You're using the PRODUCTION MongoDB cluster
- **Storage**: Files are uploaded to PRODUCTION S3 bucket  
- **Auth**: Production Auth0 tenant

### **API Endpoints Available**
```
GET  /health                    - Health check (public)
POST /api/auth0/exchange-token  - Auth0 token exchange
GET  /api/profile              - User profile (auth required)
GET  /api/files                - List photos (auth required)
POST /api/files/upload-url     - Get upload URL (auth required)
GET  /api/files/:id/download   - Download photo (auth required)
DELETE /api/files/:id          - Delete photo (auth required)
GET  /api/files/stats          - User statistics (auth required)
```

## 🛠️ **Switching Back to Local**

To switch back to local development:
```bash
# Edit frontend/.env
VITE_API_BASE_URL=http://localhost:3001

# Then restart frontend
npm run dev
```

## 🎉 **Success!**

Your PhotoVault frontend now communicates directly with your AWS Lambda backend through API Gateway. This is essentially a **hybrid development setup** where you develop the frontend locally but use the production backend infrastructure!
