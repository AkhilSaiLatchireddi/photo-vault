const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

console.log('🔍 Debugging Environment Variable Loading');
console.log('Current working directory:', process.cwd());
console.log('__dirname (would be):', __dirname);

// Test different paths
const paths = [
  '.env',
  '../.env',
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(process.cwd(), '.env'),
  '/Users/asailatchireddi/Documents/intrest-projects/photo-vault/backend/.env'
];

paths.forEach(envPath => {
  const exists = fs.existsSync(envPath);
  console.log(`${exists ? '✅' : '❌'} ${envPath} - ${exists ? 'EXISTS' : 'NOT FOUND'}`);
});

// Try loading from the correct path
const envPath = path.join(__dirname, '..', '.env');
console.log('\n🔧 Loading from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env:', result.error.message);
} else {
  console.log('✅ .env loaded successfully');
}

console.log('\n📋 Environment Variables:');
console.log('AUTH0_DOMAIN:', process.env.AUTH0_DOMAIN || 'NOT SET');
console.log('AUTH0_AUDIENCE:', process.env.AUTH0_AUDIENCE || 'NOT SET');
console.log('MONGODB_USERNAME:', process.env.MONGODB_USERNAME || 'NOT SET');
console.log('MONGODB_PASSWORD:', process.env.MONGODB_PASSWORD ? 'SET' : 'NOT SET');
