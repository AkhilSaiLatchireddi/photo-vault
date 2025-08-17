"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth0_service_1 = require("../services/auth0.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ensureUser_middleware_1 = require("../middleware/ensureUser.middleware");
const router = (0, express_1.Router)();
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
router.post('/sync', auth_middleware_1.checkJwt, ensureUser_middleware_1.ensureUserMiddleware, async (req, res) => {
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
exports.default = router;
