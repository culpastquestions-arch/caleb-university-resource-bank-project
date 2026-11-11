// Main Application Logic (Orchestrator)
// Delegates rendering to Renderer, PWA features to PWAManager

/**
 * Main application class — orchestrates initialization, routing,
 * event handling, and delegates rendering/PWA to dedicated modules.
 */
class App {
  constructor() {
    /** @type {HTMLElement|null} The view element of the most recent navigation. */
    this.activeView = null;
  }

  /**
   * Initialize the application.
   */
  async init() {
    try {
      // Check version and clear cached data if needed
      this.checkVersionAndClearCache();

      // Setup PWA features
      pwaManager.setup();

      // Enforce email verification gate before accessing Drive API or routing
      if (typeof emailGate !== 'undefined' && !emailGate.isVerified()) {
        await emailGate.show();
      }

      // Initialize Drive API
      await driveAPI.init();

      // Setup event listeners
      this.setupEventListeners();

      // Initialize navigator
      appNavigator.init();
      appNavigator.addListener(() => this.handleRouteChange());

      // Render initial view
      await this.handleRouteChange();

    } catch (error) {
      console.error('App initialization failed:', error);
      this.showError(error);
    }
  }

  /**
   * Check app version and clear cached Drive listings if the version changed.
   */
  checkVersionAndClearCache() {
    const storedVersion = localStorage.getItem('app_version');
    const currentVersion = CONFIG.version;

    if (storedVersion !== currentVersion) {
      this.clearLocalCaches();
      localStorage.setItem('app_version', currentVersion);
    }
  }

  /**
   * Clear the localStorage data caches.
   * Cache Storage (app shell, assets, API responses) is owned by the service worker,
   * which removes its own outdated caches when a new version activates.
   */
  clearLocalCaches() {
    try {
      pathCache.clearAll();

      // Keys written by older versions of the app
      localStorage.removeItem('curb_data');
      localStorage.removeItem('curb_meta');
      localStorage.removeItem('curb_cache_meta');
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Handle route changes — dispatch to appropriate renderer.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   * @returns {Promise<boolean>} False when the view failed to render.
   */
  async handleRouteChange(options = {}) {
    const { forceRefresh = false } = options;
    const route = appNavigator.getCurrentRoute();
    const mainContent = document.getElementById('main-content');

    if (!mainContent) return false;

    // Each navigation renders into its own element. If the user navigates again
    // before a slow request finishes, the older render lands in an element that is
    // no longer on the page instead of overwriting the newer view.
    const view = document.createElement('div');
    view.className = 'route-view';
    mainContent.innerHTML = '';
    mainContent.appendChild(view);
    this.activeView = view;

    // Update breadcrumbs and title immediately
    renderer.renderBreadcrumbs();
    appNavigator.updateTitle();

    try {
      switch (route.view) {
        case 'home':
          await renderer.renderHome(view, { forceRefresh });
          if (this.activeView === view) {
            this.attachSearchListener();
          }
          break;
        case 'about':
          await renderer.renderAboutPage(view, { forceRefresh });
          break;
        case 'track':
          await renderer.renderCoverage(view, { forceRefresh });
          break;
        case 'levels':
          await renderer.renderLevels(view, route, { forceRefresh });
          break;
        case 'semesters':
          await renderer.renderSemesters(view, route, { forceRefresh });
          break;
        case 'sessions':
          await renderer.renderSessions(view, route, { forceRefresh });
          break;
        case 'session':
          await renderer.renderSessionContent(view, route, { forceRefresh });
          break;
        case 'files':
          await renderer.renderFiles(view, route, { forceRefresh });
          break;
        default:
          view.innerHTML = renderer.renderNotFound();
      }
      return true;
    } catch (error) {
      console.error('Error rendering view:', error);
      view.innerHTML = renderer.renderErrorState(error.message);
      return false;
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

    // Delegated clicks: announcement close + data-action buttons in rendered views
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

    // Install app
    const installButton = document.getElementById('install-button');
    const installLinkFooter = document.getElementById('install-link-footer');

    if (installButton) {
      installButton.addEventListener('click', () => pwaManager.installApp());
    }
    if (installLinkFooter) {
      installLinkFooter.addEventListener('click', (e) => {
        e.preventDefault();
        pwaManager.installApp();
      });
    }

    // Contact modal
    contactModalHelper.wire(document.getElementById('contact-modal'), [
      document.getElementById('contact-btn'),
      document.getElementById('contact-link-footer')
    ]);
  }

  /**
   * Setup scroll listener for header styling.
   */
  setupScrollListener() {
    let ticking = false;

    const updateHeader = () => {
      const header = document.querySelector('.app-header');
      if (header) {
        header.classList.toggle('scrolled', window.scrollY > 50);
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

    // Home/About/Track routes have no department path; those invalidate the root cache.
    const segments = [route.department, route.level, route.semester, route.session, route.category]
      .filter(Boolean);
    pathCache.invalidatePath(`/${segments.join('/')}`);

    const rendered = await this.handleRouteChange({ forceRefresh: true });

    if (rendered === false) {
      this.showToast('Could not refresh content. Please try again.', 'error');
    } else {
      this.showToast('Content refreshed successfully!', 'success');
    }
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
    } else if (noResultsMsg) {
      noResultsMsg.style.display = 'none';
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
   * Show a toast notification.
   * @param {string} message - Message text.
   * @param {string} type - 'info', 'success', 'warning', or 'error'.
   */
  showToast(message, type = 'info') {
    notificationHelper.showToast(message, type);
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
