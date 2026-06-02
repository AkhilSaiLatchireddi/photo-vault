import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock data factories
export const mockPhoto = {
  id: 1,
  filename: 'test-photo.jpg',
  s3Key: 'test-key',
  originalName: 'test-photo.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1024000,
  width: 800,
  height: 600,
  uploadedAt: '2023-01-01T00:00:00Z',
  downloadUrl: 'https://example.com/test-photo.jpg',
  metadata: {}
};

export const mockAlbum = {
  _id: 'album-1',
  title: 'Test Album',
  description: 'Test album description',
  photoIds: ['photo-1', 'photo-2'],
  owner_id: 'user-1',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  sharedWith: [],
  isPublic: false,
  public_token: null,
  public_expires_at: null
};

export const mockUser = {
  sub: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/avatar.jpg'
};
