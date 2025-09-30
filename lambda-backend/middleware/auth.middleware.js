"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authConfig = exports.checkJwt = void 0;
const express_oauth2_jwt_bearer_1 = require("express-oauth2-jwt-bearer");
// Load environment variables - in production (Lambda), these come from AWS SSM
const authConfig = {
    domain: process.env.AUTH0_DOMAIN || "akhil-dev-app.us.auth0.com",
    audience: process.env.AUTH0_AUDIENCE || process.env.VITE_API_BASE_URL || "https://photovault-api.com",
};
exports.authConfig = authConfig;
// In Lambda environment, be more flexible with missing config during cold start
const isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
if (!authConfig.domain) {
    const message = "AUTH0_DOMAIN environment variable is not set";
    console.error(`⚠️  ${message}`);
    if (!isLambdaEnvironment) {
        console.error("Exiting: Please set AUTH0_DOMAIN environment variable");
        process.exit(1);
    }
}
if (!authConfig.audience) {
    console.warn("⚠️  AUTH0_AUDIENCE not set, using default API identifier");
    authConfig.audience = "https://photovault-api.com";
}
console.log('🔐 Auth0 Configuration:', {
    domain: authConfig.domain,
    audience: authConfig.audience,
    environment: process.env.NODE_ENV || 'development',
    isLambda: isLambdaEnvironment
});
// Create the JWT validation middleware
exports.checkJwt = (0, express_oauth2_jwt_bearer_1.auth)({
    audience: authConfig.audience,
    issuerBaseURL: `https://${authConfig.domain}/`,
    tokenSigningAlg: 'RS256',
});
