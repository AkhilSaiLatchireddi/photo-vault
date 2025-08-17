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

// Rate limiting (less aggressive for Lambda due to cold starts)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 1000, // More lenient for Lambda
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
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

// Health check endpoint
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

// Database initialization and server startup
async function initializeApp() {
  try {
    // Initialize database connection
    console.log('🔌 Initializing database connection...');
    await databaseService.initialize();
    console.log('✅ Database connection established');
    
    // In Lambda, we don't start a server - the handler takes care of requests
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log('🚀 PhotoVault API initialized for Lambda');
    } else {
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

// Initialize the app
initializeApp();

export default app;
