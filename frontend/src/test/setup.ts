import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
vi.mock('../config/env', () => ({
  config: {
    API_BASE_URL: 'http://localhost:3001',
    AUTH0_DOMAIN: 'test-domain.auth0.com',
    AUTH0_CLIENT_ID: 'test-client-id',
    AUTH0_AUDIENCE: 'test-audience',
    ENVIRONMENT: 'test',
    isProduction: false,
    isDevelopment: false,
    redirectUri: 'http://localhost:3000'
  }
}));

// Mock Auth0
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    user: {
      sub: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User'
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    getAccessTokenSilently: vi.fn().mockResolvedValue('mock-token'),
    loginWithRedirect: vi.fn(),
    logout: vi.fn()
  }),
  Auth0Provider: ({ children }: { children: React.ReactNode }) => children
}));

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null })
  };
});

// Global test utilities
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

// Mock IntersectionObserver
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  })),
});

// Mock ResizeObserver
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  })),
});
