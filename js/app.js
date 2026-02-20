// Main Application Logic (Orchestrator)
// Delegates rendering to Renderer, PWA features to PWAManager

/**
 * Main application class — orchestrates initialization, routing,
 * event handling, and delegates rendering/PWA to dedicated modules.
 */
class App {
  constructor() {
    this.loading = false;
    this.error = null;
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
      cacheManager.clear();
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Handle route changes — dispatch to appropriate renderer.
   */
  async handleRouteChange() {
    const route = appNavigator.getCurrentRoute();
    const mainContent = document.getElementById('main-content');

    if (!mainContent) return;

    // Update breadcrumbs and title immediately
    renderer.renderBreadcrumbs();
    appNavigator.updateTitle();

    try {
      switch (route.view) {
        case 'home':
          this.departments = await renderer.renderHome(mainContent);
          this.attachSearchListener();
          break;
        case 'about':
          await renderer.renderAboutPage(mainContent);
          break;
        case 'levels':
          await renderer.renderLevels(mainContent, route);
          break;
        case 'semesters':
          await renderer.renderSemesters(mainContent, route);
          break;
        case 'sessions':
          await renderer.renderSessions(mainContent, route);
          break;
        case 'files':
          await renderer.renderFiles(mainContent, route);
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

    // Quick start toggle
    const quickStartHeader = document.querySelector('.quick-start-header');
    if (quickStartHeader) {
      quickStartHeader.addEventListener('click', () => this.toggleQuickStart());
    }

    // Scroll detection for header styling
    this.setupScrollListener();

    // Announcement close
    document.addEventListener('click', (e) => {
      if (e.target.closest('.announcement-close')) {
        this.dismissAnnouncement();
      }
    });

    // Dark mode toggle
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (darkModeBtn) {
      darkModeBtn.addEventListener('click', () => this.toggleDarkMode());
    }

    // Contact modal
    const contactBtn = document.getElementById('contact-btn');
    const contactLink = document.getElementById('contact-link');
    const contactLinkFooter = document.getElementById('contact-link-footer');
    const contactModal = document.getElementById('contact-modal');
    if (contactBtn && contactModal) {
      contactBtn.addEventListener('click', () => this.openContactModal());
      contactModal.querySelector('.modal-close')?.addEventListener('click', () => this.closeContactModal());
      contactModal.addEventListener('click', (e) => {
        if (e.target === contactModal) this.closeContactModal();
      });
    }
    if (contactLink && contactModal) {
      contactLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openContactModal();
      });
    }
    if (contactLinkFooter && contactModal) {
      contactLinkFooter.addEventListener('click', (e) => {
        e.preventDefault();
        this.openContactModal();
      });
    }
  }

  /**
   * Setup scroll listener for header styling.
   */
  setupScrollListener() {
    let ticking = false;

    const updateHeader = () => {
      const header = document.querySelector('.header');
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
   * Show loading state.
   */
  showLoading() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading content...</p>
        </div>
      `;
    }
  }

  /**
   * Show error state.
   * @param {Error} error - The error object.
   */
  showError(error) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fas fa-exclamation-circle"></i></div>
          <h2 class="empty-state-title">Something went wrong</h2>
          <p class="empty-state-text">${error.message || 'An error occurred'}</p>
          <button onclick="app.init()" class="btn btn-primary">Try Again</button>
        </div>
      `;
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

    if (currentPath && pathCache) {
      pathCache.invalidatePath(currentPath);
    }

    await this.handleRouteChange();
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
            <div class="empty-state-icon"><i class="fas fa-search"></i></div>
            <h3 class="empty-state-title">No departments found</h3>
            <p class="empty-state-text">Try searching for a different term</p>
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
   * Toggle quick start guide visibility.
   */
  toggleQuickStart() {
    const content = document.querySelector('.quick-start-content');
    const header = document.querySelector('.quick-start-header');
    if (content && header) {
      content.classList.toggle('open');
      header.classList.toggle('open');
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
    if (modal) {
      modal.classList.add('open');
    }
  }

  /**
   * Close the contact modal.
   */
  closeContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
      modal.classList.remove('open');
    }
  }

  /**
   * Show a toast notification.
   * @param {string} message - Message text.
   * @param {string} type - 'info', 'success', 'warning', or 'error'.
   */
  showToast(message, type = 'info') {
    this.showNotification(message, type);
  }

  /**
   * Show a notification banner.
   * @param {string} message - Message text.
   * @param {string} type - 'info', 'success', 'warning', or 'error'.
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * Handle PWA install (delegates to PWAManager).
   */
  installApp() {
    pwaManager.installApp();
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
