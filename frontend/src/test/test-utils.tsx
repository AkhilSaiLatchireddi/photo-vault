import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';

// Custom render function that includes providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Auth0Provider
      domain="test-domain.auth0.com"
      clientId="test-client-id"
      authorizationParams={{
        redirect_uri: 'http://localhost:3000',
        audience: 'test-audience'
      }}
    >
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </Auth0Provider>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Mock photo data for tests
export const mockPhoto = {
  id: 1,
  filename: 'test-photo.jpg',
  s3_key: 'photos/test-photo.jpg',
  original_name: 'Test Photo.jpg',
  mime_type: 'image/jpeg',
  file_size: 1024000,
  width: 1920,
  height: 1080,
  uploaded_at: '2024-01-01T00:00:00.000Z',
  downloadUrl: 'https://example.com/test-photo.jpg',
  metadata: {}
};

export const mockAlbum = {
  _id: 'album-123',
  title: 'Test Album',
  description: 'A test album',
  photo_ids: ['photo-1', 'photo-2'],
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  user_id: 'user-123',
  shared_with: [],
  is_public: false,
  public_token: null
};

export const mockPublicPhoto = {
  _id: 'photo-123',
  filename: 'test-photo.jpg',
  original_name: 'Test Photo.jpg',
  mime_type: 'image/jpeg',
  file_size: 1024000,
  width: 1920,
  height: 1080,
  uploaded_at: '2024-01-01T00:00:00.000Z',
  downloadUrl: 'https://example.com/test-photo.jpg'
};

// Mock API responses
export const mockApiResponse = {
  success: true,
  data: mockPhoto,
  message: 'Success'
};

export const mockApiError = {
  success: false,
  error: 'Test error message',
  data: null
};

// Re-export everything from react-testing-library
export * from '@testing-library/react';

// Override render method
export { customRender as render };
