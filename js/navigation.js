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
      route.view = 'department';
      route.department = decodeURIComponent(parts[0]);
    }
    if (parts.length >= 2) {
      route.view = 'level';
      route.level = decodeURIComponent(parts[1]);
    }
    if (parts.length >= 3) {
      route.view = 'semester';
      route.semester = decodeURIComponent(parts[2]);
    }
    if (parts.length >= 4) {
      route.view = 'session';
      route.session = decodeURIComponent(parts[3]);
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
        active: route.view === 'department'
      });
    }

    if (route.level) {
      breadcrumbs.push({
        label: route.level,
        path: `/${route.department}/${route.level}`,
        active: route.view === 'level'
      });
    }

    if (route.semester) {
      breadcrumbs.push({
        label: route.semester,
        path: `/${route.department}/${route.level}/${route.semester}`,
        active: route.view === 'semester'
      });
    }

    if (route.session) {
      breadcrumbs.push({
        label: route.session,
        path: `/${route.department}/${route.level}/${route.semester}/${route.session}`,
        active: true
      });
    }

    return breadcrumbs;
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

      case 'department':
        if (!this.data[route.department]) return null;
        return Object.keys(this.data[route.department]);

      case 'level':
        if (!this.data[route.department] || !this.data[route.department][route.level]) {
          return null;
        }
        return Object.keys(this.data[route.department][route.level]);

      case 'semester':
        if (!this.data[route.department] || 
            !this.data[route.department][route.level] ||
            !this.data[route.department][route.level][route.semester]) {
          return null;
        }
        return Object.keys(this.data[route.department][route.level][route.semester]);

      case 'session':
        if (!this.data[route.department] || 
            !this.data[route.department][route.level] ||
            !this.data[route.department][route.level][route.semester] ||
            !this.data[route.department][route.level][route.semester][route.session]) {
          return null;
        }
        return this.data[route.department][route.level][route.semester][route.session];

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
const navigator = new Navigator();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Navigator, navigator };
}

