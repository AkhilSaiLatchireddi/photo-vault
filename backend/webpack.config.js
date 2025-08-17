const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './src/lambda.ts',
  target: 'node',
  mode: 'production',
  externals: [
    nodeExternals({
      // Bundle these packages instead of treating them as externals
      allowlist: [
        '@aws-sdk/client-s3',
        '@aws-sdk/s3-request-presigner',
        'cors',
        'express',
        'express-oauth2-jwt-bearer',
        'express-rate-limit',
        'express-validator',
        'helmet',
        'jsonwebtoken',
        'jwks-rsa',
        'mongodb',
        'serverless-http',
        'uuid'
      ]
    })
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    path: path.resolve(__dirname, 'webpack-dist'),
    filename: 'lambda.js',
    libraryTarget: 'commonjs2'
  },
  optimization: {
    minimize: true,
    sideEffects: false
  },
  stats: {
    warningsFilter: [
      /mongodb/,
      /aws-sdk/
    ]
  }
};
