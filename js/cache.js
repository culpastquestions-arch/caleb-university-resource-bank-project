// Cache Management System
class CacheManager {
  constructor() {
    this.storageKey = 'curb_data';
    this.metaKey = 'curb_meta';
  }

  /**
   * Store data in cache
   * @param {Object} data - The data to cache
   */
  set(data) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        version: CONFIG.cache.version,
        data: data
      };
      localStorage.setItem(this.storageKey, JSON.stringify(cacheData));
      this.updateMeta({ lastUpdated: Date.now() });
      return true;
    } catch (error) {
      console.error('Failed to set cache:', error);
      // Handle quota exceeded or other storage errors
      if (error.name === 'QuotaExceededError') {
        this.clear();
      }
      return false;
    }
  }

  /**
   * Retrieve data from cache
   * @returns {Object|null} Cached data or null if not found/expired
   */
  get() {
    try {
      const cached = localStorage.getItem(this.storageKey);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check if cache is valid
      if (!this.isValid(cacheData)) {
        this.clear();
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cache:', error);
      this.clear();
      return null;
    }
  }

  /**
   * Check if cached data is still valid
   * @param {Object} cacheData - The cached data object
   * @returns {boolean} True if valid, false otherwise
   */
  isValid(cacheData) {
    if (!cacheData || !cacheData.timestamp || !cacheData.version) {
      return false;
    }

    // Check version
    if (cacheData.version !== CONFIG.cache.version) {
      return false;
    }

    // Check expiry
    const now = Date.now();
    const age = now - cacheData.timestamp;
    const maxAge = CONFIG.cache.durationDays * 24 * 60 * 60 * 1000; // Convert days to ms

    return age < maxAge;
  }

  /**
   * Clear all cached data
   */
  clear() {
    try {
      localStorage.removeItem(this.storageKey);
      this.updateMeta({ lastCleared: Date.now() });
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
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
   * Get cache age in days
   * @returns {number} Cache age in days
   */
  getAgeInDays() {
    const cached = localStorage.getItem(this.storageKey);
    if (!cached) return Infinity;

    try {
      const cacheData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;
      return Math.floor(age / (24 * 60 * 60 * 1000));
    } catch (error) {
      return Infinity;
    }
  }

  /**
   * Get last updated date
   * @returns {Date|null} Last updated date or null
   */
  getLastUpdated() {
    const cached = localStorage.getItem(this.storageKey);
    if (!cached) return null;

    try {
      const cacheData = JSON.parse(cached);
      return new Date(cacheData.timestamp);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get cache status for UI display
   * @returns {Object} Status object with type and message
   */
  getStatus() {
    const cached = localStorage.getItem(this.storageKey);
    
    if (!cached) {
      return {
        type: 'empty',
        message: 'No cached data',
        color: 'secondary'
      };
    }

    try {
      const cacheData = JSON.parse(cached);
      const ageInDays = this.getAgeInDays();

      if (!this.isValid(cacheData)) {
        return {
          type: 'expired',
          message: 'Cache expired',
          color: 'warning'
        };
      }

      if (ageInDays === 0) {
        return {
          type: 'fresh',
          message: 'Updated today',
          color: 'success'
        };
      } else if (ageInDays === 1) {
        return {
          type: 'recent',
          message: 'Updated yesterday',
          color: 'success'
        };
      } else {
        return {
          type: 'cached',
          message: `Updated ${ageInDays} days ago`,
          color: 'info'
        };
      }
    } catch (error) {
      return {
        type: 'error',
        message: 'Cache error',
        color: 'error'
      };
    }
  }

  /**
   * Check if storage is available
   * @returns {boolean} True if localStorage is available
   */
  isAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage usage info
   * @returns {Object} Storage usage information
   */
  getStorageInfo() {
    if (!this.isAvailable()) {
      return { available: false };
    }

    try {
      const cached = localStorage.getItem(this.storageKey);
      const size = cached ? new Blob([cached]).size : 0;
      const sizeKB = (size / 1024).toFixed(2);

      return {
        available: true,
        sizeKB: sizeKB,
        sizeHuman: size < 1024 ? `${size} B` : `${sizeKB} KB`
      };
    } catch (error) {
      return { available: true, error: true };
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CacheManager, cacheManager };
}

