import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Auth0Provider } from "@auth0/auth0-react";

console.log('Starting PhotoVault app...');

// Get Auth0 configuration from environment variables
const domain = import.meta.env.VITE_AUTH0_DOMAIN || '';
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
const audience = import.meta.env.VITE_AUTH0_AUDIENCE || '';

console.log('Auth0 config:', { domain, clientId, audience: audience ? 'set' : 'not set' });

const providerConfig = {
  domain,
  clientId,
  authorizationParams: {
    redirect_uri: window.location.origin,
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