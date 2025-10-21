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
        this.updateCacheStatus();
      } else {
        // No cache, must fetch from API
        await this.fetchData();
      }

      // Setup event listeners
      this.setupEventListeners();

      // Initialize navigator
      navigator.init(this.data);
      navigator.addListener(() => this.render());

    } catch (error) {
      console.error('App initialization failed:', error);
      this.showError(error);
    }
  }

  /**
   * Load configuration from environment or defaults
   */
  loadConfig() {
    // In production, these should come from environment variables
    // For now, they'll need to be set by the user in a config
    CONFIG.api.key = window.ENV?.GOOGLE_DRIVE_API_KEY || null;
    CONFIG.api.rootFolderId = window.ENV?.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;
  }

  /**
   * Fetch data from Google Drive API
   */
  async fetchData(forceRefresh = false) {
    if (this.loading) return;

    try {
      this.loading = true;
      this.showLoading();

      // Check if API credentials are configured
      if (!CONFIG.api.key || !CONFIG.api.rootFolderId) {
        throw new Error('API credentials not configured. Please check documentation.');
      }

      // Initialize Drive API
      await driveAPI.init(CONFIG.api.key, CONFIG.api.rootFolderId);

      // Fetch structure from Drive
      this.data = await driveAPI.fetchStructure();

      // Cache the data
      cacheManager.set(this.data);

      // Render the app
      this.render();
      this.updateCacheStatus();

      this.loading = false;
    } catch (error) {
      this.loading = false;
      console.error('Failed to fetch data:', error);
      
      // Try to use cached data as fallback
      const cachedData = cacheManager.get();
      if (cachedData) {
        this.data = cachedData;
        this.render();
        this.showToast('Using cached data. Could not connect to Drive.', 'warning');
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

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Back button
    document.addEventListener('click', (e) => {
      if (e.target.closest('.back-btn')) {
        e.preventDefault();
        navigator.goBack();
      }
    });

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
    const contactModal = document.getElementById('contact-modal');
    if (contactBtn && contactModal) {
      contactBtn.addEventListener('click', () => this.openContactModal());
      contactModal.querySelector('.modal-close')?.addEventListener('click', () => this.closeContactModal());
      contactModal.addEventListener('click', (e) => {
        if (e.target === contactModal) this.closeContactModal();
      });
    }
  }

  /**
   * Render the current view
   */
  render() {
    const route = navigator.getCurrentRoute();
    const mainContent = document.getElementById('main-content');
    
    if (!mainContent) return;

    // Update breadcrumbs
    this.renderBreadcrumbs();

    // Update title
    navigator.updateTitle();

    // Check if route is valid
    if (!navigator.isValidRoute()) {
      mainContent.innerHTML = this.renderNotFound();
      return;
    }

    // Render based on view
    switch (route.view) {
      case 'home':
        mainContent.innerHTML = this.renderHome();
        break;
      case 'department':
        mainContent.innerHTML = this.renderLevels();
        break;
      case 'level':
        mainContent.innerHTML = this.renderSemesters();
        break;
      case 'semester':
        mainContent.innerHTML = this.renderSessions();
        break;
      case 'session':
        mainContent.innerHTML = this.renderFiles();
        break;
      default:
        mainContent.innerHTML = this.renderNotFound();
    }

    // Show back button if not on home
    this.updateBackButton(route.view !== 'home');
  }

  /**
   * Render breadcrumbs
   */
  renderBreadcrumbs() {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer) return;

    const breadcrumbs = navigator.getBreadcrumbs();
    
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
          <span class="search-icon">🔍</span>
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
              ${this.getDepartmentIcon(dept)}
            </div>
            <div class="department-name">${dept}</div>
          </a>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render levels view
   */
  renderLevels() {
    const route = navigator.getCurrentRoute();
    const levels = navigator.getRouteData();
    
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
    const route = navigator.getCurrentRoute();
    const semesters = navigator.getRouteData();
    
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
    const route = navigator.getCurrentRoute();
    const sessions = navigator.getRouteData();
    
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
    const files = navigator.getRouteData();
    
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
            <div class="file-icon">PDF</div>
            <div class="file-info">
              <div class="file-name">${file.name}</div>
              <div class="file-meta">
                ${file.size ? driveAPI.formatFileSize(file.size) : ''} • 
                ${file.modifiedTime ? driveAPI.formatDate(file.modifiedTime) : ''}
              </div>
            </div>
            <div class="file-actions">
              <a href="${driveAPI.getViewLink(file)}" target="_blank" class="file-btn">View</a>
              <a href="${driveAPI.getDownloadLink(file)}" target="_blank" class="file-btn">Download</a>
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
        <div class="empty-state-icon">📂</div>
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
        <div class="empty-state-icon">❌</div>
        <h2 class="empty-state-title">Page Not Found</h2>
        <p class="empty-state-text">The page you're looking for doesn't exist.</p>
        <button onclick="navigator.goHome()" class="btn btn-primary">Go Home</button>
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
          <div class="empty-state-icon">⚠️</div>
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
   * Handle search input
   */
  handleSearch(query) {
    const grid = document.getElementById('department-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.department-card');
    const lowerQuery = query.toLowerCase().trim();

    cards.forEach(card => {
      const deptName = card.dataset.department.toLowerCase();
      if (deptName.includes(lowerQuery)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  /**
   * Update back button visibility
   */
  updateBackButton(show) {
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.style.display = show ? '' : 'none';
    }
  }

  /**
   * Update cache status display
   */
  updateCacheStatus() {
    const statusEl = document.getElementById('cache-status');
    if (!statusEl) return;

    const status = cacheManager.getStatus();
    const lastUpdated = cacheManager.getLastUpdated();

    if (lastUpdated) {
      statusEl.innerHTML = `
        <span class="status-badge cached">
          ${status.message}
        </span>
      `;
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
      'Accounting': '📊',
      'Architecture': '🏛️',
      'Biochemistry': '🧬',
      'Business Administration': '💼',
      'Computer Science': '💻',
      'Criminology': '⚖️',
      'Cybersecurity': '🔒',
      'Economics': '📈',
      'Human Anatomy': '🫀',
      'Human Physiology': '🧠',
      'Industrial Chemistry': '⚗️',
      'International Relations': '🌍',
      'Jupeb': '📚',
      'Law': '⚖️',
      'Mass Communication': '📺',
      'Microbiology': '🦠',
      'Nursing': '⚕️',
      'Political Science': '🏛️',
      'Psychology': '🧠',
      'Software Engineering': '⚙️'
    };
    return icons[dept] || '📁';
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

