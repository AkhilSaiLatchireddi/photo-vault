import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Auth0Provider } from "@auth0/auth0-react";
import { config } from './config/env.ts';

console.log('Starting PhotoVault app...');
console.log('Environment debug:', {
  NODE_ENV: import.meta.env.NODE_ENV,
  PROD: import.meta.env.PROD,
  hostname: window.location.hostname,
  origin: window.location.origin,
  isProduction: config.isProduction,
  redirectUri: config.redirectUri
});

// Get Auth0 configuration from environment variables
const domain = config.AUTH0_DOMAIN;
const clientId = config.AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE || '';

console.log('Auth0 config:', { domain, clientId, audience: audience ? 'set' : 'not set' });

const providerConfig = {
  domain,
  clientId,
  authorizationParams: {
    redirect_uri: config.redirectUri,
    ...(audience ? { audience } : {}),
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider {...providerConfig}>
      <App />
    </Auth0Provider>
  </React.StrictMode>,
)

console.log('React app rendered!');