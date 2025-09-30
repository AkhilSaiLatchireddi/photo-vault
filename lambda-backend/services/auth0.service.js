"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth0Service = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const database_service_1 = require("./database.service");
class Auth0Service {
    constructor() {
        this.client = null;
        this.domain = process.env.AUTH0_DOMAIN || '';
        this.audience = process.env.AUTH0_AUDIENCE || process.env.VITE_API_BASE_URL || '';
        if (!this.domain || !this.audience) {
            console.warn('⚠️  AUTH0_DOMAIN and AUTH0_AUDIENCE are not fully configured. Auth0 service may not function properly.');
            console.log('Environment check:', {
                domain: this.domain ? '✅ Set' : '❌ Missing',
                audience: this.audience ? '✅ Set' : '❌ Missing',
                environment: process.env.NODE_ENV,
                isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME
            });
            // Don't initialize client if missing required config
            if (!this.domain) {
                return;
            }
        }
        this.client = (0, jwks_rsa_1.default)({
            jwksUri: `https://${this.domain}/.well-known/jwks.json`,
            requestHeaders: {},
            timeout: 30000,
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 600000 // 10 minutes
        });
        console.log('🔐 Auth0 Service initialized:', {
            domain: this.domain,
            audience: this.audience ? this.audience.substring(0, 50) + '...' : 'Not set'
        });
    }
    /**
     * Verify Auth0 JWT token
     */
    async verifyToken(token) {
        try {
            if (!this.client) {
                console.error('Auth0 client not initialized');
                return null;
            }
            const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
            if (!decoded || !decoded.header || !decoded.header.kid) {
                return null;
            }
            // Get signing key
            const key = await this.getKey(decoded.header.kid);
            // Verify token
            const payload = jsonwebtoken_1.default.verify(token, key, {
                algorithms: ['RS256'],
                audience: this.audience,
                issuer: `https://${this.domain}/`,
            });
            return payload;
        }
        catch (error) {
            console.error('Auth0 token verification error:', error);
            return null;
        }
    }
    /**
     * Get signing key from Auth0
     */
    async getKey(kid) {
        if (!this.client) {
            throw new Error('Auth0 client not initialized');
        }
        return new Promise((resolve, reject) => {
            this.client.getSigningKey(kid, (err, key) => {
                if (err) {
                    reject(err);
                    return;
                }
                const signingKey = key?.getPublicKey();
                if (!signingKey) {
                    reject(new Error('Unable to get signing key'));
                    return;
                }
                resolve(signingKey);
            });
        });
    }
    /**
     * Sync Auth0 user with MongoDB
     */
    async syncUser(auth0User) {
        try {
            // Check if user already exists in MongoDB
            let user = await database_service_1.databaseService.getUserByAuth0Id(auth0User.sub);
            if (!user) {
                // Create new user in MongoDB
                const username = auth0User.nickname || auth0User.name || auth0User.email.split('@')[0];
                user = await database_service_1.databaseService.createAuth0User({
                    auth0Id: auth0User.sub,
                    username,
                    email: auth0User.email,
                    name: auth0User.name,
                    picture: auth0User.picture,
                    emailVerified: auth0User.email_verified || false,
                });
            }
            else {
                // Update existing user with latest Auth0 data
                user = await database_service_1.databaseService.updateAuth0User(user._id.toString(), {
                    email: auth0User.email,
                    name: auth0User.name,
                    picture: auth0User.picture,
                    emailVerified: auth0User.email_verified || false,
                });
            }
            return {
                id: user._id.toString(),
                auth0Id: user.auth0Id,
                username: user.username,
                email: user.email,
                name: user.name,
                picture: user.picture,
                emailVerified: user.emailVerified,
            };
        }
        catch (error) {
            console.error('Error syncing Auth0 user:', error);
            throw error;
        }
    }
    /**
     * Get user by Auth0 ID
     */
    async getUserByAuth0Id(auth0Id) {
        try {
            const user = await database_service_1.databaseService.getUserByAuth0Id(auth0Id);
            if (!user) {
                return null;
            }
            return {
                id: user._id.toString(),
                auth0Id: user.auth0Id,
                username: user.username,
                email: user.email,
                name: user.name,
                picture: user.picture,
                emailVerified: user.emailVerified,
            };
        }
        catch (error) {
            console.error('Error getting user by Auth0 ID:', error);
            return null;
        }
    }
    /**
     * Process Auth0 token and sync user
     */
    async processAuth0Token(token) {
        try {
            const auth0User = await this.verifyToken(token);
            if (!auth0User) {
                return null;
            }
            return await this.syncUser(auth0User);
        }
        catch (error) {
            console.error('Error processing Auth0 token:', error);
            return null;
        }
    }
}
exports.auth0Service = new Auth0Service();
