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

/**
 * Debug endpoint to inspect JWT token details
 */
router.post('/debug-token', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        success: false,
        message: 'No Bearer token provided',
      });
    }

    const token = authHeader.substring(7);
    
    // Decode JWT payload (without verification for debug purposes)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    res.json({
      success: true,
      tokenPayload: payload,
      expectedAudience: process.env.AUTH0_AUDIENCE,
      actualAudience: payload.aud,
      audienceMatch: payload.aud === process.env.AUTH0_AUDIENCE,
      issuer: payload.iss,
      subject: payload.sub,
      scopes: payload.scope
    });
  } catch (error) {
    console.error('Debug token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decode token',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
