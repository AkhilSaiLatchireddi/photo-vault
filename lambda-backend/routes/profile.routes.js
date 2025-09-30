"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ensureUser_middleware_1 = require("../middleware/ensureUser.middleware");
const database_service_1 = require("../services/database.service");
const express_validator_1 = require("express-validator");
const ensureUser_1 = require("../utils/ensureUser");
const router = (0, express_1.Router)();
// Debug endpoint to see Auth0 payload
router.get('/debug', auth_middleware_1.checkJwt, async (req, res) => {
    try {
        res.json({
            success: true,
            auth0_payload: req.auth?.payload,
            headers: req.headers.authorization ? 'Present' : 'Missing'
        });
    }
    catch (error) {
        console.error('Error in debug endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Debug endpoint failed'
        });
    }
});
// Test endpoint without database
router.get('/test', auth_middleware_1.checkJwt, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Profile route is working!',
            auth0_sub: req.auth?.payload?.sub,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error in test endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Test endpoint failed'
        });
    }
});
// Get user profile
router.get('/', auth_middleware_1.checkJwt, ensureUser_middleware_1.ensureUserMiddleware, async (req, res) => {
    try {
        const user = await (0, ensureUser_1.ensureUserExists)(req);
        // Return user profile without sensitive data
        const { password, ...userProfile } = user;
        res.json({
            success: true,
            data: userProfile
        });
    }
    catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user profile'
        });
    }
});
// Update user profile
router.put('/', auth_middleware_1.checkJwt, [
    (0, express_validator_1.body)('profile.firstName').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string' && value.length <= 50;
    }),
    (0, express_validator_1.body)('profile.lastName').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string' && value.length <= 50;
    }),
    (0, express_validator_1.body)('profile.displayName').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string' && value.length <= 100;
    }),
    (0, express_validator_1.body)('profile.bio').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string' && value.length <= 500;
    }),
    (0, express_validator_1.body)('profile.location').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string' && value.length <= 100;
    }),
    (0, express_validator_1.body)('profile.website').optional().custom((value) => {
        if (!value || value.trim() === '')
            return true; // Allow empty strings
        return /^https?:\/\/.+/.test(value); // Basic URL validation
    }),
    (0, express_validator_1.body)('profile.phone').optional({ values: 'falsy' }).custom((value) => {
        if (!value || value.trim() === '')
            return true; // Allow empty strings
        return /[\d\-\+\(\)\s]+/.test(value); // Very lenient phone validation
    }),
    (0, express_validator_1.body)('profile.birthDate').optional({ values: 'falsy' }).custom((value) => {
        if (!value || value.trim() === '')
            return true; // Allow empty strings
        return !isNaN(Date.parse(value)); // Basic date validation
    }),
    (0, express_validator_1.body)('profile.occupation').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string' && value.length <= 100;
    }),
    (0, express_validator_1.body)('profile.interests').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty
        return Array.isArray(value);
    }),
    (0, express_validator_1.body)('profile.interests.*').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string';
    }),
    (0, express_validator_1.body)('profile.socialLinks.twitter').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string';
    }),
    (0, express_validator_1.body)('profile.socialLinks.instagram').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string';
    }),
    (0, express_validator_1.body)('profile.socialLinks.linkedin').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string';
    }),
    (0, express_validator_1.body)('profile.socialLinks.github').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true; // Allow undefined, null, empty string
        return typeof value === 'string';
    }),
    (0, express_validator_1.body)('profile.preferences.theme').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true;
        return ['light', 'dark', 'auto'].includes(value);
    }),
    (0, express_validator_1.body)('profile.preferences.privacy').optional({ values: 'falsy' }).custom((value) => {
        if (!value)
            return true;
        return ['public', 'private', 'friends'].includes(value);
    }),
    (0, express_validator_1.body)('profile.preferences.notifications.email').optional({ values: 'falsy' }).isBoolean(),
    (0, express_validator_1.body)('profile.preferences.notifications.uploads').optional({ values: 'falsy' }).isBoolean(),
    (0, express_validator_1.body)('profile.preferences.notifications.sharing').optional({ values: 'falsy' }).isBoolean(),
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            console.error('❌ Validation errors:', errors.array());
            console.error('📋 Request body:', req.body);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const user = await (0, ensureUser_1.ensureUserExists)(req);
        const { profile } = req.body;
        // Merge with existing profile data
        const existingProfile = user.profile || {};
        const updatedProfile = {
            ...existingProfile,
            ...profile,
            // Handle nested objects properly
            socialLinks: {
                ...existingProfile.socialLinks,
                ...profile.socialLinks
            },
            preferences: {
                ...existingProfile.preferences,
                ...profile.preferences,
                notifications: {
                    ...existingProfile.preferences?.notifications,
                    ...profile.preferences?.notifications
                }
            }
        };
        // Update user profile
        const updatedUser = await database_service_1.databaseService.updateUserProfile(user._id.toString(), updatedProfile);
        // Return updated profile without sensitive data
        const { password, ...userProfile } = updatedUser;
        res.json({
            success: true,
            data: userProfile,
            message: 'Profile updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user profile'
        });
    }
});
// Update specific profile field
router.patch('/field/:fieldPath', auth_middleware_1.checkJwt, async (req, res) => {
    try {
        const user = await (0, ensureUser_1.ensureUserExists)(req);
        const { fieldPath } = req.params;
        const { value } = req.body;
        // Validate allowed field paths
        const allowedFields = [
            'firstName', 'lastName', 'displayName', 'bio', 'location',
            'website', 'phone', 'birthDate', 'occupation', 'interests',
            'socialLinks.twitter', 'socialLinks.instagram', 'socialLinks.linkedin', 'socialLinks.github',
            'preferences.theme', 'preferences.privacy',
            'preferences.notifications.email', 'preferences.notifications.uploads', 'preferences.notifications.sharing'
        ];
        if (!allowedFields.includes(fieldPath)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid field path'
            });
        }
        // Update specific field
        const updatedUser = await database_service_1.databaseService.updateUserProfileField(user._id.toString(), fieldPath, value);
        // Return updated profile without sensitive data
        const { password, ...userProfile } = updatedUser;
        res.json({
            success: true,
            data: userProfile,
            message: `${fieldPath} updated successfully`
        });
    }
    catch (error) {
        console.error('Error updating profile field:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile field'
        });
    }
});
// Get public profile (for sharing)
router.get('/public/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await database_service_1.databaseService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        // Check privacy settings
        if (user.profile?.preferences?.privacy === 'private') {
            return res.status(403).json({
                success: false,
                error: 'Profile is private'
            });
        }
        // Return only public profile information
        const publicProfile = {
            _id: user._id,
            username: user.username,
            name: user.name,
            picture: user.picture,
            profile: {
                displayName: user.profile?.displayName,
                bio: user.profile?.bio,
                location: user.profile?.location,
                website: user.profile?.website,
                occupation: user.profile?.occupation,
                interests: user.profile?.interests,
                socialLinks: user.profile?.socialLinks
            }
        };
        res.json({
            success: true,
            data: publicProfile
        });
    }
    catch (error) {
        console.error('Error fetching public profile:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch public profile'
        });
    }
});
exports.default = router;
