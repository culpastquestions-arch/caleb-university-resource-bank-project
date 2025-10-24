// Google Drive API Integration (via Backend Proxy)
// This now connects to our secure serverless function instead of directly to Google Drive
class DriveAPI {
  constructor() {
    this.apiEndpoint = null;
    this.loaded = false;
    this.loading = false;
  }

  /**
   * Initialize the Drive API client
   * @param {string} apiEndpoint - Backend API endpoint URL
   */
  async init(apiEndpoint) {
    if (this.loading) return;
    if (this.loaded) return;

    this.apiEndpoint = apiEndpoint || '/api/drive';
    this.loading = true;

    try {
      // Test the connection
      const response = await fetch(this.apiEndpoint);
      if (!response.ok && response.status !== 500) {
        throw new Error(`API endpoint not responding: ${response.status}`);
      }
      
      this.loaded = true;
      this.loading = false;
      return true;
    } catch (error) {
      console.error('Failed to initialize Drive API client:', error);
      this.loading = false;
      // Don't throw - allow fallback to cached data
      this.loaded = true; // Mark as loaded anyway to allow cached data usage
      return false;
    }
  }

  /**
   * Fetch the complete folder structure from backend proxy
   * @returns {Promise<Object>} Structured data organized by department/level/semester/session
   */
  async fetchStructure() {
    if (!this.loaded) {
      throw new Error('Drive API not initialized');
    }

    try {
      // Add version parameter for cache busting
      const versionedEndpoint = `${this.apiEndpoint}?v=${CONFIG.version}`;
      
      const response = await fetch(versionedEndpoint, {
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
      
      // Log cache status
      // Cache status handled silently

      return result.data;
    } catch (error) {
      console.error('Failed to fetch structure:', error);
      throw error;
    }
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
   * Check API health/connectivity
   * @returns {Promise<boolean>} True if API is accessible
   */
  async checkHealth() {
    try {
      if (!this.loaded) return false;
      
      const response = await fetch(this.apiEndpoint, {
        method: 'GET'
      });
      
      return response.ok;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
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
}

// Create singleton instance
const driveAPI = new DriveAPI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DriveAPI, driveAPI };
}

