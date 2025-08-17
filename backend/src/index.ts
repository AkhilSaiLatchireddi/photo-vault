import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
<<<<<<< Updated upstream
=======
<<<<<<< HEAD
import { checkJwt } from './middleware/auth.middleware';
>>>>>>> Stashed changes
import { databaseService } from './services/database.service';

<<<<<<< Updated upstream
// Load environment variables
dotenv.config();
=======
// Load environment variables (for local development)
// In Lambda, environment variables are provided by AWS
if (process.env.NODE_ENV !== 'production') {
  debugLog('Loading .env file for development');
  dotenv.config();
} else {
  debugLog('Production mode - using environment variables from runtime');
}
=======
import { databaseService } from './services/database.service';

// Load environment variables
dotenv.config();
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes

const app = express();
const PORT = process.env.PORT || 3001;

<<<<<<< Updated upstream
=======
<<<<<<< HEAD
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

>>>>>>> Stashed changes
// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);


// ------------------------
// 🟢 CORS CONFIGURATION
// ------------------------
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true                // ✅ Important to allow cookies/auth
};


// CORS configuration
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
<<<<<<< Updated upstream
=======
  debugLog('Health check endpoint hit');
=======
// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);


// ------------------------
// 🟢 CORS CONFIGURATION
// ------------------------
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true                // ✅ Important to allow cookies/auth
};


// CORS configuration
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
  res.status(200).json({
    status: 'OK',
    message: 'PhotoVault API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
<<<<<<< Updated upstream
=======
<<<<<<< HEAD
    environment: process.env.NODE_ENV || 'development',
    region: process.env.AWS_REGION || 'us-east-1'
>>>>>>> Stashed changes
  });
});

// API routes
import authRoutes from './routes/auth.routes';
import fileRoutes from './routes/files.routes';

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Placeholder routes (for future implementation)
app.use('/api/memories', (req, res) => {
  res.status(501).json({ message: 'Memories routes not implemented yet' });
});

// 404 handler
app.use('*', (req, res) => {
<<<<<<< Updated upstream
=======
  debugLog('404 error - route not found', { originalUrl: req.originalUrl });
=======
  });
});

// API routes
import authRoutes from './routes/auth.routes';
import fileRoutes from './routes/files.routes';

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Placeholder routes (for future implementation)
app.use('/api/memories', (req, res) => {
  res.status(501).json({ message: 'Memories routes not implemented yet' });
});

// 404 handler
app.use('*', (req, res) => {
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware
<<<<<<< Updated upstream
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
=======
<<<<<<< HEAD
debugLog('Setting up error handling middleware');
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  debugLog('Error caught by error handler', { 
    error: err.message,
    status: err.status,
    path: req.originalUrl 
  });
=======
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

<<<<<<< Updated upstream
// Start server
async function startServer() {
=======
<<<<<<< HEAD
// Database initialization and server startup
async function initializeApp() {
  debugLog('Starting application initialization');
>>>>>>> Stashed changes
  try {
    // Initialize database
    await databaseService.initialize();
    console.log('✅ Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`🚀 PhotoVault API server running on port ${PORT}`);
      console.log(`📱 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`📸 Files endpoints: http://localhost:${PORT}/api/files`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

<<<<<<< Updated upstream
startServer();
=======
// Initialize the app
initializeApp();
=======
// Start server
async function startServer() {
  try {
    // Initialize database
    await databaseService.initialize();
    console.log('✅ Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`🚀 PhotoVault API server running on port ${PORT}`);
      console.log(`📱 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`📸 Files endpoints: http://localhost:${PORT}/api/files`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes

export default app;
