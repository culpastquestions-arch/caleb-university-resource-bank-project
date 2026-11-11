// Path-Based Cache Management System
// Supports lazy-loading with path-aware stale thresholds and hard expiry

class PathCacheManager {
  constructor() {
    this.storagePrefix = 'curb_path_';
    this.defaultTTL = 30 * 60 * 1000; // 30 minutes
    this.departmentTTL = 2 * 60 * 60 * 1000; // 2 hours for departments (root path)
    this.defaultHardExpiry = 6 * 60 * 60 * 1000; // 6 hours hard expiry
    this.departmentHardExpiry = 24 * 60 * 60 * 1000; // 24 hours for departments
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
    const key = this.getKey(path, type);
    const value = JSON.stringify({
      data: data,
      timestamp: Date.now(),
      path: path,
      type: type
    });

    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Failed to set path cache:', error);

      if (error.name !== 'QuotaExceededError') {
        return false;
      }
    }

    // Storage is full - drop the oldest entries and retry once
    this.clearOldestEntries(5);
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (retryError) {
      console.error('Retry failed:', retryError);
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
    // Root path (departments) has 2-hour stale threshold; others are 30 minutes.
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
    // Root path (departments) has 24-hour hard expiry; others have 6 hours.
    const hardExpiry = (path === '/' || path === '') ? this.departmentHardExpiry : this.defaultHardExpiry;
    return age > hardExpiry;
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
}

// Create singleton instance
const pathCache = new PathCacheManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PathCacheManager, pathCache };
}

