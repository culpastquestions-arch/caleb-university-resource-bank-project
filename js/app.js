// Main Application Logic (Orchestrator)
// Delegates rendering to Renderer, PWA features to PWAManager

/**
 * Main application class — orchestrates initialization, routing,
 * event handling, and delegates rendering/PWA to dedicated modules.
 */
class App {
  constructor() {
    this.departments = null;
  }

  /**
   * Initialize the application.
   */
  async init() {
    try {
      // Check for environment variables
      this.loadConfig();

      // Check version and clear cache if needed
      this.checkVersionAndClearCache();

      // Setup PWA features
      pwaManager.setup();

      // Initialize Drive API
      await driveAPI.init();

      // Setup event listeners
      this.setupEventListeners();

      // Initialize navigator (no data needed upfront)
      appNavigator.init(null);
      appNavigator.addListener(() => this.handleRouteChange());

      // Render initial view
      await this.handleRouteChange();

    } catch (error) {
      console.error('App initialization failed:', error);
      this.showError(error);
    }
  }

  /**
   * Load configuration from environment or defaults.
   */
  loadConfig() {
    CONFIG.api.endpoint = window.ENV?.API_ENDPOINT || '/api/browse';
  }

  /**
   * Check app version and clear cache if version changed.
   */
  checkVersionAndClearCache() {
    const storedVersion = localStorage.getItem('app_version');
    const currentVersion = CONFIG.version;

    if (storedVersion !== currentVersion) {
      this.clearAllCaches();
      localStorage.setItem('app_version', currentVersion);
    }
  }

