import serverless from 'serverless-http';
import app from './index';

// Configure serverless-http for better performance
const handler = serverless(app, {
  binary: ['image/*', 'application/octet-stream'],
  request: (request: any, event: any, context: any) => {
    // Add Lambda context to request for debugging
    request.context = context;
    request.event = event;
  },
  response: (response: any, event: any, context: any) => {
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

export { handler };
