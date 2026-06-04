// Frontend photo service with caching
import { config } from '../config/env';
import { cacheService } from '../utils/cache';

class PhotoService {
  private urlCache = new Map<string, { url: string; expires: number }>();
  private apiBaseUrl = config.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  private getTokenFunction: (() => Promise<string | null>) | null = null;
  private currentUserId: string | null = null;

  // Prefix every cache key with the logged-in userId so different users
  // on the same browser never share cached data.
  private cacheKey(key: string): string {
    return this.currentUserId ? `${this.currentUserId}:${key}` : key;
  }
  
  // Cache TTL configurations (in milliseconds)
  private readonly CACHE_TTL = {
    PHOTOS: 90 * 60 * 1000,      // 90 min — matches S3 presigned URL lifetime
    ALBUMS: 90 * 60 * 1000,
    ALBUM_DETAIL: 90 * 60 * 1000,
  };

  // Initialize with Auth0 token getter. Pass userId so cache is scoped per user.
  initialize(getTokenFunction: () => Promise<string | null>, userId?: string) {
    const userChanged = userId && userId !== this.currentUserId;
    this.getTokenFunction = getTokenFunction;
    if (userId) this.currentUserId = userId;
    // If a different user just logged in, wipe all cached data immediately
    if (userChanged) {
      cacheService.clear();
      this.urlCache.clear();
    }
  }

