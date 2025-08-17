/// <reference types="vite/client" />

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH0_DOMAIN: string;
  readonly VITE_AUTH0_CLIENT_ID: string;
  readonly VITE_AUTH0_AUDIENCE?: string;
  readonly VITE_API_BASE_URL: string;
  // Vite built-in environment variables
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly NODE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
