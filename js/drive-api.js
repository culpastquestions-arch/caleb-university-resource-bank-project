// Google Drive API Integration (Lazy Loading via Backend Proxy)
// This module fetches data on-demand as users navigate, using path-based caching

class DriveAPI {
  constructor() {
    this.browseEndpoint = '/api/browse';
    this.loaded = false;
    this.loading = new Map(); // Track in-flight requests by path
  }

  /**
   * Initialize the Drive API client
   * @param {string} apiEndpoint - Backend API endpoint URL (optional, for legacy compatibility)
   */
  async init(apiEndpoint) {
    // Set browse endpoint if custom one provided
    if (apiEndpoint && apiEndpoint !== '/api/drive') {
      this.browseEndpoint = apiEndpoint;
    }
    this.loaded = true;
    return true;
  }

  /**
   * Build the API path from route components
   * @param {Object} route - Route object with department, level, semester, session
   * @returns {string} API path
   */
  buildPath(route) {
    const parts = [];
    
    if (route.department) parts.push(route.department);
    if (route.level) parts.push(route.level);
    if (route.semester) parts.push(route.semester);
    if (route.session) parts.push(route.session);
    
    return '/' + parts.join('/');
  }

  /**
   * Fetch folders at a specific path (with caching)
   * @param {string} path - The folder path
   * @param {boolean} forceRefresh - Skip cache and force fresh fetch
   * @returns {Promise<Array>} Array of folder objects
   */
  async fetchFolders(path, forceRefresh = false) {
    return this.fetchPath(path, 'folders', forceRefresh);
  }

  /**
   * Fetch files at a specific path (with caching)
   * @param {string} path - The folder path
   * @param {boolean} forceRefresh - Skip cache and force fresh fetch
   * @returns {Promise<Array>} Array of file objects
   */
  async fetchFiles(path, forceRefresh = false) {
    return this.fetchPath(path, 'files', forceRefresh);
  }

  /**
   * Core fetch method with caching and background refresh
   * @param {string} path - The folder path
   * @param {string} type - 'folders' or 'files'
   * @param {boolean} forceRefresh - Skip cache
   * @returns {Promise<Array>} Data array
   */
  async fetchPath(path, type = 'folders', forceRefresh = false) {
    const cacheKey = `${path}:${type}`;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = pathCache.get(path, type);
      
      if (cached && !cached.isExpired) {
        // If stale but not expired, trigger background refresh
        if (cached.isStale) {
          this.backgroundRefresh(path, type);
        }
        return cached.data;
      }
    }

    // Check if already fetching this path
    if (this.loading.has(cacheKey)) {
      return this.loading.get(cacheKey);
    }

    // Create fetch promise
    const fetchPromise = this.doFetch(path, type);
    this.loading.set(cacheKey, fetchPromise);

    try {
      const data = await fetchPromise;
      return data;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  /**
   * Perform the actual API fetch
   * @param {string} path - The folder path
   * @param {string} type - 'folders' or 'files'
   * @returns {Promise<Array>} Data array
   */
  async doFetch(path, type) {
    const url = `${this.browseEndpoint}?path=${encodeURIComponent(path)}&type=${type}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }

    const result = await response.json();
    
    // Cache the result
    pathCache.set(path, type, result.data);
    
    return result.data;
  }

  /**
   * Background refresh - fetch fresh data without blocking UI
   * @param {string} path - The folder path
   * @param {string} type - 'folders' or 'files'
   */
  backgroundRefresh(path, type) {
    // Don't await - let it run in background
    this.doFetch(path, type).catch(err => {
      console.warn('Background refresh failed:', err);
    });
  }

  /**
   * Fetch departments (root level folders)
   * @param {boolean} forceRefresh - Skip cache
   * @returns {Promise<Array>} Array of department names
   */
  async fetchDepartments(forceRefresh = false) {
    const folders = await this.fetchFolders('/', forceRefresh);
    return folders.map(f => f.name);
  }

  /**
   * Fetch levels for a department
   * @param {string} department - Department name
   * @param {boolean} forceRefresh - Skip cache
   * @returns {Promise<Array>} Array of level names
   */
  async fetchLevels(department, forceRefresh = false) {
    const path = `/${department}`;
    const folders = await this.fetchFolders(path, forceRefresh);
    return folders.map(f => f.name);
  }

  /**
   * Fetch semesters for a department/level
   * @param {string} department - Department name
   * @param {string} level - Level name
   * @param {boolean} forceRefresh - Skip cache
   * @returns {Promise<Array>} Array of semester names
   */
  async fetchSemesters(department, level, forceRefresh = false) {
    const path = `/${department}/${level}`;
    const folders = await this.fetchFolders(path, forceRefresh);
    return folders.map(f => f.name);
  }

  /**
   * Fetch sessions for a department/level/semester
   * @param {string} department - Department name
   * @param {string} level - Level name
   * @param {string} semester - Semester name
   * @param {boolean} forceRefresh - Skip cache
   * @returns {Promise<Array>} Array of session names
   */
  async fetchSessions(department, level, semester, forceRefresh = false) {
    const path = `/${department}/${level}/${semester}`;
    const folders = await this.fetchFolders(path, forceRefresh);
    return folders.map(f => f.name);
  }

  /**
   * Fetch files for a complete path
   * @param {string} department - Department name
   * @param {string} level - Level name
   * @param {string} semester - Semester name
   * @param {string} session - Session name
   * @param {boolean} forceRefresh - Skip cache
   * @returns {Promise<Array>} Array of file objects
   */
  async fetchSessionFiles(department, level, semester, session, forceRefresh = false) {
    const path = `/${department}/${level}/${semester}/${session}`;
    return this.fetchFiles(path, forceRefresh);
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string
   */
  formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    
    const kb = bytes / 1024;
    const mb = kb / 1024;
    
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    } else {
      return `${kb.toFixed(2)} KB`;
    }
  }

  /**
   * Format date for display
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date
   */
  formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get the view link for a file
   * @param {Object} file - File object from Drive API
   * @returns {string} View URL
   */
  getViewLink(file) {
    return file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
  }

  /**
   * Get the download link for a file
   * @param {Object} file - File object from Drive API
   * @returns {string} Download URL
   */
  getDownloadLink(file) {
    return file.webContentLink || `https://drive.google.com/uc?export=download&id=${file.id}`;
  }

  /**
   * Check API health/connectivity
   * @returns {Promise<boolean>} True if API is accessible
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.browseEndpoint}?path=/&type=folders`, {
        method: 'GET'
      });
      return response.ok;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }

  /**
   * Clear all cached data and force fresh fetch on next navigation
   */
  clearCache() {
    pathCache.clearAll();
  }

  // Legacy method for backward compatibility
  async fetchStructure() {
    console.warn('fetchStructure() is deprecated. Data now loads on-demand.');
    return {};
  }
}

// Create singleton instance
const driveAPI = new DriveAPI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DriveAPI, driveAPI };
}

