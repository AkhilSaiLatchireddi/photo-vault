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
import albumsRoutes from './routes/albums.routes';
import publicRoutes from './routes/public.routes';

// Debug logging setup
const DEBUG = process.env.DEBUG === 'true';
const debugLog = (message: string, data?: any) => {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[BACKEND-DEBUG] ${timestamp}: ${message}`, data || '');
  }
};

debugLog('Backend application starting', { nodeEnv: process.env.NODE_ENV });

// Load environment variables (for local development)
// In Lambda, environment variables are provided by AWS
if (process.env.NODE_ENV !== 'production') {
  debugLog('Loading .env file for development');
  dotenv.config();
} else {
  debugLog('Production mode - using environment variables from runtime');
}

const app = express();
const PORT = process.env.PORT || 3001;

debugLog('Express app created', { port: PORT });

// Determine CORS origins based on environment
const getAllowedOrigins = () => {
  debugLog('Calculating allowed CORS origins');
  const origins = ['http://localhost:3000']; // Always allow localhost for development
  
  if (process.env.NODE_ENV === 'production') {
    origins.push('https://akhilsailatchireddi.github.io');
    debugLog('Production mode - added GitHub Pages origin');
  } else {
    // For local development, also allow the frontend URL if specified
    const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 3000}`;
    if (!origins.includes(frontendUrl)) {
      origins.push(frontendUrl);
    }
    debugLog('Development mode - added local frontend URLs');
  }
  
  debugLog('CORS origins configured', { origins });
  return origins;
};

// Security middleware
debugLog('Configuring security middleware');
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

// Rate limiting (less aggressive for Lambda due to cold starts)
debugLog('Configuring rate limiting');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 1000, // More lenient for Lambda
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// CORS configuration
debugLog('Configuring CORS');
const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

// Body parsing middleware
debugLog('Configuring body parsing middleware');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging for Lambda
debugLog('Configuring request logging middleware');
app.use((req, res, next) => {
  const start = Date.now();
  debugLog('Request received', { method: req.method, path: req.path, headers: req.headers.authorization ? 'Bearer ***' : 'none' });
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    debugLog('Request completed', { method: req.method, path: req.path, status: res.statusCode, duration: `${duration}ms` });
  });
  next();
});

// Health check endpoint
debugLog('Setting up health check endpoint');
app.get('/health', (req, res) => {
  debugLog('Health check endpoint hit');
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
debugLog('Setting up external API test endpoint');
app.get("/api/external", checkJwt, (req, res) => {
  debugLog('External API endpoint hit', { hasAuth: !!req.auth });
  res.send({
    msg: "Your access token was successfully validated!",
    user: req.auth
  });
});

// Routes
debugLog('Configuring API routes');
app.use('/api/profile', profileRoutes);
app.use('/api/auth0', auth0Routes);
app.use('/api/files', filesRoutes);
app.use('/api/albums', albumsRoutes);
app.use('/api/public/albums', publicRoutes); // Public routes - no auth required

// 404 handler
debugLog('Setting up 404 handler');
app.use('*', (req, res) => {
  debugLog('404 error - route not found', { originalUrl: req.originalUrl });
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware
debugLog('Setting up error handling middleware');
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  debugLog('Error caught by error handler', { 
    error: err.message,
    status: err.status,
    path: req.originalUrl 
  });
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Database initialization and server startup
async function initializeApp() {
  debugLog('Starting application initialization');
  try {
    // Initialize database connection
    debugLog('Initializing database connection');
    console.log('🔌 Initializing database connection...');
    await databaseService.initialize();
    debugLog('Database connection established successfully');
    console.log('✅ Database connection established');
    
    // In Lambda, we don't start a server - the handler takes care of requests
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      debugLog('Lambda environment detected - API ready');
      console.log('🚀 PhotoVault API initialized for Lambda');
    } else {
      debugLog('Local development environment - starting server');
      // Start server for local development
      app.listen(PORT, () => {
        debugLog('Local server started successfully', { port: PORT });
        console.log(`🚀 PhotoVault API server running on port ${PORT}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 CORS Origins: ${getAllowedOrigins().join(', ')}`);
      });
    }
  } catch (error) {
    debugLog('Application initialization failed', { error: error instanceof Error ? error.message : String(error) });
    console.error('❌ Failed to initialize app:', error);
    if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
      process.exit(1);
    }
  }
}

// Initialize the app
initializeApp();

export default app;
