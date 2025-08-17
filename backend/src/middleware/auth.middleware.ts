<<<<<<< Updated upstream
import { Request, Response, NextFunction } from 'express';
import { authService, AuthUser } from '../services/auth.service';
=======
<<<<<<< HEAD
import { auth } from "express-oauth2-jwt-bearer";
>>>>>>> Stashed changes

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user to request object
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const user = await authService.verifyToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user to request if token is provided, but doesn't fail if not
 */
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

<<<<<<< Updated upstream
=======
console.log('🔐 Auth0 Configuration:', {
  domain: authConfig.domain,
  audience: authConfig.audience,
  environment: process.env.NODE_ENV || 'development',
  isLambda: isLambdaEnvironment
});

// Create the JWT validation middleware
export const checkJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}/`,
  tokenSigningAlg: 'RS256',
});

// Export auth config for use in other modules
export { authConfig };
=======
import { Request, Response, NextFunction } from 'express';
import { authService, AuthUser } from '../services/auth.service';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user to request object
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const user = await authService.verifyToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user to request if token is provided, but doesn't fail if not
 */
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

>>>>>>> Stashed changes
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await authService.verifyToken(token);
      
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    console.warn('Optional auth middleware warning:', error);
    next();
  }
};
<<<<<<< Updated upstream
=======
>>>>>>> c29745ad016536b3fcc94cb0b4d91795b91dcfdc
>>>>>>> Stashed changes
