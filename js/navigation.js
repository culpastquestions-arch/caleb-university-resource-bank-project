// Navigation System for SPA
class Navigator {
  constructor() {
    this.currentRoute = this.parseRoute();
    this.data = null;
    this.listeners = [];
  }

  /**
   * Initialize the navigator
   * @param {Object} data - The application data
   */
  init(data) {
    this.data = data;
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.currentRoute = this.parseRoute();
      this.notifyListeners();
    });

    // Handle initial route
    this.notifyListeners();
  }

  /**
   * Parse the current URL hash into route components
   * @returns {Object} Route object
   */
  parseRoute() {
    const hash = window.location.hash.slice(1) || '';
    const parts = hash.split('/').filter(p => p);

    const route = {
      view: 'home',
      department: null,
      level: null,
      semester: null,
      session: null
    };

    if (parts.length >= 1) {
      route.view = 'levels';  // Show levels for this department
      route.department = decodeURIComponent(parts[0]);
    }
    if (parts.length >= 2) {
      route.view = 'semesters';  // Show semesters for this level
      route.department = decodeURIComponent(parts[0]);
      route.level = decodeURIComponent(parts[1]);
    }
    if (parts.length >= 3) {
      route.department = decodeURIComponent(parts[0]);
      route.level = decodeURIComponent(parts[1]);
      route.semester = decodeURIComponent(parts[2]);
      
      // Special handling for Jupeb - it has Subject → Session structure
      if (route.department === 'Jupeb') {
        route.view = 'sessions';  // For Jupeb, 3 parts means sessions (Subject → Session)
        route.session = route.semester;  // The third part is actually the session
        route.semester = null;  // No semester for Jupeb
      } else {
        route.view = 'sessions';  // Show sessions for this semester
      }
    }
    if (parts.length >= 4) {
      route.department = decodeURIComponent(parts[0]);
      route.level = decodeURIComponent(parts[1]);
      route.semester = decodeURIComponent(parts[2]);
      route.session = decodeURIComponent(parts[3]);
      
      // Special handling for Jupeb - 4 parts means files (Subject → Session → Files)
      if (route.department === 'Jupeb') {
        route.view = 'files';  // For Jupeb, 4 parts means files
        route.semester = null;  // No semester for Jupeb
      } else {
        route.view = 'files';  // Show files for this session
      }
    }

    return route;
  }

  /**
   * Navigate to a new route
   * @param {string} path - The route path (e.g., '/Accounting/100 Level')
   */
  navigateTo(path) {
    window.location.hash = path;
    this.currentRoute = this.parseRoute();
    this.notifyListeners();
    window.scrollTo(0, 0);
  }

  /**
   * Navigate back one level
   */
  goBack() {
    const route = this.currentRoute;

    if (route.session) {
      this.navigateTo(`/${route.department}/${route.level}/${route.semester}`);
    } else if (route.semester) {
      this.navigateTo(`/${route.department}/${route.level}`);
    } else if (route.level) {
      this.navigateTo(`/${route.department}`);
    } else if (route.department) {
      this.navigateTo('/');
    }
  }

  /**
   * Navigate to home
   */
  goHome() {
    this.navigateTo('/');
  }

  /**
   * Get the current route
   * @returns {Object} Current route object
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Get breadcrumb trail for current route
   * @returns {Array} Array of breadcrumb objects
   */
  getBreadcrumbs() {
    const route = this.currentRoute;
    const breadcrumbs = [
      { label: 'Home', path: '/', active: route.view === 'home' }
    ];

    if (route.department) {
      breadcrumbs.push({
        label: route.department,
        path: `/${route.department}`,
        active: route.view === 'levels'
      });
    }

    if (route.level) {
      breadcrumbs.push({
        label: route.level,
        path: `/${route.department}/${route.level}`,
        active: route.view === 'semesters'
      });
    }

    if (route.semester) {
      breadcrumbs.push({
        label: route.semester,
        path: `/${route.department}/${route.level}/${route.semester}`,
        active: route.view === 'sessions'
      });
    }

    if (route.session) {
      breadcrumbs.push({
        label: route.session,
        path: `/${route.department}/${route.level}/${route.semester}/${route.session}`,
        active: route.view === 'files'
      });
    }

    return breadcrumbs;
  }

  /**
   * Helper function to find data key with or without trailing spaces
   * @param {Object} obj - Object to search in
   * @param {string} key - Key to find
   * @returns {string|null} Actual key found or null
   */
  findDataKey(obj, key) {
    if (!obj) return null;
    
    // Try exact match first
    if (obj.hasOwnProperty(key)) return key;
    
    // Try with trailing space
    if (obj.hasOwnProperty(key + ' ')) return key + ' ';
    
    // Try without trailing space if key has one
    if (key.endsWith(' ') && obj.hasOwnProperty(key.slice(0, -1))) {
      return key.slice(0, -1);
    }
    
    return null;
  }

  /**
   * Get data for the current route
   * @returns {Object|Array|null} Data for current view
   */
  getRouteData() {
    if (!this.data) return null;

    const route = this.currentRoute;

    switch (route.view) {
      case 'home':
        return CONFIG.departments;

      case 'levels':
        const deptKey = this.findDataKey(this.data, route.department);
        if (!deptKey) return null;
        return Object.keys(this.data[deptKey]);

      case 'semesters':
        const deptKey2 = this.findDataKey(this.data, route.department);
        if (!deptKey2) return null;
        const levelKey = this.findDataKey(this.data[deptKey2], route.level);
        if (!levelKey) return null;
        
        // Special handling for Jupeb - it skips semester level
        if (route.department === 'Jupeb') {
          // For Jupeb, return sessions directly
          return Object.keys(this.data[deptKey2][levelKey]);
        } else {
          // Standard structure for other departments
          return Object.keys(this.data[deptKey2][levelKey]);
        }

      case 'sessions':
        const deptKey3 = this.findDataKey(this.data, route.department);
        if (!deptKey3) return null;
        const levelKey2 = this.findDataKey(this.data[deptKey3], route.level);
        if (!levelKey2) return null;
        
        // Special handling for Jupeb - it has Subject → Session structure
        if (route.department === 'Jupeb') {
          // For Jupeb, return sessions directly under the subject
          return Object.keys(this.data[deptKey3][levelKey2]);
        } else {
          // Standard structure for other departments
          const semesterKey = this.findDataKey(this.data[deptKey3][levelKey2], route.semester);
          if (!semesterKey) return null;
          return Object.keys(this.data[deptKey3][levelKey2][semesterKey]);
        }

      case 'files':
        const deptKey4 = this.findDataKey(this.data, route.department);
        if (!deptKey4) return null;
        const levelKey3 = this.findDataKey(this.data[deptKey4], route.level);
        if (!levelKey3) return null;
        
        // Special handling for Jupeb - it has Subject → Session structure
        if (route.department === 'Jupeb') {
          // For Jupeb, route.level is the subject, route.session is the session
          const sessionKey = this.findDataKey(this.data[deptKey4][levelKey3], route.session);
          if (!sessionKey) return null;
          return this.data[deptKey4][levelKey3][sessionKey];
        } else {
          // Standard structure for other departments
          const semesterKey2 = this.findDataKey(this.data[deptKey4][levelKey3], route.semester);
          if (!semesterKey2) return null;
          const sessionKey = this.findDataKey(this.data[deptKey4][levelKey3][semesterKey2], route.session);
          if (!sessionKey) return null;
          return this.data[deptKey4][levelKey3][semesterKey2][sessionKey];
        }

      default:
        return null;
    }
  }

  /**
   * Check if a route is valid
   * @returns {boolean} True if valid, false otherwise
   */
  isValidRoute() {
    const route = this.currentRoute;

    if (route.view === 'home') return true;

    // If no data loaded yet, consider route potentially valid
    // This prevents "Page Not Found" during initial loading
    if (!this.data) {
      // Check if department name is at least in our config
      if (route.department && !CONFIG.departments.includes(route.department)) {
        return false;
      }
      return true; // Let it try to render, app will show loading state
    }

    if (route.department && !CONFIG.departments.includes(route.department)) {
      return false;
    }

    const data = this.getRouteData();
    return data !== null;
  }

  /**
   * Add a listener for route changes
   * @param {Function} callback - Callback function
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove a listener
   * @param {Function} callback - Callback function to remove
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  /**
   * Notify all listeners of route change
   */
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.currentRoute));
  }

  /**
   * Generate a shareable URL for current route
   * @returns {string} Full URL
   */
  getShareableURL() {
    return window.location.href;
  }

  /**
   * Get title for current route
   * @returns {string} Page title
   */
  getPageTitle() {
    const route = this.currentRoute;
    const baseTitle = CONFIG.app.name;

    if (route.view === 'home') {
      return baseTitle;
    }

    const parts = [baseTitle];

    if (route.department) parts.push(route.department);
    if (route.level) parts.push(route.level);
    if (route.semester) parts.push(route.semester);
    if (route.session) parts.push(route.session);

    return parts.join(' - ');
  }

  /**
   * Update document title
   */
  updateTitle() {
    document.title = this.getPageTitle();
  }
}

// Create singleton instance
const appNavigator = new Navigator();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Navigator, appNavigator };
}

