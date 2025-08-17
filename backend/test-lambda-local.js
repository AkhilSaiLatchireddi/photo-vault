// Set Lambda environment variables to prevent server startup
process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
process.env.NODE_ENV = 'production';

const { handler } = require('./dist/lambda');

// Mock API Gateway event
const mockEvent = {
  httpMethod: 'GET',
  path: '/health',
  headers: {
    'Host': 'test.execute-api.us-east-1.amazonaws.com',
    'User-Agent': 'test-agent'
  },
  queryStringParameters: null,
  body: null,
  isBase64Encoded: false,
  requestContext: {
    requestId: 'test-request-id',
    stage: 'test'
  },
  pathParameters: null
};

// Mock context
const mockContext = {
  callbackWaitsForEmptyEventLoop: false,
  getRemainingTimeInMillis: () => 30000,
  functionName: 'test-function',
  awsRequestId: 'test-request-id'
};

console.log('🧪 Testing Lambda handler locally...');

// Give the app time to initialize
setTimeout(() => {
  handler(mockEvent, mockContext, (error, result) => {
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Success:', JSON.stringify(result, null, 2));
    }
    process.exit(error ? 1 : 0);
  });
}, 2000);

console.log('⏳ Waiting for app initialization...');
