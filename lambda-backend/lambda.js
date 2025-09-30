"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const serverless_http_1 = __importDefault(require("serverless-http"));
const index_1 = __importDefault(require("./index"));
// Configure serverless-http for better performance
const handler = (0, serverless_http_1.default)(index_1.default, {
    binary: ['image/*', 'application/octet-stream'],
    request: (request, event, context) => {
        // Add Lambda context to request for debugging
        request.context = context;
        request.event = event;
    },
    response: (response, event, context) => {
        // Add security headers
        response.headers = {
            ...response.headers,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        };
    }
});
exports.handler = handler;
