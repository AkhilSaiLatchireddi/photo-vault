import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock Auth0
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    user: {
      sub: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User'
    },
    getAccessTokenSilently: vi.fn().mockResolvedValue('mock-token'),
    logout: vi.fn(),
    loginWithRedirect: vi.fn()
  }),
  Auth0Provider: ({ children }: { children: React.ReactNode }) => children,
  withAuthenticationRequired: (Component: React.ComponentType) => Component
}));

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ token: 'test-token' }),
    useNavigate: () => vi.fn(),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => 
      React.createElement('a', { href: to }, children)
  };
});

// Mock environment config
vi.mock('../config/env', () => ({
  config: {
    apiUrl: 'http://localhost:3001',
    auth0: {
      domain: 'test.auth0.com',
      clientId: 'test-client-id',
      audience: 'test-audience'
    }
  }
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock fetch
global.fetch = vi.fn();
