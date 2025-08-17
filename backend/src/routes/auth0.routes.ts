import { Router, Request, Response } from 'express';
import { auth0Service } from '../services/auth0.service';
import { checkJwt } from '../middleware/auth.middleware';
import { ensureUserMiddleware } from '../middleware/ensureUser.middleware';

const router = Router();

/**
 * Auth0 token verification endpoint
 * This endpoint accepts an Auth0 JWT token and syncs the user with MongoDB
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    const user = await auth0Service.processAuth0Token(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Auth0 verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * Get current user profile (Auth0 protected)
 */
router.get('/profile', checkJwt, ensureUserMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * Sync Auth0 user data manually
 */
router.post('/sync', checkJwt, ensureUserMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // User is already synced by the middleware, just return the user data
    res.json({
      success: true,
      user: req.user,
      message: 'User data synchronized successfully',
    });
  } catch (error) {
    console.error('Auth0 sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
