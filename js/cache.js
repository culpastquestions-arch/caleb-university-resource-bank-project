// Path-Based Cache Management System
// Supports lazy-loading with 6-hour TTL and background refresh

class PathCacheManager {
  constructor() {
    this.storagePrefix = 'curb_path_';
    this.metaKey = 'curb_cache_meta';
    this.defaultTTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    this.departmentTTL = 24 * 60 * 60 * 1000; // 24 hours for departments (root path)
    this.defaultHardExpiry = 24 * 60 * 60 * 1000; // 24 hours hard expiry
    this.departmentHardExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days for departments
  }

  /**
   * Generate storage key for a path
   * @param {string} path - The folder path
   * @param {string} type - Content type ('folders' or 'files')
   * @returns {string} Storage key
   */
  getKey(path, type = 'folders') {
    // Normalize path and create a safe key
    const normalizedPath = path.replace(/^\/+|\/+$/g, '').replace(/\//g, '__');
    return `${this.storagePrefix}${normalizedPath}_${type}`;
  }

  /**
   * Store data for a path
   * @param {string} path - The folder path
   * @param {string} type - Content type ('folders' or 'files')
   * @param {*} data - The data to cache
   * @returns {boolean} Success status
   */
  set(path, type, data) {
    try {
      const key = this.getKey(path, type);
      const cacheEntry = {
        data: data,
        timestamp: Date.now(),
        path: path,
        type: type
      };
      
      localStorage.setItem(key, JSON.stringify(cacheEntry));
      this.updateMeta({ lastUpdated: Date.now() });
      return true;
    } catch (error) {
      console.error('Failed to set path cache:', error);
      
      // Handle quota exceeded - clear old entries
      if (error.name === 'QuotaExceededError') {
        this.clearOldestEntries(5);
        // Retry once
        try {
          const key = this.getKey(path, type);
          const cacheEntry = {
            data: data,
            timestamp: Date.now(),
            path: path,
            type: type
          };
          localStorage.setItem(key, JSON.stringify(cacheEntry));
          return true;
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }
      return false;
    }
  }

  /**
   * Retrieve data for a path
   * @param {string} path - The folder path
   * @param {string} type - Content type ('folders' or 'files')
   * @returns {Object|null} Cached data with metadata or null
   */
  get(path, type = 'folders') {
    try {
      const key = this.getKey(path, type);
      const cached = localStorage.getItem(key);
      
      if (!cached) return null;
      
      const cacheEntry = JSON.parse(cached);
      
      // Return entry with staleness info (path-aware TTL)
      return {
        data: cacheEntry.data,
        timestamp: cacheEntry.timestamp,
        isStale: this.isStale(cacheEntry.timestamp, cacheEntry.path),
        isExpired: this.isExpired(cacheEntry.timestamp, cacheEntry.path),
        age: Date.now() - cacheEntry.timestamp
      };
    } catch (error) {
      console.error('Failed to get path cache:', error);
      return null;
    }
  }

  /**
   * Check if a timestamp is stale (older than TTL but not expired)
   * Stale data can still be shown but should trigger background refresh
   * @param {number} timestamp - Cache timestamp
   * @param {string} path - The path (used to determine TTL)
   * @returns {boolean} True if stale
   */
  isStale(timestamp, path = '') {
    const age = Date.now() - timestamp;
    // Root path (departments) has 24-hour TTL, others have 6-hour TTL
    const ttl = (path === '/' || path === '') ? this.departmentTTL : this.defaultTTL;
    return age > ttl;
  }

  /**
   * Check if a timestamp is expired (hard expiry)
   * Expired data should not be shown at all
   * @param {number} timestamp - Cache timestamp
   * @param {string} path - The path (used to determine hard expiry)
   * @returns {boolean} True if expired
   */
  isExpired(timestamp, path = '') {
    const age = Date.now() - timestamp;
    // Root path (departments) has 7-day hard expiry, others have 24-hour
    const hardExpiry = (path === '/' || path === '') ? this.departmentHardExpiry : this.defaultHardExpiry;
    return age > hardExpiry;
  }

  /**
   * Check if path has fresh (non-stale) cached data
   * @param {string} path - The folder path
   * @param {string} type - Content type
   * @returns {boolean} True if fresh cache exists
   */
  hasFresh(path, type = 'folders') {
    const cached = this.get(path, type);
    return cached !== null && !cached.isStale;
  }

  /**
   * Check if path has any cached data (even stale)
   * @param {string} path - The folder path
   * @param {string} type - Content type
   * @returns {boolean} True if any cache exists
   */
  has(path, type = 'folders') {
    const cached = this.get(path, type);
    return cached !== null && !cached.isExpired;
  }

  /**
   * Remove cached data for a specific path
   * @param {string} path - The folder path
   * @param {string} type - Content type
   */
  remove(path, type = 'folders') {
    try {
      const key = this.getKey(path, type);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove path cache:', error);
    }
  }

  /**
   * Invalidate cache for a path (both folders and files)
   * Used when forcing a refresh
   * @param {string} path - The folder path to invalidate
   */
  invalidatePath(path) {
    this.remove(path, 'folders');
    this.remove(path, 'files');
  }

  /**
   * Clear all path caches
   */
  clearAll() {
    try {
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      this.updateMeta({ lastCleared: Date.now() });
      
      return true;
    } catch (error) {
      console.error('Failed to clear path caches:', error);
      return false;
    }
  }

  /**
   * Clear oldest cache entries to free up space
   * @param {number} count - Number of entries to remove
   */
  clearOldestEntries(count = 5) {
    try {
      const entries = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            entries.push({ key, timestamp: parsed.timestamp || 0 });
          }
        }
      }
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, count);
      toRemove.forEach(entry => localStorage.removeItem(entry.key));
      
    } catch (error) {
      console.error('Failed to clear oldest entries:', error);
    }
  }

  /**
   * Get all cached paths info
   * @returns {Array} Array of cache info objects
   */
  getAllCachedPaths() {
    const paths = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            paths.push({
              path: parsed.path,
              type: parsed.type,
              timestamp: parsed.timestamp,
              isStale: this.isStale(parsed.timestamp),
              age: Date.now() - parsed.timestamp
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to get cached paths:', error);
    }
    
    return paths;
  }

  /**
   * Get cache metadata
   * @returns {Object} Cache metadata
   */
  getMeta() {
    try {
      const meta = localStorage.getItem(this.metaKey);
      return meta ? JSON.parse(meta) : {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Update cache metadata
   * @param {Object} updates - Metadata updates
   */
  updateMeta(updates) {
    try {
      const currentMeta = this.getMeta();
      const newMeta = { ...currentMeta, ...updates };
      localStorage.setItem(this.metaKey, JSON.stringify(newMeta));
    } catch (error) {
      console.error('Failed to update meta:', error);
    }
  }

  /**
   * Get total cache size in KB
   * @returns {number} Size in KB
   */
  getTotalSize() {
    let totalSize = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += new Blob([value]).size;
          }
        }
      }
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
    }
    
    return (totalSize / 1024).toFixed(2);
  }

  /**
   * Get cache status for UI display
   * @returns {Object} Status info
   */
  getStatus() {
    const paths = this.getAllCachedPaths();
    const freshCount = paths.filter(p => !p.isStale).length;
    const staleCount = paths.filter(p => p.isStale).length;
    
    return {
      totalPaths: paths.length,
      freshPaths: freshCount,
      stalePaths: staleCount,
      sizeKB: this.getTotalSize()
    };
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} True if available
   */
  isAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
const pathCache = new PathCacheManager();

// Legacy compatibility - keep old cacheManager for migration
const cacheManager = {
  get: () => {
    console.warn('cacheManager.get() is deprecated. Data now loads on-demand.');
    return null;
  },
  set: () => {
    console.warn('cacheManager.set() is deprecated. Data now caches per-path.');
    return false;
  },
  clear: () => {
    pathCache.clearAll();
    // Also clear legacy cache key
    try {
      localStorage.removeItem('curb_data');
      localStorage.removeItem('curb_meta');
    } catch (e) {}
    return true;
  },
  isAvailable: () => pathCache.isAvailable()
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PathCacheManager, pathCache, cacheManager };
}

