/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'your-s3-bucket.s3.amazonaws.com',
      'd1234567890.cloudfront.net', // Your CloudFront domain
    ],
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig
