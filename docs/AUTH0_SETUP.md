# Auth0 Integration Setup Guide

This guide will help you set up Auth0 authentication for your PhotoVault application.

## Prerequisites

1. An Auth0 account (create one at [auth0.com](https://auth0.com))
2. Basic understanding of single page applications (SPAs)

## Auth0 Setup

### 1. Create an Auth0 Application

1. Go to your [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose:
   - **Name**: PhotoVault (or your preferred name)
   - **Application Type**: Single Page Web Applications
5. Click **Create**

### 2. Configure Application Settings

In your newly created application, go to the **Settings** tab and configure:

#### Allowed Callback URLs
```
http://localhost:3000,
https://your-production-domain.com
```

#### Allowed Logout URLs
```
http://localhost:3000,
https://your-production-domain.com
```

#### Allowed Web Origins
```
http://localhost:3000,
https://your-production-domain.com
```

#### Allowed Origins (CORS)
```
http://localhost:3000,
https://your-production-domain.com
```

### 3. Create an API

1. Navigate to **Applications** → **APIs**
2. Click **Create API**
3. Configure:
   - **Name**: PhotoVault API
   - **Identifier**: `https://photovault-api.example.com` (this is your audience)
   - **Signing Algorithm**: RS256

### 4. Get Your Configuration Values

From your application settings, note down:
- **Domain** (e.g., `your-app.auth0.com`)
- **Client ID**
- **API Identifier** (from the API you created - this is your audience)

## Environment Configuration

### Backend (.env)

Add these variables to your backend `.env` file:

```bash
# Auth0 Configuration
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_AUDIENCE=https://photovault-api.example.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
```

### Frontend (.env)

Add these variables to your frontend `.env` file:

```bash
# Auth0 Configuration
VITE_AUTH0_DOMAIN=your-auth0-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=https://photovault-api.example.com

# API Configuration
VITE_API_BASE_URL=/api
```

## How It Works

### Backend Integration

1. **Auth0 Service** (`auth0.service.ts`):
   - Verifies JWT tokens from Auth0
   - Syncs user data with MongoDB
   - Manages user profiles

2. **Auth0 Middleware** (`auth0.middleware.ts`):
   - Protects API routes
   - Automatically syncs user data on each request

3. **Database Integration**:
   - Users are automatically created in MongoDB when they first authenticate
   - User data is kept in sync with Auth0 profile information

### Frontend Integration

1. **Auth0 Context** (`Auth0Context.tsx`):
   - Manages authentication state
   - Handles login/logout
   - Syncs user data with backend

2. **Protected Routes**:
   - Automatically redirects unauthenticated users to login
   - Provides user context throughout the application

## API Endpoints

### Auth0 Routes (`/api/auth0/`)

- **POST /verify**: Verify Auth0 token and sync user
- **GET /profile**: Get current user profile (Auth0 protected)
- **POST /sync**: Manually sync user data

### Traditional Auth Routes (`/api/auth/`)

- **POST /register**: Register with email/password (legacy)
- **POST /login**: Login with email/password (legacy)
- **POST /verify-token**: Verify JWT token (legacy)

## User Data Structure

Users in MongoDB will have this structure:

```typescript
interface User {
  _id: ObjectId;
  username: string;
  email: string;
  password?: string; // Only for legacy users
  auth0Id?: string; // Auth0 user ID
  name?: string; // Full name from Auth0
  picture?: string; // Profile picture from Auth0
  emailVerified?: boolean; // Email verification status
  created_at: Date;
  updated_at: Date;
}
```

## Testing the Integration

1. Start your backend server:
   ```bash
   cd backend && npm run dev
   ```

2. Start your frontend development server:
   ```bash
   cd frontend && npm run dev
   ```

3. Visit `http://localhost:3000`
4. Click "Sign In with Auth0"
5. Complete the Auth0 authentication flow
6. You should be redirected back to the application as an authenticated user

## Troubleshooting

### Common Issues

1. **CORS Errors**:
   - Ensure your frontend URL is in Auth0's Allowed Origins (CORS)
   - Check that CORS is properly configured in your backend

2. **Token Verification Errors**:
   - Verify that your AUTH0_DOMAIN and AUTH0_AUDIENCE are correct
   - Ensure the API identifier matches exactly

3. **Redirect Issues**:
   - Check that your callback URLs are correctly configured in Auth0
   - Ensure the redirect URI in your frontend config matches Auth0 settings

### Debug Mode

Enable debug mode by setting environment variables:

Backend:
```bash
DEBUG=auth0:*
```

Frontend (in browser console):
```javascript
localStorage.setItem('auth0:debug', 'true')
```

## Security Considerations

1. **Environment Variables**: Never commit real Auth0 credentials to version control
2. **HTTPS**: Use HTTPS in production for secure token transmission
3. **Token Storage**: Tokens are stored securely using Auth0's recommended practices
4. **CORS**: Properly configure CORS settings to prevent unauthorized access

## Migration from Traditional Auth

If you have existing users with email/password authentication:

1. They can continue using the traditional login (`/api/auth/login`)
2. Encourage them to create Auth0 accounts with the same email
3. Implement a migration flow to link accounts if needed

The system supports both authentication methods simultaneously.
