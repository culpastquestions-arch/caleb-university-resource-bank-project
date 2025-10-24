// Main Application Logic
class App {
  constructor() {
    this.data = null;
    this.loading = false;
    this.error = null;
    this.deferredPrompt = null;
    this.isInstalled = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Show loading state
      this.showLoading();

      // Check for environment variables
      this.loadConfig();

      // Setup PWA features early
      this.setupPWAFeatures();

      // Try to load from cache first
      const cachedData = cacheManager.get();
      
      if (cachedData) {
        this.data = cachedData;
        this.render();
      } else {
        // No cache, must fetch from API
        await this.fetchData();
      }

      // Setup event listeners
      this.setupEventListeners();

      // Initialize navigator
      appNavigator.init(this.data);
      appNavigator.addListener(() => this.render());


    } catch (error) {
      console.error('App initialization failed:', error);
      this.showError(error);
    }
  }

  /**
   * Load configuration from environment or defaults
   */
  loadConfig() {
    // API endpoint for backend proxy
    CONFIG.api.endpoint = window.ENV?.API_ENDPOINT || '/api/drive';
  }

  /**
   * Fetch data from Google Drive API (via backend proxy)
   */
  async fetchData(forceRefresh = false) {
    if (this.loading) return;

    try {
      this.loading = true;
      this.showLoading();

      // Check if API endpoint is configured
      if (!CONFIG.api.endpoint) {
        throw new Error('API endpoint not configured. Please check documentation.');
      }

      // Initialize Drive API client
      await driveAPI.init(CONFIG.api.endpoint);

      // Fetch structure from backend proxy
      this.data = await driveAPI.fetchStructure();

      // Cache the data
      cacheManager.set(this.data);

      // Render the app
      this.render();

      this.loading = false;
    } catch (error) {
      this.loading = false;
      console.error('Failed to fetch data:', error);
      
      // Try to use cached data as fallback
      const cachedData = cacheManager.get();
      if (cachedData) {
        this.data = cachedData;
        this.render();
        this.showToast('Using cached data. Could not connect to server.', 'warning');
      } else {
        this.showError(error);
      }
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.handleRefresh());
    }

    // Search input will be attached dynamically when home view is rendered

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
   * Setup scroll listener for header styling
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
   * Render the current view
   */
  render() {
    const route = appNavigator.getCurrentRoute();
    const mainContent = document.getElementById('main-content');
    
    if (!mainContent) return;

    // Update breadcrumbs
    this.renderBreadcrumbs();

    // Update title
    appNavigator.updateTitle();

    // Check if route is valid
    if (!appNavigator.isValidRoute()) {
      mainContent.innerHTML = this.renderNotFound();
      return;
    }

    // Render based on view
    switch (route.view) {
      case 'home':
        mainContent.innerHTML = this.renderHome();
        // Reattach search event listener for home view
        this.attachSearchListener();
        // Ensure Font Awesome icons are properly rendered
        this.ensureFontAwesomeIcons();
        break;
      case 'levels':
        mainContent.innerHTML = this.renderLevels();
        this.ensureFontAwesomeIcons();
        break;
      case 'semesters':
        mainContent.innerHTML = this.renderSemesters();
        this.ensureFontAwesomeIcons();
        break;
      case 'sessions':
        mainContent.innerHTML = this.renderSessions();
        this.ensureFontAwesomeIcons();
        break;
      case 'files':
        mainContent.innerHTML = this.renderFiles();
        this.ensureFontAwesomeIcons();
        break;
      default:
        mainContent.innerHTML = this.renderNotFound();
    }

  }

  /**
   * Render breadcrumbs
   */
  renderBreadcrumbs() {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer) return;

    const breadcrumbs = appNavigator.getBreadcrumbs();
    
    breadcrumbContainer.innerHTML = breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      const crumbHTML = isLast || crumb.active
        ? `<span class="breadcrumb-item active">${crumb.label}</span>`
        : `<a href="#${crumb.path}" class="breadcrumb-item">${crumb.label}</a>`;
      
      const separator = isLast ? '' : '<span class="breadcrumb-separator">›</span>';
      return crumbHTML + separator;
    }).join('');
  }

  /**
   * Render home view (departments)
   */
  renderHome() {
    const departments = CONFIG.departments;
    
    return `
      <div class="search-container">
        <div class="search-box">
          <span class="search-icon"><i class="fas fa-search"></i></span>
          <input 
            type="text" 
            id="search-input" 
            class="search-input" 
            placeholder="Search departments..."
            aria-label="Search departments"
          />
        </div>
      </div>

      <div class="department-grid" id="department-grid">
        ${departments.map(dept => `
          <a href="#/${encodeURIComponent(dept)}" class="department-card" data-department="${dept}">
            <div class="department-icon" style="background-color: ${getDepartmentColor(dept)}">
              <i class="${this.getDepartmentIcon(dept)}"></i>
            </div>
            <div class="department-name">${dept}</div>
          </a>
        `).join('')}
        
      </div>
    `;
  }

  /**
   * Ensure Font Awesome icons are properly rendered
   */
  ensureFontAwesomeIcons() {
    // Use setTimeout to ensure DOM is fully updated
    setTimeout(() => {
      // Check if Font Awesome CSS is loaded
      const fontAwesomeLoaded = document.querySelector('link[href*="fontawesome"]') || 
                                document.querySelector('link[href*="font-awesome"]');
      
      if (!fontAwesomeLoaded) {
        console.warn('Font Awesome CSS not found, icons may not display properly');
        return;
      }

      const icons = document.querySelectorAll('.department-icon i, .search-icon i, .empty-state-icon i');
      icons.forEach(icon => {
        // Force re-render by temporarily removing and re-adding the class
        const className = icon.className;
        icon.className = '';
        // Use requestAnimationFrame to ensure the change is processed
        requestAnimationFrame(() => {
          icon.className = className;
        });
      });
    }, 50); // Increased timeout to ensure Font Awesome is loaded
  }

  /**
   * Render levels view
   */
  renderLevels() {
    const route = appNavigator.getCurrentRoute();
    const levels = appNavigator.getRouteData();
    
    // If data is not loaded yet, show loading state
    if (!this.data) {
      const loadingText = route.department === 'Jupeb' ? 'subjects' : 'levels';
      return `
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading ${route.department} ${loadingText}...</p>
        </div>
      `;
    }
    
    // Special handling for Jupeb - it has subjects instead of levels
    if (route.department === 'Jupeb') {
      if (!levels || levels.length === 0) {
        return this.renderEmptyState('No subjects available', 'Check back later for updates');
      }

      return `
        <div class="level-grid">
          ${levels.map(level => `
            <a href="#/${encodeURIComponent(route.department)}/${encodeURIComponent(level)}" 
               class="level-card">
              <div class="level-icon">
                <i class="fas fa-book"></i>
              </div>
              <h3>${level}</h3>
            </a>
          `).join('')}
        </div>
      `;
    }
    
    // Standard handling for other departments
    if (!levels || levels.length === 0) {
      return this.renderEmptyState('No levels available', 'Check back later for updates');
    }

    return `
      <div class="level-grid">
        ${levels.map(level => `
          <a href="#/${encodeURIComponent(route.department)}/${encodeURIComponent(level)}" 
             class="level-card">
            <div class="level-number">${level.match(/\d+/)[0]}</div>
            <div class="level-label">Level</div>
          </a>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render semesters view
   */
  renderSemesters() {
    const route = appNavigator.getCurrentRoute();
    const semesters = appNavigator.getRouteData();
    
    // If data is not loaded yet, show loading state
    if (!this.data) {
      return `
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading ${route.level} semesters...</p>
        </div>
      `;
    }
    
    if (!semesters || semesters.length === 0) {
      return this.renderEmptyState('No semesters available', 'Check back later for updates');
    }

    return `
      <div class="semester-grid">
        ${semesters.map(semester => `
          <a href="#/${encodeURIComponent(route.department)}/${encodeURIComponent(route.level)}/${encodeURIComponent(semester)}" 
             class="semester-card">
            <div class="semester-name">${semester}</div>
          </a>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render sessions view
   */
  renderSessions() {
    const route = appNavigator.getCurrentRoute();
    const sessions = appNavigator.getRouteData();
    
    // If data is not loaded yet, show loading state
    if (!this.data) {
      return `
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading ${route.semester} sessions...</p>
        </div>
      `;
    }
    
    if (!sessions || sessions.length === 0) {
      return this.renderEmptyState('No sessions available', 'Check back later for updates');
    }

    return `
      <div class="semester-grid">
        ${sessions.map(session => `
          <a href="#/${encodeURIComponent(route.department)}/${encodeURIComponent(route.level)}/${encodeURIComponent(route.semester)}/${encodeURIComponent(session)}" 
             class="semester-card">
            <div class="semester-name">${session}</div>
          </a>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render files view
   */
  renderFiles() {
    const files = appNavigator.getRouteData();
    
    // If data is not loaded yet, show loading state
    if (!this.data) {
      return `
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading files...</p>
        </div>
      `;
    }
    
    if (!files || files.length === 0) {
      return this.renderEmptyState(
        'No files available yet', 
        'Files will be added soon. Check back later or contact us if you have materials to share.'
      );
    }

    return `
      <div class="file-list">
        ${files.map(file => `
          <div class="file-item">
            <div class="file-icon"><i class="fas fa-file-pdf"></i></div>
            <div class="file-info">
              <div class="file-name">${file.name}</div>
              <div class="file-meta">
                ${file.size ? driveAPI.formatFileSize(file.size) : ''} • 
                ${file.modifiedTime ? driveAPI.formatDate(file.modifiedTime) : ''}
            </div>
            <div class="file-actions">
              <a href="${driveAPI.getViewLink(file)}" target="_blank" class="file-btn">View</a>
              <a href="${driveAPI.getDownloadLink(file)}" target="_blank" class="file-btn">Download</a>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render empty state
   */
  renderEmptyState(title, message) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fas fa-folder-open"></i></div>
        <h2 class="empty-state-title">${title}</h2>
        <p class="empty-state-text">${message}</p>
        <button onclick="app.handleRefresh()" class="btn btn-primary">Refresh Content</button>
      </div>
    `;
  }

  /**
   * Render 404 not found
   */
  renderNotFound() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <h2 class="empty-state-title">Page Not Found</h2>
        <p class="empty-state-text">The page you're looking for doesn't exist.</p>
        <button onclick="appNavigator.goHome()" class="btn btn-primary">Go Home</button>
      </div>
    `;
  }

  /**
   * Show loading state
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
   * Show error state
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
   * Handle refresh button click
   */
  async handleRefresh() {
    await this.fetchData(true);
    this.showToast('Content refreshed successfully!', 'success');
  }

  /**
   * Attach search event listener (called when home view is rendered)
   */
  attachSearchListener() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }
  }

  /**
   * Handle search input
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

    // Show/hide no results message
    this.updateSearchResults(visibleCount, lowerQuery);
  }

  /**
   * Update search results display
   */
  updateSearchResults(visibleCount, query) {
    let noResultsMsg = document.getElementById('no-results-msg');
    
    if (visibleCount === 0 && query.length > 0) {
      // Show no results message
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
      // Hide no results message
      if (noResultsMsg) {
        noResultsMsg.style.display = 'none';
      }
    }
  }



  /**
   * Toggle quick start guide
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
   * Dismiss announcement
   */
  dismissAnnouncement() {
    const banner = document.querySelector('.announcement-banner');
    if (banner) {
      banner.style.display = 'none';
      localStorage.setItem('announcement_dismissed', Date.now());
    }
  }

  /**
   * Toggle dark mode
   */
  toggleDarkMode() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  /**
   * Open contact modal
   */
  openContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
      modal.classList.add('open');
    }
  }

  /**
   * Close contact modal
   */
  closeContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
      modal.classList.remove('open');
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Simple toast - could be enhanced
    alert(message);
  }

  /**
   * Get icon for department
   */
  getDepartmentIcon(dept) {
    const icons = {
      'Accounting': 'fas fa-chart-line',
      'Architecture': 'fas fa-building',
      'Biochemistry': 'fas fa-dna',
      'Business Administration': 'fas fa-briefcase',
      'Computer Science': 'fas fa-laptop-code',
      'Criminology': 'fas fa-gavel',
      'Cybersecurity': 'fas fa-shield-alt',
      'Economics': 'fas fa-chart-bar',
      'Human Anatomy': 'fas fa-heartbeat',
      'Human Physiology': 'fas fa-brain',
      'Industrial Chemistry': 'fas fa-flask',
      'International Relations': 'fas fa-globe',
      'Jupeb': 'fas fa-graduation-cap',
      'Law': 'fas fa-balance-scale',
      'Mass Communication': 'fas fa-tv',
      'Microbiology': 'fas fa-microscope',
      'Nursing': 'fas fa-user-md',
      'Political Science': 'fas fa-landmark',
      'Psychology': 'fas fa-brain',
      'Software Engineering': 'fas fa-cogs'
    };
    return icons[dept] || 'fas fa-folder';
  }

  /**
   * Setup PWA features
   */
  setupPWAFeatures() {
    // Check if app is already installed
    this.checkInstallStatus();
    
    // Track user engagement to trigger install prompt
    this.trackUserEngagement();
    
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Show install button after a delay (fallback for when beforeinstallprompt doesn't fire)
    setTimeout(() => {
      if (!this.isInstalled) {
        this.showInstallButton();
      }
    }, 2000);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.hideInstallButton();
      this.showInstallSuccessMessage();
    });

    // Check if install prompt is available after page load
    setTimeout(() => {
      if (!this.isInstalled && !this.deferredPrompt) {
        this.showInstallButton();
      }
    }, 5000);

    // Service worker updates handled automatically
  }

  /**
   * Track user engagement to trigger install prompt
   */
  trackUserEngagement() {
    let engagementScore = 0;
    
    // Track clicks
    document.addEventListener('click', () => {
      engagementScore += 1;
    });
    
    // Track scroll
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        engagementScore += 1;
      }, 1000);
    });
    
    // Track time on page
    setTimeout(() => {
      engagementScore += 5;
    }, 30000); // 30 seconds
    
    // Try to trigger install prompt after engagement
    setTimeout(() => {
      if (engagementScore >= 3 && !this.deferredPrompt && !this.isInstalled) {
        this.triggerInstallPrompt();
      }
    }, 10000);
  }

  /**
   * Try to trigger install prompt
   */
  triggerInstallPrompt() {
    // Try to reload the page to trigger beforeinstallprompt
    window.location.reload();
  }


  /**
   * Check if app is already installed
   */
  checkInstallStatus() {
    // Check if running in standalone mode (installed)
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
      this.isInstalled = true;
    }
  }

  /**
   * Show install button
   */
  showInstallButton() {
    if (this.isInstalled) return;

    const installButton = document.getElementById('install-button');
    if (installButton) {
      installButton.style.display = 'block';
    }
  }


  /**
   * Hide install button
   */
  hideInstallButton() {
    const installButton = document.getElementById('install-button');
    if (installButton) {
      installButton.style.display = 'none';
    }
  }

  /**
   * Handle install button click
   */
  async installApp() {
    if (this.deferredPrompt) {
      try {
        // Show the automatic install prompt
        this.deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;

        // Clear the deferredPrompt
        this.deferredPrompt = null;

        if (outcome === 'accepted') {
          this.isInstalled = true;
          this.hideInstallButton();
        }
      } catch (error) {
        this.showNativeInstallOption();
      }
    } else {
      // Try to trigger install prompt first
      this.triggerInstallPrompt();
    }
  }

  /**
   * Show native install option
   */
  showNativeInstallOption() {
    const isChrome = navigator.userAgent.includes('Chrome');
    const isEdge = navigator.userAgent.includes('Edg');
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    let message = '';
    
    if (isMobile) {
      if (isChrome || isEdge) {
        message = 'To install CURB:\n\n1. Tap the menu button (⋮) in your browser\n2. Look for "Install app" or "Add to Home screen"\n3. Tap it to install CURB';
      } else {
        message = 'To install CURB:\n\n1. Tap the share button in your browser\n2. Look for "Add to Home Screen"\n3. Tap it to install CURB';
      }
    } else {
      if (isChrome || isEdge) {
        message = 'To install CURB:\n\n1. Look for the install icon (⬇) in your browser address bar\n2. Click it to install CURB\n\nOr:\n1. Click the menu button (⋮) in your browser\n2. Look for "Install CURB" and click it';
      } else {
        message = 'To install CURB:\n\n1. Look for the install icon in your browser address bar\n2. Click it to install CURB';
      }
    }
    
    // Show a modal instead of alert for better UX
    this.showInstallModal(message);
  }

  /**
   * Show install modal with instructions
   */
  showInstallModal(message) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 8px;
      max-width: 400px;
      margin: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    modal.innerHTML = `
      <h3 style="margin-top: 0; color: var(--primary-green);">Install CURB</h3>
      <p style="white-space: pre-line; line-height: 1.6;">${message}</p>
      <button onclick="this.closest('.install-modal').remove()" style="
        background: var(--primary-green);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 1rem;
      ">Got it</button>
    `;

    overlay.className = 'install-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  /**
   * Check if PWA meets installation criteria
   */
  checkPWACriteria() {
    const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
    const hasServiceWorker = 'serviceWorker' in navigator;
    const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
    const hasIcons = document.querySelector('link[rel="manifest"]') !== null;
    
    return hasManifest && hasServiceWorker && isHTTPS && hasIcons;
  }

  /**
   * Try to trigger install prompt manually
   */
  async triggerInstallPrompt() {
    try {
      // Show a brief message that we're trying to install
      this.showNotification('Preparing to install CURB...', 'info');
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      this.showInstallGuide();
    }
  }

  /**
   * Show install guide
   */
  showInstallGuide() {
    const isChrome = navigator.userAgent.includes('Chrome');
    const isEdge = navigator.userAgent.includes('Edg');
    const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let instructions = '';
    
    if (isChrome || isEdge) {
      if (isMobile) {
        instructions = `
          <h3>Install CURB on Mobile</h3>
          <ol>
            <li>Tap the <strong>menu button</strong> (⋮) in your browser</li>
            <li>Look for <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
            <li>Tap it to install CURB</li>
          </ol>
        `;
      } else {
        instructions = `
          <h3>Install CURB on Desktop</h3>
          <ol>
            <li>Look for the <strong>install icon</strong> (⊕) in your address bar</li>
            <li>Click the install icon</li>
            <li>Click <strong>"Install"</strong> in the popup</li>
          </ol>
          <p><em>If you don't see the install icon, try refreshing the page.</em></p>
        `;
      }
    } else if (isSafari && isMobile) {
      instructions = `
        <h3>Install CURB on iPhone/iPad</h3>
        <ol>
          <li>Tap the <strong>Share button</strong> (□↑) at the bottom</li>
          <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          <li>Tap <strong>"Add"</strong> to confirm</li>
        </ol>
      `;
    } else {
      instructions = `
        <h3>Install CURB</h3>
        <p>Look for an <strong>"Install"</strong> or <strong>"Add to Home Screen"</strong> option in your browser menu.</p>
      `;
    }

    const guide = document.createElement('div');
    guide.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 1001;
      max-width: 400px;
      width: 90%;
    `;
    
    guide.innerHTML = `
      ${instructions}
      <div style="text-align: center; margin-top: 20px;">
        <button onclick="this.closest('div').remove()" style="background: var(--primary-color); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Got it!</button>
      </div>
    `;

    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
    `;
    backdrop.onclick = () => {
      document.body.removeChild(backdrop);
      document.body.removeChild(guide);
    };

    document.body.appendChild(backdrop);
    document.body.appendChild(guide);
  }

  /**
   * Show install success message
   */
  showInstallSuccessMessage() {
    this.showNotification('CURB has been installed successfully!', 'success');
  }

  /**
   * Show notification
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

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
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

