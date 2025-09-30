"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth0_service_1 = require("../services/auth0.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ensureUser_middleware_1 = require("../middleware/ensureUser.middleware");
const router = (0, express_1.Router)();
/**
 * Auth0 token verification endpoint
 * This endpoint accepts an Auth0 JWT token and syncs the user with MongoDB
 */
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required',
            });
        }
        const user = await auth0_service_1.auth0Service.processAuth0Token(token);
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
    }
    catch (error) {
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
router.get('/profile', auth_middleware_1.checkJwt, ensureUser_middleware_1.ensureUserMiddleware, async (req, res) => {
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
    }
    catch (error) {
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
router.post('/sync', auth_middleware_1.checkJwt, ensureUser_middleware_1.ensureUserMiddleware, async (req, res) => {
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
    }
    catch (error) {
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
router.post('/debug-token', async (req, res) => {
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
    }
    catch (error) {
        console.error('Debug token error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to decode token',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});
exports.default = router;
