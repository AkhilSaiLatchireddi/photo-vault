"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUserMiddleware = void 0;
const database_service_1 = require("../services/database.service");
async function fetchAuth0UserInfo(accessToken) {
    try {
        const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            return await response.json();
        }
        return null;
    }
    catch (error) {
        console.error('Error fetching Auth0 user info:', error);
        return null;
    }
}
const ensureUserMiddleware = async (req, res, next) => {
    try {
        if (!req.auth?.payload?.sub) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication payload'
            });
        }
        const auth0Id = req.auth.payload.sub;
        let email = (req.auth.payload.email || req.auth.payload[`${process.env.AUTH0_DOMAIN}/email`]);
        if (!email) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const accessToken = authHeader.substring(7);
                const userInfo = await fetchAuth0UserInfo(accessToken);
                if (userInfo) {
                    email = userInfo.email;
                }
            }
        }
        let user = await database_service_1.databaseService.getUserByAuth0Id(auth0Id);
        if (!user && email) {
            try {
                const name = req.auth.payload.name || email.split('@')[0];
                user = await database_service_1.databaseService.createAuth0User({
                    auth0Id,
                    username: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                    email: email,
                    name: name,
                    picture: req.auth.payload.picture
                });
            }
            catch (error) {
                console.error('Error creating user:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create user'
                });
            }
        }
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found and could not be created - email not available'
            });
        }
        req.user = {
            id: user._id?.toString() || '',
            username: user.username,
            email: user.email,
            sub: auth0Id
        };
        next();
    }
    catch (error) {
        console.error('Error in ensureUserMiddleware:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
exports.ensureUserMiddleware = ensureUserMiddleware;
