# Deployment Guide

This guide explains how to deploy the PhotoVault application. The application consists of two main parts: a frontend (React application) and a backend (Node.js API).

## Deployment Overview

The recommended deployment strategy is:

-   **Frontend:** Deploy as a static site to **GitHub Pages**. This is handled automatically by a GitHub Actions workflow.
-   **Backend:** Deploy as a Node.js application to a cloud provider of your choice (e.g., AWS, Heroku, DigitalOcean).

## Frontend Deployment (GitHub Pages)

The frontend is designed to be deployed to GitHub Pages. A GitHub Actions workflow at `.github/workflows/deploy.yml` automates this process.

### Prerequisites

Before the deployment can succeed, you must configure a secret in your GitHub repository.

**1. Create the `VITE_API_BASE_URL` Secret:**

This secret tells the frontend where to find the backend API.

-   In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
-   Click **New repository secret**.
-   **Name:** `VITE_API_BASE_URL`
-   **Value:** The full URL to your deployed backend API. For example: `https://your-backend-api.com/api`

**2. Enable GitHub Pages:**

-   In your GitHub repository, go to **Settings > Pages**.
-   For the **Source**, select **Deploy from a branch**.
-   For the **Branch**, select **gh-pages**.
-   Click **Save**.

### How it Works

The GitHub Actions workflow will:
1.  Trigger automatically on every push to the `main` branch.
2.  Install dependencies and build the frontend application.
3.  Deploy the contents of the `frontend/dist` directory to the `gh-pages` branch.
4.  GitHub Pages will serve the content of the `gh-pages` branch as a static website.

## Backend Deployment

The backend is a standard Node.js application that can be deployed to any platform that supports Node.js.

### 1. Build the Backend

Before deploying, you need to build the TypeScript code into JavaScript.

```bash
npm run build:backend
```

This will create a `dist` directory inside the `backend` folder. You should deploy the contents of this `dist` directory, along with the `node_modules` and `package.json`.

### 2. Environment Variables

The backend requires the following environment variables to be set in your deployment environment:

-   `PORT`: The port the server should run on (e.g., `3001`).
-   `NODE_ENV`: Set to `production` for deployed environments.
-   `FRONTEND_URL`: The URL of your deployed frontend (e.g., `https://<your-username>.github.io/<your-repo-name>`). This is used for CORS configuration.
-   `AWS_REGION`: The AWS region for your S3 bucket (e.g., `us-east-1`).
-   `AWS_ACCESS_KEY_ID`: Your AWS access key ID.
-   `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key.
-   `S3_BUCKET_NAME`: The name of your AWS S3 bucket for photo storage.
-   `DATABASE_URL`: The connection string for your PostgreSQL or SQLite database. (e.g., `postgresql://user:password@host:port/database`)
-   `JWT_SECRET`: A long, random string used for signing authentication tokens.

### 3. Database Migration

After setting up your database and environment variables, you need to run the database migrations to create the necessary tables.

```bash
npx prisma migrate deploy
```

This command should be run as part of your deployment process, after the application is built and before it is started.
