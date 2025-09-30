// Frontend photo service with caching
import { config } from '../config/env';

class PhotoService {
  private urlCache = new Map<string, { url: string; expires: number }>();
  private apiBaseUrl = config.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  private getTokenFunction: (() => Promise<string | null>) | null = null;

  // Initialize with Auth0 token getter
  initialize(getTokenFunction: () => Promise<string | null>) {
    this.getTokenFunction = getTokenFunction;
  }

  async getPhotos(useCache = true) {
    const response = await fetch(`${this.apiBaseUrl}/api/files`, {
      method: 'GET',
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json'
      },
      mode: 'cors' // Keep only essential CORS setting
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
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json'
      },
      mode: 'cors', // Keep only essential CORS setting
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
    try {
      console.log(`Fetching albums from: ${this.apiBaseUrl}/api/albums`);
      
      // Get the auth token
      const token = await this.getToken();
      if (!token) {
        console.warn('No authentication token available for albums fetch');
      }
      
      // Include credentials mode to ensure cookies are sent (if applicable)
      const response = await fetch(`${this.apiBaseUrl}/api/albums`, {
        method: 'GET',
        credentials: 'include', // Keep only essential CORS setting
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json'
        },
        mode: 'cors' // Keep only essential CORS setting
      });
      
      console.log(`Albums response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Return in a standardized format to match other API responses
      return {
        success: true,
        data: data.data || data
      };
      
    } catch (err) {
      console.error('Error in getAlbums:', err);
      throw err;
    }
  }

  async createAlbum(albumData: { title: string; description?: string }) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums`, {
      method: 'POST',
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json'
      },
      mode: 'cors', // Keep only essential CORS setting
      body: JSON.stringify(albumData)
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

  async getAlbum(albumId: string) {
    try {
      // Log attempt to fetch album
      console.log(`Attempting to fetch album: ${albumId}`);
      
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
        credentials: 'include', // Keep only essential CORS setting
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        mode: 'cors' // Keep only essential CORS setting
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
      
      // Return in a standardized format to match other API responses
      return {
        success: true,
        data: data.data || data
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
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json'
      },
      mode: 'cors', // Keep only essential CORS setting
      body: JSON.stringify(updateData)
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

  async deleteAlbum(albumId: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}`, {
      method: 'DELETE',
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
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

  async addPhotosToAlbum(albumId: string, photoIds: string[]) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/photos`, {
      method: 'POST',
      credentials: 'include', // Include credentials for CORS requests
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json'
      },
      mode: 'cors', // Explicitly set CORS mode
      body: JSON.stringify({ photo_ids: photoIds })
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

  async removePhotoFromAlbum(albumId: string, photoId: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/photos/${photoId}`, {
      method: 'DELETE',
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
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

  async shareAlbum(albumId: string, shareData: { 
    email?: string; 
    username?: string; 
    permission: 'view' | 'edit';
    expires_at?: string;
  }) {
    const response = await fetch(`${this.apiBaseUrl}/api/albums/${albumId}/share`, {
      method: 'POST',
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json'
      },
      mode: 'cors', // Keep only essential CORS setting
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
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json'
      },
      mode: 'cors', // Keep only essential CORS setting
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
      credentials: 'include', // Keep only essential CORS setting
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
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
}

export const photoService = new PhotoService();
