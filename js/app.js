// Main Application Logic
class App {
  constructor() {
    this.data = null;
    this.loading = false;
    this.error = null;
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
        break;
      case 'levels':
        mainContent.innerHTML = this.renderLevels();
        break;
      case 'semesters':
        mainContent.innerHTML = this.renderSemesters();
        break;
      case 'sessions':
        mainContent.innerHTML = this.renderSessions();
        break;
      case 'files':
        mainContent.innerHTML = this.renderFiles();
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
        
        <!-- Debug Test -->
        <div style="border: 2px solid blue; padding: 1rem; margin: 1rem; background: white;">
          <p>Debug Test:</p>
          <div style="background: #4CAF50; color: white; padding: 0.5rem; margin: 0.5rem 0;">
            <i class="fas fa-home"></i> Home Icon Test
          </div>
          <div style="background: #2196F3; color: white; padding: 0.5rem; margin: 0.5rem 0;">
            <i class="fas fa-user"></i> User Icon Test
          </div>
          <div style="background: #FF9800; color: white; padding: 0.5rem; margin: 0.5rem 0;">
            <i class="fas fa-star"></i> Star Icon Test
          </div>
          <p>If you see icons above, Font Awesome is working. If you see squares, it's not loading.</p>
        </div>
      </div>
    `;
  }

  /**
   * Render levels view
   */
  renderLevels() {
    const route = appNavigator.getCurrentRoute();
    const levels = appNavigator.getRouteData();
    
    // If data is not loaded yet, show loading state
    if (!this.data) {
      return `
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading ${route.department} levels...</p>
        </div>
      `;
    }
    
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
    if (content) {
      content.classList.toggle('open');
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
    const iconClass = icons[dept] || 'fas fa-folder';
    console.log(`Department: ${dept}, Icon Class: ${iconClass}`);
    return iconClass;
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