  /**
   * Clear all caches (service worker + localStorage).
   */
  async clearAllCaches() {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      pathCache.clearAll();

      // Clear any remaining legacy cache keys
      try {
        localStorage.removeItem('curb_data');
        localStorage.removeItem('curb_meta');
      } catch (e) {
        // Non-critical, ignore
      }
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Handle route changes — dispatch to appropriate renderer.
   */
  async handleRouteChange(options = {}) {
    const { forceRefresh = false } = options;
    const route = appNavigator.getCurrentRoute();
    const mainContent = document.getElementById('main-content');

    if (!mainContent) return;

    // Update breadcrumbs and title immediately
    renderer.renderBreadcrumbs();
    appNavigator.updateTitle();

    try {
      switch (route.view) {
        case 'home':
          this.departments = await renderer.renderHome(mainContent, { forceRefresh });
          this.attachSearchListener();
          break;
        case 'about':
          await renderer.renderAboutPage(mainContent, { forceRefresh });
          break;
        case 'track':
          await renderer.renderCoverage(mainContent, { forceRefresh });
          break;
        case 'levels':
          await renderer.renderLevels(mainContent, route, { forceRefresh });
          break;
        case 'semesters':
          await renderer.renderSemesters(mainContent, route, { forceRefresh });
          break;
        case 'sessions':
          await renderer.renderSessions(mainContent, route, { forceRefresh });
          break;
        case 'files':
          await renderer.renderFiles(mainContent, route, { forceRefresh });
          break;
        default:
          mainContent.innerHTML = renderer.renderNotFound();
      }
    } catch (error) {
      console.error('Error rendering view:', error);
      mainContent.innerHTML = renderer.renderErrorState(error.message);
    }
  }

  /**
   * Setup event listeners.
   */
  setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.handleRefresh());
    }

    // Scroll detection for header styling
    this.setupScrollListener();

    // Announcement close
    document.addEventListener('click', (e) => {
      if (e.target.closest('.announcement-close')) {
        this.dismissAnnouncement();
      }

      const actionButton = e.target.closest('[data-action]');
      if (!actionButton) return;

      const action = actionButton.getAttribute('data-action');
      if (action === 'refresh-content') {
        this.handleRefresh();
      } else if (action === 'go-home') {
        appNavigator.goHome();
      }
    });

    // Dark mode toggle
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (darkModeBtn) {
      darkModeBtn.addEventListener('click', () => this.toggleDarkMode());
    }

    // Item #14: Offline detection and recovery
    this.setupOfflineDetection();

    // Contact modal
    const installButton = document.getElementById('install-button');
    const installLinkFooter = document.getElementById('install-link-footer');
    const contactBtn = document.getElementById('contact-btn');
    const contactLink = document.getElementById('contact-link');
    const contactLinkFooter = document.getElementById('contact-link-footer');
    const contactModal = document.getElementById('contact-modal');

    if (installButton) {
      installButton.addEventListener('click', () => this.installApp());
    }
    if (installLinkFooter) {
      installLinkFooter.addEventListener('click', (e) => {
        e.preventDefault();
        this.installApp();
      });
    }

    contactModalHelper.wire({
      contactBtn,
      contactLink,
      contactLinkFooter,
      contactModal,
      onOpen: () => this.openContactModal(),
      onClose: () => this.closeContactModal()
    });
  }

  /**
   * Setup scroll listener for header styling.
   */
  setupScrollListener() {
    let ticking = false;

    const updateHeader = () => {
      const header = document.querySelector('.app-header');
      if (header) {
        if (window.scrollY > 50) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /**
   * Show error state.
   * @param {Error} error - The error object.
   */
  showError(error) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = renderer.renderErrorState(error?.message || 'An error occurred');
    }
  }

  /**
   * Handle refresh button — invalidates cache and re-renders.
   */
  async handleRefresh() {
    const route = appNavigator.getCurrentRoute();

    let currentPath = '';
    if (route.department) {
      currentPath = `/${route.department}`;
      if (route.level) {
        currentPath += `/${route.level}`;
        if (route.semester) {
          currentPath += `/${route.semester}`;
          if (route.session) {
            currentPath += `/${route.session}`;
          }
        }
      }
    }

    if (pathCache) {
      // On Home/About/Track routes there is no department path; invalidate root cache.
      const refreshPath = currentPath || '/';
      pathCache.invalidatePath(refreshPath);
    }

    await this.handleRouteChange({ forceRefresh: true });
    this.showToast('Content refreshed successfully!', 'success');
  }

  /**
   * Attach search event listener (called when home view is rendered).
   */
  attachSearchListener() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }
  }

  /**
   * Handle department search input.
   * @param {string} query - Search query.
   */
  handleSearch(query) {
    const grid = document.getElementById('department-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.department-card');
    const lowerQuery = query.toLowerCase().trim();
    let visibleCount = 0;

    cards.forEach(card => {
      const deptName = card.dataset.department.toLowerCase();
      if (deptName.includes(lowerQuery)) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    this.updateSearchResults(visibleCount, lowerQuery);
  }

  /**
   * Update search results display (show/hide no-results message).
   * @param {number} visibleCount - Number of visible department cards.
   * @param {string} query - Current search query.
   */
  updateSearchResults(visibleCount, query) {
    let noResultsMsg = document.getElementById('no-results-msg');

    if (visibleCount === 0 && query.length > 0) {
      if (!noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.id = 'no-results-msg';
        noResultsMsg.className = 'no-results';
        noResultsMsg.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-search empty-state-icon"></i>
            <p class="empty-state-title">No departments found</p>
            <p class="meta-text">Try a different search term</p>
          </div>
        `;
        document.getElementById('department-grid').parentNode.appendChild(noResultsMsg);
      }
      noResultsMsg.style.display = 'block';
    } else {
      if (noResultsMsg) {
        noResultsMsg.style.display = 'none';
      }
    }
  }

  /**
   * Dismiss the announcement banner.
   */
  dismissAnnouncement() {
    const banner = document.querySelector('.announcement-banner');
    if (banner) {
      banner.style.display = 'none';
      localStorage.setItem('announcement_dismissed', Date.now());
    }
  }

  /**
   * Toggle dark mode.
   */
  toggleDarkMode() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  /**
   * Open the contact modal.
   */
  openContactModal() {
    const modal = document.getElementById('contact-modal');
    contactModalHelper.open(modal);
  }

  /**
   * Close the contact modal.
   */
  closeContactModal() {
    const modal = document.getElementById('contact-modal');
    contactModalHelper.close(modal);
  }

  /**
   * Show a toast notification.
   * @param {string} message - Message text.
   * @param {string} type - 'info', 'success', 'warning', or 'error'.
   */
  showToast(message, type = 'info') {
    notificationHelper.showToast(message, type);
  }

  /**
   * Show a notification banner.
   * @param {string} message - Message text.
   * @param {string} type - 'info', 'success', 'warning', or 'error'.
   */
  showNotification(message, type = 'info') {
    notificationHelper.showNotification(message, type);
  }

  /**
   * Handle PWA install (delegates to PWAManager).
   */
  installApp() {
    pwaManager.installApp();
  }

  /**
   * Item #14: Setup offline/online detection.
   * Shows a non-intrusive banner when the network drops
   * and auto-recovers when connectivity returns.
   */
  setupOfflineDetection() {
    const showOfflineBanner = () => {
      if (document.getElementById('offline-banner')) return;

      const banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.className = 'notification notification-warning';
      banner.setAttribute('role', 'alert');
      banner.innerHTML = `
        <div class="notification-content">
          <span class="notification-message">
            <i class="fas fa-wifi" style="margin-right: 6px;"></i>
            You're offline. Cached content is still available.
          </span>
        </div>
      `;
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;border-radius:0;';
      document.body.prepend(banner);
    };

    const hideOfflineBanner = () => {
      const banner = document.getElementById('offline-banner');
      if (banner) {
        banner.remove();
        this.showToast('Back online!', 'success');
      }
    };

    window.addEventListener('offline', showOfflineBanner);
    window.addEventListener('online', hideOfflineBanner);

    // Check on init
    if (!navigator.onLine) {
      showOfflineBanner();
    }
  }
}

// Create global app instance
const app = new App();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// Export for use in tests/Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { App, app };
}
