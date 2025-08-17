// Frontend photo service with caching
class PhotoService {
  private urlCache = new Map<string, { url: string; expires: number }>();
  private apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  async getPhotos(useCache = true) {
    const response = await fetch(`${this.apiBaseUrl}/api/files`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      }
    });

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

    return data.data.photos;
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
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ photoIds })
    });

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

  private getToken() {
    // Your auth token logic
    return localStorage.getItem('auth_token');
  }
}

export const photoService = new PhotoService();
