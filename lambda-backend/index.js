"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_middleware_1 = require("./middleware/auth.middleware");
const database_service_1 = require("./services/database.service");
const profile_routes_1 = __importDefault(require("./routes/profile.routes"));
const auth0_routes_1 = __importDefault(require("./routes/auth0.routes"));
const files_routes_1 = __importDefault(require("./routes/files.routes"));
if (process.env.NODE_ENV !== 'production') {
    dotenv_1.default.config();
}
const DEBUG = process.env.DEBUG === 'true';
const debugLog = (...args) => {
    if (DEBUG) {
        console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
};
debugLog('🚀 Starting PhotoVault Lambda initialization');
debugLog('Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
    DEBUG: process.env.DEBUG
});
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
debugLog('📡 Setting trust proxy to true');
app.set('trust proxy', true);
const getAllowedOrigins = () => {
    const origins = ['http://localhost:3000'];
    if (process.env.NODE_ENV === 'production') {
        origins.push('https://akhilsailatchireddi.github.io');
    }
    else {
        const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 3000}`;
        if (!origins.includes(frontendUrl)) {
            origins.push(frontendUrl);
        }
    }
    return origins;
};
app.use((0, helmet_1.default)({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
        },
    } : false
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 1000 : 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const forwardedFor = req.headers['x-forwarded-for'];
        const clientIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        return clientIp || req.connection.remoteAddress || 'unknown';
    },
    skip: (req) => {
        return req.path === '/health';
    },
});
app.use('/api', limiter);
app.use('/api', async (req, res, next) => {
    try {
        await initializeDatabaseIfNeeded();
        next();
    }
    catch (error) {
        console.error('Database not available:', error);
        res.status(503).json({
            error: 'Service Unavailable',
            message: 'Database connection failed'
        });
    }
});
const corsOptions = {
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});
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
app.get("/api/external", auth_middleware_1.checkJwt, (req, res) => {
    res.send({
        msg: "Your access token was successfully validated!",
        user: req.auth
    });
});

// Database initialization middleware - ensure DB is ready for each API call
app.use('/api', async (req, res, next) => {
    debugLog('Database middleware called', { 
        path: req.path, 
        method: req.method,
        isDbInitialized 
    });
    
    try {
        if (!isDbInitialized) {
            debugLog('Database not initialized, initializing now...');
            await initializeDatabaseIfNeeded();
            debugLog('Database initialization completed in middleware');
        }
        next();
    } catch (error) {
        debugLog('❌ Database initialization failed in middleware', {
            errorMessage: error.message,
            path: req.path,
            method: req.method
        });
        
        res.status(500).json({
            success: false,
            error: 'Database connection failed',
            details: DEBUG ? error.message : undefined
        });
    }
});

debugLog('Setting up API routes...');
app.use('/api/profile', profile_routes_1.default);
app.use('/api/auth0', auth0_routes_1.default);
app.use('/api/files', files_routes_1.default);
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
    });
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
});
let isDbInitialized = false;
async function initializeDatabaseIfNeeded() {
    debugLog('initializeDatabaseIfNeeded() called', { isDbInitialized });
    
    if (isDbInitialized) {
        debugLog('Database already initialized, skipping');
        return;
    }
    
    try {
        debugLog('🔌 Starting database initialization...');
        console.log('🔌 Initializing database connection...');
        
        debugLog('Creating database initialization promise...');
        const dbPromise = database_service_1.databaseService.initialize();
        
        debugLog('Creating timeout promise (10 seconds)...');
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database connection timeout')), 10000)
        );
        
        debugLog('Racing database connection vs timeout...');
        await Promise.race([dbPromise, timeoutPromise]);
        
        isDbInitialized = true;
        debugLog('✅ Database initialization completed successfully');
        console.log('✅ Database connection established');
    }
    catch (error) {
        debugLog('❌ Database initialization failed', {
            errorMessage: error.message,
            errorName: error.name,
            errorStack: error.stack
        });
        console.error('❌ Database connection failed:', error);
        isDbInitialized = false;
        throw error;
    }
}
async function initializeApp() {
    debugLog('initializeApp() called');
    
    try {
        debugLog('Checking environment type', {
            isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
            lambdaFunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME
        });
        
        if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
            debugLog('Lambda environment detected, initializing database...');
            // Initialize database for Lambda environment too!
            await initializeDatabaseIfNeeded();
            debugLog('Lambda database initialization completed');
            console.log('🚀 PhotoVault API initialized for Lambda');
        }
        else {
            debugLog('Local environment detected, initializing database and starting server...');
            await initializeDatabaseIfNeeded();
            app.listen(PORT, () => {
                debugLog('Local server started', { port: PORT });
                console.log(`🚀 PhotoVault API server running on port ${PORT}`);
                console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
                console.log(`🔗 CORS Origins: ${getAllowedOrigins().join(', ')}`);
            });
        }
        
        debugLog('App initialization completed successfully');
    }
    catch (error) {
        debugLog('❌ App initialization failed', {
            errorMessage: error.message,
            errorName: error.name,
            errorStack: error.stack,
            isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME
        });
        console.error('❌ Failed to initialize app:', error);
        
        if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
            debugLog('Exiting process due to initialization failure');
            process.exit(1);
        }
    }
}
initializeApp();
exports.default = app;
