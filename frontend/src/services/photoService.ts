// Frontend photo service with caching
import { config } from '../config/env';
import { cacheService } from '../utils/cache';

class PhotoService {
  private urlCache = new Map<string, { url: string; expires: number }>();
  private apiBaseUrl = config.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  private getTokenFunction: (() => Promise<string | null>) | null = null;
  
  // Cache TTL configurations (in milliseconds)
  private readonly CACHE_TTL = {
    PHOTOS: 5 * 60 * 1000,      // 5 minutes for photos list
    ALBUMS: 2 * 60 * 1000,      // 2 minutes for albums list
    ALBUM_DETAIL: 3 * 60 * 1000 // 3 minutes for album details
  };

  // Initialize with Auth0 token getter
  initialize(getTokenFunction: () => Promise<string | null>) {
    this.getTokenFunction = getTokenFunction;
  }

  async getPhotos(useCache = true) {
    const cacheKey = 'photos-list';
    
    // Try cache first if enabled
    if (useCache) {
      const cached = cacheService.get<any>(cacheKey);
      if (cached) {
        console.log('[Cache HIT] Photos list from cache');
        return {
          success: true,
          data: cached
        };
      }
    }
    
    console.log('[Cache MISS] Fetching photos from API');
    const response = await fetch(`${this.apiBaseUrl}/api/files`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
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
          this.urlCache.set(photo.id, {
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
        'X-Requested-With': 'XMLHttpRequest'
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
      console.log('Token available:', token ? 'Yes (token exists)' : 'No (token missing)');
      return token;
    } catch (err) {
      console.error('Error getting authentication token:', err);
      return null;
    }
  }

  // Album methods
  async getAlbums() {
    const cacheKey = 'albums-list';
    
    // Try cache first
    const cached = cacheService.get<any>(cacheKey);
    if (cached) {
      console.log('[Cache HIT] Albums list from cache');
      return {
        success: true,
        data: cached
      };
    }
    
    try {
      console.log('[Cache MISS] Fetching albums from API');
      console.log(`Fetching albums from: ${this.apiBaseUrl}/api/albums`);
      
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
          'X-Requested-With': 'XMLHttpRequest'
        },
        mode: 'cors'
      });
      
      console.log(`Albums response status: ${response.status} ${response.statusText}`);
      
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
        'X-Requested-With': 'XMLHttpRequest'
      },
      mode: 'cors',
      body: JSON.stringify(albumData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate albums list cache
    cacheService.invalidate('albums-list');
    console.log('[Cache INVALIDATE] Albums list after create');
    
    // Return in a standardized format to match other API responses
    return {
      success: true,
      data: data.data || data
    };
  }

  async getAlbum(albumId: string) {
    const cacheKey = `album-detail-${albumId}`;
    
    // Try cache first
    const cached = cacheService.get<any>(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] Album ${albumId} from cache`);
      return {
        success: true,
        data: cached
      };
    }
    
    try {
      // Log attempt to fetch album
      console.log(`[Cache MISS] Fetching album from API: ${albumId}`);
      
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
      
      // Make the request with improved error handling and timeout
      const fetchPromise = fetch(`${this.apiBaseUrl}/api/albums/${albumId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        mode: 'cors'
      });
      
      // Race between the fetch and the timeout
      const response = await Promise.race([fetchPromise, timeout]) as Response;

      // Log response status
      console.log(`Album fetch response status: ${response.status} ${response.statusText}`);
      
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
      console.log(`Successfully fetched album with ${data.data?.photos?.length || 0} photos`);
      
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

  async updateAlbum(albumId: string, updateData: { title?: string; description?: string; cover_photo_id?: string }) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      mode: 'cors',
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate related caches
    cacheService.invalidate('albums-list');
    cacheService.invalidate(`album-detail-${albumId}`);
    console.log(`[Cache INVALIDATE] Albums list and album ${albumId} after update`);
    
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
        'X-Requested-With': 'XMLHttpRequest'
      },
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate related caches
    cacheService.invalidate('albums-list');
    cacheService.invalidate(`album-detail-${albumId}`);
    console.log(`[Cache INVALIDATE] Albums list and album ${albumId} after delete`);
    
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
        'X-Requested-With': 'XMLHttpRequest'
      },
      mode: 'cors',
      body: JSON.stringify({ photo_ids: photoIds })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate album detail cache as photos changed
    cacheService.invalidate(`album-detail-${albumId}`);
    console.log(`[Cache INVALIDATE] Album ${albumId} after adding photos`);
    
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
        'X-Requested-With': 'XMLHttpRequest'
      },
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate album detail cache as photos changed
    cacheService.invalidate(`album-detail-${albumId}`);
    console.log(`[Cache INVALIDATE] Album ${albumId} after removing photo`);
    
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
        'X-Requested-With': 'XMLHttpRequest'
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

  async generatePublicLink(albumId: string, expiresAt?: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/public`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
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
        'X-Requested-With': 'XMLHttpRequest'
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
    const response = await fetch(`${this.apiBaseUrl}/api/public/albums/${publicToken}`, {
      method: 'GET',
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Content-Type': 'application/json'
      },
      mode: 'cors' // Keep only essential CORS setting
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
    cacheService.invalidate('photos-list');
    console.log('[Cache INVALIDATE] Photos list');
  }
  
  /**
   * Invalidate albums list cache
   */
  invalidateAlbumsCache(): void {
    cacheService.invalidate('albums-list');
    console.log('[Cache INVALIDATE] Albums list');
  }
  
  /**
   * Invalidate specific album detail cache
   */
  invalidateAlbumCache(albumId: string): void {
    cacheService.invalidate(`album-detail-${albumId}`);
    console.log(`[Cache INVALIDATE] Album ${albumId}`);
  }
}

export const photoService = new PhotoService();
