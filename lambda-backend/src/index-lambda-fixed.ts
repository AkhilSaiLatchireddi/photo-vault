import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { checkJwt } from './middleware/auth.middleware';
import { databaseService } from './services/database.service';
import profileRoutes from './routes/profile.routes';
import auth0Routes from './routes/auth0.routes';
import filesRoutes from './routes/files.routes';

// Load environment variables (for local development)
// In Lambda, environment variables are provided by AWS
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3001;

// **LAMBDA FIX 1: Enable trust proxy for API Gateway**
app.set('trust proxy', true);

// Determine CORS origins based on environment
const getAllowedOrigins = () => {
  const origins = ['http://localhost:3000']; // Always allow localhost for development
  
  if (process.env.NODE_ENV === 'production') {
    origins.push('https://akhilsailatchireddi.github.io');
  } else {
    // For local development, also allow the frontend URL if specified
    const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 3000}`;
    if (!origins.includes(frontendUrl)) {
      origins.push(frontendUrl);
    }
  }
  
  return origins;
};

// Security middleware
app.use(helmet({
  // Configure CSP for Lambda/API Gateway
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  } : false // Disable CSP in development
}));

// **LAMBDA FIX 2: More lenient rate limiting for Lambda**
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 1000, // Very lenient for Lambda
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});
app.use('/api', limiter);

// CORS configuration
const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging for Lambda
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'PhotoVault API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    region: process.env.AWS_REGION || 'us-east-1'
  });
});

// Public API endpoint for testing (similar to Auth0 sample)
app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!",
    user: req.auth
  });
});

// Routes
app.use('/api/profile', profileRoutes);
app.use('/api/auth0', auth0Routes);
app.use('/api/files', filesRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// **LAMBDA FIX 3: Database connection with timeout and lazy initialization**
let isDbInitialized = false;

async function initializeDatabaseIfNeeded() {
  if (isDbInitialized) return;
  
  try {
    console.log('🔌 Initializing database connection...');
    
    // Add timeout for database connection
    const dbPromise = databaseService.initialize();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 10000)
    );
    
    await Promise.race([dbPromise, timeoutPromise]);
    isDbInitialized = true;
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    // In Lambda, we'll try again on next request
    isDbInitialized = false;
    throw error;
  }
}

// Database initialization and server startup
async function initializeApp() {
  try {
    // In Lambda, we don't start a server - the handler takes care of requests
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log('🚀 PhotoVault API initialized for Lambda');
      // Don't initialize DB here in Lambda - do it lazily on first request
    } else {
      // Initialize database connection for local development
      await initializeDatabaseIfNeeded();
      
      // Start server for local development
      app.listen(PORT, () => {
        console.log(`🚀 PhotoVault API server running on port ${PORT}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 CORS Origins: ${getAllowedOrigins().join(', ')}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
      process.exit(1);
    }
  }
}

// **LAMBDA FIX 4: Add middleware to ensure DB is ready before processing requests**
app.use('/api', async (req, res, next) => {
  try {
    await initializeDatabaseIfNeeded();
    next();
  } catch (error) {
    console.error('Database not available:', error);
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database connection failed'
    });
  }
});

// Initialize the app
initializeApp();

export default app;

// **LAMBDA FIX 5: Export Lambda handler with serverless-http**
import serverlessExpress from 'serverless-http';

export const handler = serverlessExpress(app, {
  binary: ['image/*', 'application/octet-stream'],
  request: (request: any, event: any, context: any) => {
    request.context = context;
    request.event = event;
  },
  response: (response: any, event: any, context: any) => {
    response.headers = {
      ...response.headers,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
  }
});
