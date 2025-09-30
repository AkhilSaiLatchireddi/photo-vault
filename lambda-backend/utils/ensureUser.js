"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUserExists = ensureUserExists;
const database_service_1 = require("../services/database.service");
async function ensureUserExists(req) {
    const userId = req.auth?.payload.sub;
    const userEmail = req.auth?.payload.email;
    const userName = req.auth?.payload.name;
    const userPicture = req.auth?.payload.picture;
    const emailVerified = req.auth?.payload.email_verified;
    if (!userId) {
        throw new Error('User not authenticated');
    }
    // Get user from database or create if doesn't exist
    let user = await database_service_1.databaseService.getUserByAuth0Id(userId);
    if (!user) {
        // Extract username from email or use a default
        const username = userEmail ? userEmail.split('@')[0] : `user_${Date.now()}`;
        // Create user with Auth0 data
        user = await database_service_1.databaseService.createAuth0User({
            auth0Id: userId,
            username: username,
            email: userEmail || '',
            name: userName,
            picture: userPicture,
            emailVerified: emailVerified
        });
    }
    return user;
}
