// Navigation System for SPA
//
// ROUTING STRUCTURE:
// Standard departments: Department → Level → Semester → Session → Files
//   URL pattern: #/Department/Level/Semester/Session
//   Example: #/Computer Science/100 Level/1st Semester/2024~25 Session
//
// SPECIAL CASE - Jupeb:
//   Jupeb uses a different hierarchy: Subject → Session → Files (no Semester layer)
//   URL pattern: #/Jupeb/Subject/Session
//   Example: #/Jupeb/Science/2024~25 Session
//   The 'level' route parameter is repurposed as 'subject' for Jupeb
//   The 'semester' route parameter is skipped entirely
//
// NOTE: Folder names containing '/' are encoded as '~' in URLs to prevent
// path parsing issues. Use encodeSegment/decodeSegment for URL building/parsing.

/**
 * Encode a path segment for use in URLs.
 * Replaces '/' with '~' to prevent path splitting issues.
 * @param {string} segment - The raw folder/file name.
 * @returns {string} URL-safe encoded segment.
 */
function encodeSegment(segment) {
  if (!segment) return '';
  // Replace / with ~ before URI encoding
  return encodeURIComponent(segment.replace(/\//g, '~'));
}

/**
 * Decode a path segment from URLs.
 * Only URI decodes - preserves ~ for API communication.
 * @param {string} segment - The URL-encoded segment.
 * @returns {string} Decoded segment (~ preserved for API paths).
 */
function decodeSegment(segment) {
  if (!segment) return '';
  // URI decode only - keep ~ for API paths
  return decodeURIComponent(segment);
}

/**
 * Convert internal name (with ~) to display name (with /).
 * Use this when showing folder names to users.
 * @param {string} name - Internal name with ~ substitutes.
 * @returns {string} Human-readable name with / restored.
 */
function displayName(name) {
  if (!name) return '';
  return name.replace(/~/g, '/');
}

class Navigator {
  constructor() {
    this.currentRoute = this.parseRoute();
    this.listeners = [];
  }

  /**
   * Initialize the navigator
   * Note: With lazy loading, we no longer need preloaded data
   */
  init() {
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
    let hash = window.location.hash.slice(1) || '';

    // Backward compatibility: Fix old URLs with session years like "2024/25"
    // Convert patterns like "/2024/25 Session" or "/2023/24 Session" to use ~
    hash = hash.replace(/\/(\d{4})\/(\d{2})\s*(Session|session)/g, '/$1~$2 $3');

    const parts = hash.split('/').filter(p => p);

    const route = {
      view: 'home',
      department: null,
      level: null,
      semester: null,
      session: null
    };

    // Special route for About page
    if (parts.length === 1 && parts[0].toLowerCase() === 'about') {
      route.view = 'about';
      return route;
    }

    if (parts.length >= 1) {
      route.view = 'levels';  // Show levels for this department
      route.department = decodeSegment(parts[0]);
    }

    if (parts.length >= 2) {
      route.department = decodeSegment(parts[0]);
      route.level = decodeSegment(parts[1]);

      // For Jupeb, level is actually subject
      // Next view after subject is sessions (direct, no semesters)
      if (route.department === 'Jupeb') {
        route.view = 'sessions';  // Jupeb: Subject → Session
      } else {
        route.view = 'semesters';  // Standard: Level → Semester
      }
    }

    if (parts.length >= 3) {
      route.department = decodeSegment(parts[0]);
      route.level = decodeSegment(parts[1]);

      if (route.department === 'Jupeb') {
        // Jupeb: 3 parts means Subject/Session → Files
        route.view = 'files';
        route.session = decodeSegment(parts[2]);  // 3rd part is session for Jupeb
        route.semester = null;  // No semester for Jupeb
      } else {
        // Standard: 3 parts means Level/Semester → Sessions
        route.view = 'sessions';
        route.semester = decodeSegment(parts[2]);
      }
    }

    if (parts.length >= 4) {
      route.department = decodeSegment(parts[0]);
      route.level = decodeSegment(parts[1]);

      if (route.department === 'Jupeb') {
        // Jupeb shouldn't have 4+ parts, but handle gracefully
        route.view = 'files';
        route.session = decodeSegment(parts[2]);
        route.semester = null;
      } else {
        // Standard: 4 parts means Level/Semester/Session → Files
        route.view = 'files';
        route.semester = decodeSegment(parts[2]);
        route.session = decodeSegment(parts[3]);
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
        label: displayName(route.department),
        path: `/${encodeSegment(route.department)}`,
        active: route.view === 'levels'
      });
    }

    if (route.level) {
      breadcrumbs.push({
        label: displayName(route.level),
        path: `/${encodeSegment(route.department)}/${encodeSegment(route.level)}`,
        active: route.view === 'semesters'
      });
    }

    if (route.semester) {
      breadcrumbs.push({
        label: displayName(route.semester),
        path: `/${encodeSegment(route.department)}/${encodeSegment(route.level)}/${encodeSegment(route.semester)}`,
        active: route.view === 'sessions'
      });
    }

    if (route.session) {
      breadcrumbs.push({
        label: displayName(route.session),
        path: `/${encodeSegment(route.department)}/${encodeSegment(route.level)}/${encodeSegment(route.semester)}/${encodeSegment(route.session)}`,
        active: route.view === 'files'
      });
    }

    return breadcrumbs;
  }

  /**
   * Check if a route is valid (basic structural validation)
   * With dynamic departments from Google Drive, we can't validate department names client-side
   * Actual data existence is validated when fetching from API
   * @returns {boolean} True if structurally valid
   */
  isValidRoute() {
    const route = this.currentRoute;

    // Home is always valid
    if (route.view === 'home') return true;

    // If we have a department name, the route is structurally valid
    // The actual department existence will be validated by the API call
    // (If folder doesn't exist in Drive, the fetch will return empty/error)
    if (route.department) {
      return true;
    }

    return false;
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

    if (route.view === 'about') {
      return `About Us - ${baseTitle}`;
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
  module.exports = { Navigator, appNavigator, encodeSegment, decodeSegment, displayName };
}

