# MongoDB Migration Guide

This document explains how to set up and use MongoDB instead of SQLite for the PhotoVault backend.

## Prerequisites

1. **MongoDB Atlas Account**: Create a free MongoDB Atlas account at [mongodb.com](https://www.mongodb.com/cloud/atlas)
2. **Database Cluster**: Set up a cluster and obtain your connection string

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the backend directory based on `.env.example`:

```bash
cp .env.example .env
```

Update the following MongoDB-related variables in your `.env` file:

```bash
MONGODB_USERNAME=your_mongodb_username
MONGODB_PASSWORD=your_mongodb_password
```

Replace:
- `your_mongodb_username` with your MongoDB Atlas username
- `your_mongodb_password` with your MongoDB Atlas password

### 2. MongoDB Connection String

The application is configured to use MongoDB Atlas with this connection string pattern:
```
mongodb+srv://<username>:<password>@photovault.czk6x9q.mongodb.net/?retryWrites=true&w=majority&appName=photovault
```

If you have a different cluster URL, update the `uri` in `src/services/database.service.ts`.

### 3. Install Dependencies

The MongoDB driver has already been installed:
```bash
npm install mongodb @types/mongodb
```

### 4. Test the Connection

Run the test script to verify your MongoDB connection:
```bash
npx ts-node test-db.ts
```

If successful, you should see:
```
Testing MongoDB connection...
✅ Connected to MongoDB and database initialized successfully
✅ Database indexes created successfully
✅ MongoDB connection successful!
✅ MongoDB connection closed.
```

### 5. Start the Server

```bash
npm run dev
```

## Key Changes Made

### Database Service (`src/services/database.service.ts`)
- ✅ Replaced SQLite with MongoDB driver
- ✅ Updated interfaces to use MongoDB ObjectId instead of integer IDs
- ✅ Implemented MongoDB collections for users and photos
- ✅ Added proper indexing for performance
- ✅ Updated all CRUD operations for MongoDB

### Auth Service (`src/services/auth.service.ts`)
- ✅ Updated to work with MongoDB ObjectId strings
- ✅ Fixed user ID handling in JWT tokens

### File Routes (`src/routes/files.routes.ts`)
- ✅ Updated photo ID validation to use ObjectId.isValid()
- ✅ Fixed metadata handling (now stored as objects instead of JSON strings)
- ✅ Updated all database calls to work with ObjectId

### Removed Dependencies
- ❌ `sqlite3`
- ❌ `sqlite` 
- ❌ `@types/sqlite3`

### Added Dependencies
- ✅ `mongodb`
- ✅ `@types/mongodb`

## MongoDB vs SQLite Differences

| Feature | SQLite | MongoDB |
|---------|---------|----------|
| ID Type | `INTEGER` auto-increment | `ObjectId` |
| Storage | File-based | Cloud/Server-based |
| Metadata | JSON strings | Native objects |
| Indexing | Manual SQL | Built-in index methods |
| Relationships | Foreign keys | Document references |
| Queries | SQL | MongoDB query language |

## Data Migration

If you have existing SQLite data, you'll need to:

1. Export data from SQLite
2. Transform the data structure (IDs, metadata format)
3. Import into MongoDB

This is beyond the scope of this automatic migration but can be implemented as a separate script if needed.

## Troubleshooting

### Connection Issues
- Verify your MongoDB Atlas credentials
- Check if your IP address is whitelisted in MongoDB Atlas
- Ensure the cluster is running and accessible

### Environment Variables
- Make sure `.env` file exists and has correct values
- Verify there are no spaces around the `=` in env variables

### ObjectId Errors
- Ensure you're using valid ObjectId strings (24 hex characters)
- Use `ObjectId.isValid()` to check ID validity before database operations
