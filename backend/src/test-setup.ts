// Setup global test environment
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/photovault-test';
  process.env.AWS_REGION = 'us-east-1';
  process.env.S3_BUCKET = 'test-bucket';
  process.env.AUTH0_DOMAIN = 'test.auth0.com';
  process.env.AUTH0_AUDIENCE = 'test-audience';
});

afterAll(() => {
  // Cleanup after all tests
});
