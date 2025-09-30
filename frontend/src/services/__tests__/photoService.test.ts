import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { photoService } from '../photoService';

// Mock fetch
global.fetch = vi.fn();

// Mock token function
const mockGetToken = vi.fn().mockResolvedValue('mock-token');
photoService.initialize(mockGetToken);

describe('photoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPhotos', () => {
    it('should fetch photos successfully', async () => {
      const mockPhotos = [
        {
          id: 1,
          filename: 'test1.jpg',
          original_name: 'Test 1.jpg',
          mime_type: 'image/jpeg',
          file_size: 1024,
          uploaded_at: '2024-01-01T00:00:00.000Z',
          downloadUrl: 'https://example.com/test1.jpg'
        }
      ];

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            photos: mockPhotos,
            urlsExpireAt: '2024-01-01T01:00:00.000Z'
          }
        })
      });

      const result = await photoService.getPhotos();

      expect(result).toEqual(mockPhotos);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/files', {
        headers: {
          'Authorization': 'Bearer mock-token',
        },
      });
    });

    it('should handle fetch error', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(photoService.getPhotos()).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });

  describe('refreshUrls', () => {
    it('should refresh URLs successfully', async () => {
      const mockUrls = [
        {
          id: '1',
          downloadUrl: 'https://example.com/refreshed.jpg'
        }
      ];

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            urls: mockUrls,
            urlsExpireAt: '2024-01-01T01:00:00.000Z'
          }
        })
      });

      const result = await photoService.refreshUrls(['1']);

      expect(result).toEqual(mockUrls);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/files/refresh-urls', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoIds: ['1'] }),
      });
    });
  });

  describe('createAlbum', () => {
    it('should create album successfully', async () => {
      const albumData = {
        title: 'Test Album',
        description: 'A test album'
      };

      const mockResponse = {
        success: true,
        data: {
          _id: 'album-123',
          ...albumData,
          photo_ids: [],
          created_at: '2024-01-01T00:00:00.000Z'
        }
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await photoService.createAlbum(albumData);

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/albums', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(albumData),
      });
    });
  });

  describe('getAlbums', () => {
    it('should fetch albums successfully', async () => {
      const mockAlbums = {
        userAlbums: [
          {
            _id: 'album-1',
            title: 'My Album',
            photo_ids: ['photo-1']
          }
        ],
        sharedAlbums: []
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAlbums)
      });

      const result = await photoService.getAlbums();

      expect(result).toEqual(mockAlbums);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/albums', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('getAlbum', () => {
    it('should fetch single album successfully', async () => {
      const mockAlbum = {
        _id: 'album-123',
        title: 'Test Album',
        photo_ids: ['photo-1']
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockAlbum })
      });

      const result = await photoService.getAlbum('album-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAlbum);
    });
  });

  describe('updateAlbum', () => {
    it('should update album successfully', async () => {
      const updateData = { title: 'Updated Album' };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Album updated' })
      });

      const result = await photoService.updateAlbum('album-123', updateData);

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/albums/album-123', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
    });
  });

  describe('deleteAlbum', () => {
    it('should delete album successfully', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Album deleted' })
      });

      const result = await photoService.deleteAlbum('album-123');

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/albums/album-123', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('addPhotosToAlbum', () => {
    it('should add photos to album successfully', async () => {
      const photoIds = ['photo-1', 'photo-2'];

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Photos added' })
      });

      const result = await photoService.addPhotosToAlbum('album-123', photoIds);

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/albums/album-123/photos', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photo_ids: photoIds }),
      });
    });
  });

  describe('shareAlbum', () => {
    it('should share album via email successfully', async () => {
      const shareData = {
        email: 'test@example.com',
        permission: 'view' as const
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Album shared successfully' })
      });

      const result = await photoService.shareAlbum('album-123', shareData);

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/albums/album-123/share', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shareData),
      });
    });
  });

  describe('generatePublicLink', () => {
    it('should generate public link successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          public_token: 'public-token-123',
          public_url: 'http://example.com/public/album/public-token-123'
        }
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await photoService.generatePublicLink('album-123');

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/albums/album-123/public', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expires_at: undefined }),
      });
    });
  });

  describe('getPublicAlbum', () => {
    it('should fetch public album successfully', async () => {
      const mockPublicAlbum = {
        _id: 'album-123',
        title: 'Public Album',
        photos: [
          {
            _id: 'photo-1',
            original_name: 'test.jpg',
            downloadUrl: 'https://example.com/photo.jpg'
          }
        ]
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPublicAlbum)
      });

      const result = await photoService.getPublicAlbum('public-token-123');

      expect(result).toEqual(mockPublicAlbum);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/public/albums/public-token-123');
    });

    it('should handle public album not found', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(photoService.getPublicAlbum('invalid-token')).rejects.toThrow('HTTP 404: Not Found');
    });
  });
});
