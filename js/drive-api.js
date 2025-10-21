// Google Drive API Integration
class DriveAPI {
  constructor() {
    this.apiKey = null;
    this.rootFolderId = null;
    this.loaded = false;
    this.loading = false;
  }

  /**
   * Initialize the Drive API
   * @param {string} apiKey - Google API key
   * @param {string} rootFolderId - Root folder ID
   */
  async init(apiKey, rootFolderId) {
    if (this.loading) return;
    if (this.loaded) return;

    this.apiKey = apiKey;
    this.rootFolderId = rootFolderId;
    this.loading = true;

    try {
      await this.loadGapiClient();
      await gapi.client.init({
        apiKey: this.apiKey,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
      });
      this.loaded = true;
      this.loading = false;
      return true;
    } catch (error) {
      console.error('Failed to initialize Drive API:', error);
      this.loading = false;
      throw error;
    }
  }

  /**
   * Load the Google API client library
   */
  loadGapiClient() {
    return new Promise((resolve, reject) => {
      if (typeof gapi !== 'undefined' && gapi.client) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        gapi.load('client', resolve);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Fetch the complete folder structure from Drive
   * @returns {Promise<Object>} Structured data organized by department/level/semester/session
   */
  async fetchStructure() {
    if (!this.loaded) {
      throw new Error('Drive API not initialized');
    }

    try {
      const structure = {};

      // Get all department folders
      const departments = await this.listFolders(this.rootFolderId);
      
      for (const dept of departments) {
        if (!CONFIG.departments.includes(dept.name)) continue;

        structure[dept.name] = {};
        const levels = getDepartmentLevels(dept.name);

        // Get level folders for this department
        const levelFolders = await this.listFolders(dept.id);

        for (const levelFolder of levelFolders) {
          // Parse level number (e.g., "100 Level" -> 100)
          const levelMatch = levelFolder.name.match(/(\d+)/);
          if (!levelMatch) continue;
          const levelNum = parseInt(levelMatch[1]);
          
          // Check if this level is valid for this department
          if (!levels.includes(levelNum)) continue;

          structure[dept.name][levelFolder.name] = {};

          // Get semester folders
          const semesters = await this.listFolders(levelFolder.id);

          for (const semester of semesters) {
            structure[dept.name][levelFolder.name][semester.name] = {};

            // Get session folders
            const sessions = await this.listFolders(semester.id);

            for (const session of sessions) {
              // Get PDF files in this session
              const files = await this.listFiles(session.id);
              structure[dept.name][levelFolder.name][semester.name][session.name] = files;
            }
          }
        }
      }

      return structure;
    } catch (error) {
      console.error('Failed to fetch structure:', error);
      throw error;
    }
  }

  /**
   * List folders in a directory
   * @param {string} folderId - Parent folder ID
   * @returns {Promise<Array>} Array of folder objects
   */
  async listFolders(folderId) {
    try {
      const response = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'name'
      });

      return response.result.files || [];
    } catch (error) {
      console.error(`Failed to list folders in ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * List PDF files in a folder
   * @param {string} folderId - Parent folder ID
   * @returns {Promise<Array>} Array of file objects
   */
  async listFiles(folderId) {
    try {
      const response = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
        fields: 'files(id, name, modifiedTime, size, webViewLink, webContentLink)',
        orderBy: 'name'
      });

      return response.result.files || [];
    } catch (error) {
      console.error(`Failed to list files in ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File metadata
   */
  async getFile(fileId) {
    try {
      const response = await gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'id, name, modifiedTime, size, webViewLink, webContentLink'
      });

      return response.result;
    } catch (error) {
      console.error(`Failed to get file ${fileId}:`, error);
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
      
      // Try to get root folder info
      const response = await gapi.client.drive.files.get({
        fileId: this.rootFolderId,
        fields: 'id, name'
      });
      
      return !!response.result;
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

