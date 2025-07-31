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
