/**
 * Frontend Cache Utility
 * Provides in-memory and localStorage caching with TTL support
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  useLocalStorage?: boolean; // Whether to persist to localStorage
  key: string; // Cache key
}

class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    // Try memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry && this.isValid(memEntry)) {
      console.log(`[Cache HIT - Memory] ${key}`);
      return memEntry.data;
    }

    // Try localStorage
    try {
      const stored = localStorage.getItem(`cache_${key}`);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (this.isValid(entry)) {
          console.log(`[Cache HIT - Storage] ${key}`);
          // Restore to memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        } else {
          // Expired - remove
          localStorage.removeItem(`cache_${key}`);
        }
      }
    } catch (error) {
      console.error('[Cache] Error reading from localStorage:', error);
    }

    console.log(`[Cache MISS] ${key}`);
    return null;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, config?: Partial<CacheConfig>): void {
    const ttl = config?.ttl || this.DEFAULT_TTL;
    const useLocalStorage = config?.useLocalStorage ?? true;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in localStorage if enabled
    if (useLocalStorage) {
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
      } catch (error) {
        console.error('[Cache] Error writing to localStorage:', error);
      }
    }

    console.log(`[Cache SET] ${key} (TTL: ${ttl / 1000}s)`);
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.error('[Cache] Error removing from localStorage:', error);
    }
    console.log(`[Cache INVALIDATE] ${key}`);
  }

  /**
   * Invalidate multiple cache entries by pattern
   */
  invalidatePattern(pattern: string): void {
    // Invalidate memory cache
    const keysToDelete: string[] = [];
    this.memoryCache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // Invalidate localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_') && key.includes(pattern)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[Cache] Error invalidating pattern:', error);
    }

    console.log(`[Cache INVALIDATE PATTERN] ${pattern} (${keysToDelete.length} entries)`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[Cache] Error clearing localStorage:', error);
    }
    console.log('[Cache CLEAR] All cache cleared');
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    let cleaned = 0;

    // Clean memory cache
    this.memoryCache.forEach((entry, key) => {
      if (!this.isValid(entry)) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    });

    // Clean localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const entry: CacheEntry<any> = JSON.parse(stored);
              if (!this.isValid(entry)) {
                localStorage.removeItem(key);
                cleaned++;
              }
            } catch {
              // Invalid JSON, remove it
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        }
      });
    } catch (error) {
      console.error('[Cache] Error during cleanup:', error);
    }

    if (cleaned > 0) {
      console.log(`[Cache CLEANUP] Removed ${cleaned} expired entries`);
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() < entry.expiresAt;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memorySize = this.memoryCache.size;
    let storageSize = 0;

    try {
      const keys = Object.keys(localStorage);
      storageSize = keys.filter(k => k.startsWith('cache_')).length;
    } catch {
      storageSize = 0;
    }

    return {
      memoryEntries: memorySize,
      storageEntries: storageSize,
      totalEntries: memorySize + storageSize,
    };
  }
}

// Export a singleton instance
export const cacheService = new CacheManager();

// Export singleton instance
export const cache = new CacheManager();

// Cache TTL presets (in milliseconds)
export const CacheTTL = {
  SHORT: 1 * 60 * 1000,      // 1 minute
  MEDIUM: 5 * 60 * 1000,     // 5 minutes
  LONG: 15 * 60 * 1000,      // 15 minutes
  HOUR: 60 * 60 * 1000,      // 1 hour
  DAY: 24 * 60 * 60 * 1000,  // 24 hours
};

// Cache key generators
export const CacheKeys = {
  photos: () => 'photos_list',
  photo: (id: string | number) => `photo_${id}`,
  albums: () => 'albums_list',
  album: (id: string) => `album_${id}`,
  albumPhotos: (id: string) => `album_${id}_photos`,
  profile: () => 'user_profile',
};

// Auto cleanup on startup
cache.cleanup();

// Schedule periodic cleanup (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 5 * 60 * 1000);
}
