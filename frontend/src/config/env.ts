// Frontend environment configuration
export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  AUTH0_DOMAIN: import.meta.env.VITE_AUTH0_DOMAIN || '',
  AUTH0_CLIENT_ID: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
  ENVIRONMENT: import.meta.env.NODE_ENV || 'development',
  
  // Derived values
  get isProduction() {
    // Check multiple indicators for production
    return this.ENVIRONMENT === 'production' || 
           import.meta.env.PROD ||
           window.location.hostname === 'akhilsailatchireddi.github.io';
  },
  
  get isDevelopment() {
    return !this.isProduction;
  },
  
  get redirectUri() {
    // For GitHub Pages, always use the full path
    if (window.location.hostname === 'akhilsailatchireddi.github.io') {
      return 'https://akhilsailatchireddi.github.io/photo-vault/';
    }
    // For local development
    return window.location.origin;
  }
};

// Validation for production
if (config.isProduction) {
  const missingVars = [];
  
  if (!config.AUTH0_DOMAIN) missingVars.push('VITE_AUTH0_DOMAIN');
  if (!config.AUTH0_CLIENT_ID) missingVars.push('VITE_AUTH0_CLIENT_ID');
  if (!config.API_BASE_URL || config.API_BASE_URL.includes('localhost')) {
    missingVars.push('VITE_API_BASE_URL');
  }
  
  if (missingVars.length > 0) {
    console.error('Missing required environment variables for production:', missingVars);
    console.error('Please check your GitHub repository secrets or build configuration.');
  }
}

export default config;