  async getPhotos(useCache = true) {
    const cacheKey = this.cacheKey('photos-list');
    
    // Try cache first if enabled
    if (useCache) {
      const cached = cacheService.get<any>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached
        };
      }
    }
    
    const response = await fetch(`${this.apiBaseUrl}/api/files`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (useCache && data.data?.urlsExpireAt) {
      const expiryTime = new Date(data.data.urlsExpireAt).getTime();
      
      // Cache the URLs
      data.data.photos.forEach((photo: any) => {
        if (photo.downloadUrl) {
          this.urlCache.set(photo.photoId, {
            url: photo.downloadUrl,
            expires: expiryTime
          });
        }
      });
      
      // Cache the entire response
      cacheService.set(cacheKey, data.data, { ttl: this.CACHE_TTL.PHOTOS });
    }

    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data
    };
  }

  // Get cached URL or refresh if expired
  async getPhotoUrl(photoId: string): Promise<string | null> {
    const cached = this.urlCache.get(photoId);
    
    if (cached && cached.expires > Date.now()) {
      return cached.url;
    }

    // URL expired, refresh batch
    const refreshed = await this.refreshUrls([photoId]);
    return refreshed[0]?.downloadUrl || null;
  }

  // Refresh expired URLs
  async refreshUrls(photoIds: string[]) {
    const response = await fetch(`${this.apiBaseUrl}/api/files/refresh-urls`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({ photoIds })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Update cache
    if (data.success && data.data.urlsExpireAt) {
      const expiryTime = new Date(data.data.urlsExpireAt).getTime();
      
      data.data.urls.forEach((urlData: any) => {
        this.urlCache.set(urlData.id, {
          url: urlData.downloadUrl,
          expires: expiryTime
        });
      });
    }

    return data.data.urls;
  }

  private async getToken(): Promise<string | null> {
    if (!this.getTokenFunction) {
      console.error('PhotoService not initialized with token function');
      return null;
    }
    return await this.getTokenFunction();
  }
  
  // Method to test token access - helps with debugging auth issues
  async testTokenAccess(): Promise<string | null> {
    try {
      const token = await this.getToken();
      return token;
    } catch (err) {
      console.error('Error getting authentication token:', err);
      return null;
    }
  }

  // Album methods
  async getAlbums() {
    const cacheKey = this.cacheKey('albums-list');
    
    // Try cache first
    const cached = cacheService.get<any>(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached
      };
    }
    
    try {
      
      // Get the auth token
      const token = await this.getToken();
      if (!token) {
        console.warn('No authentication token available for albums fetch');
      }
      
      // Include credentials mode to ensure cookies are sent (if applicable)
      const response = await fetch(`${this.apiBaseUrl}/api/albums`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the result
      const albumsData = data.data || data;
      cacheService.set(cacheKey, albumsData, { ttl: this.CACHE_TTL.ALBUMS });
      
      // Return in a standardized format to match other API responses
      return {
        success: true,
        data: albumsData
      };
      
    } catch (err) {
      console.error('Error in getAlbums:', err);
      throw err;
    }
  }

  async createAlbum(albumData: { title: string; description?: string }) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(albumData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate albums list cache
    cacheService.invalidate(this.cacheKey('albums-list'));
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }

  async getAlbum(albumId: string) {
    const cacheKey = this.cacheKey(`album-detail-${albumId}`);
    
    // Try cache first
    const cached = cacheService.get<any>(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached
      };
    }
    
    try {
      // Log attempt to fetch album
      
      // Get the auth token
      const token = await this.getToken();
      if (!token) {
        console.error('No authentication token available for album fetch');
        throw new Error('Authentication token missing');
      }
      
      // Create a timeout promise to abort the fetch if it takes too long
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out after 15 seconds')), 15000)
      );
      
      // First page only — keeps response fast
      const fetchPromise = fetch(`${this.apiBaseUrl}/api/albums/${albumId}?page=1&limit=20`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      
      // Race between the fetch and the timeout
      const response = await Promise.race([fetchPromise, timeout]) as Response;

      // Log response status
      
      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 401) {
          throw new Error(`HTTP 401: Authentication failed. Token may be expired.`);
        } else if (response.status === 403) {
          throw new Error(`HTTP 403: Access denied to this album.`);
        } else if (response.status === 404) {
          throw new Error(`HTTP 404: Album not found.`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      // Parse the JSON response with error handling
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.error('Failed to parse album response as JSON:', jsonErr);
        throw new Error('Invalid response format');
      }
      
      // Validate response structure
      if (!data) {
        throw new Error('Empty response from server');
      }
      
      // Handle API error responses
      if (data.error || !data.success) {
        console.error('API returned error:', data.error || 'Unknown error');
        return {
          success: false,
          error: data.error || 'Unknown error',
          data: null
        };
      }
      
      // Log successful data retrieval
      
      // Cache the result
      const albumData = data.data || data;
      cacheService.set(cacheKey, albumData, { ttl: this.CACHE_TTL.ALBUM_DETAIL });
      
      // Return in a standardized format to match other API responses
      return {
        success: true,
        data: albumData
      };
    } catch (err) {
      // Log and rethrow the error
      console.error('Error in getAlbum:', err);
      throw err;
    }
  }

  // Fetch a specific page of photos for an album (no cache — always fresh)
  async getAlbumPage(albumId: string, page: number, limit = 20) {
    const token = await this.getToken();
    if (!token) throw new Error('Authentication token missing');
    const response = await fetch(
      `${this.apiBaseUrl}/api/albums/${albumId}?page=${page}&limit=${limit}`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { success: true, data: data.data };
  }

  // Fetch a specific page of photos for a public album (no auth, no cache)
  async getPublicAlbumPage(token: string, page: number, limit = 20) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/public/albums/${token}?page=${page}&limit=${limit}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { success: true, data: data.data };
  }

  async updateAlbum(albumId: string, updateData: { title?: string; description?: string; coverPhotoId?: string }) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate related caches
    cacheService.invalidate(this.cacheKey('albums-list'));
    cacheService.invalidate(this.cacheKey(`album-detail-${albumId}`));
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }

  async deleteAlbum(albumId: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate related caches
    cacheService.invalidate(this.cacheKey('albums-list'));
    cacheService.invalidate(this.cacheKey(`album-detail-${albumId}`));
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }

  async addPhotosToAlbum(albumId: string, photoIds: string[]) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/photos`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({ photo_ids: photoIds })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate album detail cache as photos changed
    cacheService.invalidate(this.cacheKey(`album-detail-${albumId}`));
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }

  async removePhotoFromAlbum(albumId: string, photoId: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/photos/${photoId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate album detail cache as photos changed
    cacheService.invalidate(this.cacheKey(`album-detail-${albumId}`));
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }

  async shareAlbum(albumId: string, shareData: { 
    email?: string; 
    username?: string; 
    permission: 'view' | 'edit';
    expires_at?: string;
  }) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/share`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(shareData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }

  async getPhotoDownloadUrl(photoId: string): Promise<string | null> {
    const response = await fetch(`${this.apiBaseUrl}/api/files/${photoId}/download`, {
      headers: { 'Authorization': `Bearer ${await this.getToken()}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.data?.url ?? null;
  }

  async setSubAlbums(albumId: string, subAlbumIds: string[]) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/sub-albums`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${await this.getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subAlbumIds }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // Bust cache so fetchAlbum returns fresh data with resolved subAlbums
    cacheService.invalidate(this.cacheKey(`album-detail-${albumId}`));
    return response.json();
  }

  async getAlbumPeople(albumId: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/people`, {
      headers: { 'Authorization': `Bearer ${await this.getToken()}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async getPublicAlbumPeople(publicToken: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/public/albums/${publicToken}/people`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async generatePublicLink(albumId: string, expiresAt?: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/public`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({ expires_at: expiresAt })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }

  async revokePublicLink(albumId: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/public`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }

  // Public album access (no authentication)
  async getPublicAlbum(publicToken: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/public/albums/${publicToken}?page=1&limit=20`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }
  
  // Cache management methods
  
  /**
   * Clear all caches (useful after logout or manual refresh)
   */
  clearAllCaches(): void {
    cacheService.clear();
    this.urlCache.clear();
    console.log('[Cache] Cleared all caches');
  }
  
  /**
   * Invalidate photos list cache (call after uploading new photos)
   */
  invalidatePhotosCache(): void {
    cacheService.invalidate(this.cacheKey('photos-list'));
  }
  
  /**
   * Invalidate albums list cache
   */
  invalidateAlbumsCache(): void {
    cacheService.invalidate(this.cacheKey('albums-list'));
  }
  
  /**
   * Invalidate specific album detail cache
   */
  invalidateAlbumCache(albumId: string): void {
    cacheService.invalidate(this.cacheKey(`album-detail-${albumId}`));
  }
}

export const photoService = new PhotoService();
