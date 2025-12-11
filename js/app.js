// Main Application Logic (Lazy Loading Architecture)
class App {
  constructor() {
    this.loading = false;
    this.error = null;
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.installationInProgress = false;
    this.currentLoadingPath = null; // Track what's currently loading
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Check for environment variables
      this.loadConfig();

      // Check version and clear cache if needed
      this.checkVersionAndClearCache();

      // Setup PWA features early
      this.setupPWAFeatures();

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
   * Load configuration from environment or defaults
   */
  loadConfig() {
    // API endpoint for backend proxy (now uses browse endpoint)
    CONFIG.api.endpoint = window.ENV?.API_ENDPOINT || '/api/browse';
  }

  /**
   * Check app version and clear cache if version changed
   */
  checkVersionAndClearCache() {
    const storedVersion = localStorage.getItem('app_version');
    const currentVersion = CONFIG.version;

    if (storedVersion !== currentVersion) {
      // Version changed, clear all caches
      this.clearAllCaches();
      localStorage.setItem('app_version', currentVersion);
    }
  }

  /**
   * Clear all caches (service worker + localStorage)
   */
  async clearAllCaches() {
    try {
      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // Clear path-based cache
      pathCache.clearAll();
      
      // Clear legacy cache
      cacheManager.clear();
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Handle route changes - fetch data as needed
   */
  async handleRouteChange() {
    const route = appNavigator.getCurrentRoute();
    const mainContent = document.getElementById('main-content');
    
    if (!mainContent) return;

    // Update breadcrumbs immediately (hide for about page)
    this.renderBreadcrumbs();
    appNavigator.updateTitle();

    // Render based on view (async)
    try {
      switch (route.view) {
        case 'home':
          await this.renderHomeAsync(mainContent);
          break;
        case 'about':
          await this.renderAboutPageAsync(mainContent);
          break;
        case 'levels':
          await this.renderLevelsAsync(mainContent, route);
          break;
        case 'semesters':
          await this.renderSemestersAsync(mainContent, route);
          break;
        case 'sessions':
          await this.renderSessionsAsync(mainContent, route);
          break;
        case 'files':
          await this.renderFilesAsync(mainContent, route);
          break;
        default:
          mainContent.innerHTML = this.renderNotFound();
      }
    } catch (error) {
      console.error('Error rendering view:', error);
      mainContent.innerHTML = this.renderErrorState(error.message);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Refresh button - now refreshes current path
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
   * Render home view (departments) - fetches from Google Drive
   * @param {HTMLElement} container - Container element
   */
  async renderHomeAsync(container) {
    // Show skeleton while loading
    container.innerHTML = this.renderSkeleton('departments', 'Loading departments...');
    
    try {
      // Fetch departments from Google Drive root folder
      const departments = await driveAPI.fetchDepartments();
      
      // Store fetched departments for route validation
      this.departments = departments;
      
      if (!departments || departments.length === 0) {
        container.innerHTML = this.renderEmptyState('No departments available', 'Please check back later');
        return;
      }

      container.innerHTML = `
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
            <a href="#/${encodeSegment(dept)}" class="department-card" data-department="${dept}">
              <div class="department-icon" style="background-color: ${getDepartmentColor(dept)}">
                <i class="${this.getDepartmentIcon(dept)}"></i>
              </div>
              <div class="department-name">${dept}</div>
            </a>
          `).join('')}
        </div>
      `;
      
      this.attachSearchListener();
      this.ensureFontAwesomeIcons();
    } catch (error) {
      console.error('Failed to load departments:', error);
      container.innerHTML = this.renderErrorState('Failed to load departments. Please try again.');
    }
  }

  /**
   * Render skeleton loading UI
   * @param {string} type - Type of skeleton ('departments', 'levels', 'semesters', 'sessions', 'files')
   * @param {string} message - Loading message
   */
  renderSkeleton(type, message = 'Loading...') {
    const skeletonCount = type === 'files' ? 5 : (type === 'departments' ? 8 : 4);
    const gridClass = type === 'files' ? 'file-list' : 
                      (type === 'departments' ? 'department-grid' : 
                      (type === 'levels' ? 'level-grid' : 'semester-grid'));
    const itemClass = type === 'files' ? 'skeleton-file' : 
                      (type === 'departments' ? 'skeleton-department' : 'skeleton-card');
    
    return `
      <div class="skeleton-container">
        <p class="skeleton-message">${message}</p>
        <div class="${gridClass}">
          ${Array(skeletonCount).fill(0).map(() => `
            <div class="${itemClass} skeleton-loading">
              <div class="skeleton-content"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render levels view (async with lazy loading)
   * @param {HTMLElement} container - Container element
   * @param {Object} route - Current route
   */
  async renderLevelsAsync(container, route) {
    const path = `/${route.department}`;
    const loadingText = route.department === 'Jupeb' ? 'subjects' : 'levels';
    
    // Show skeleton immediately
    container.innerHTML = this.renderSkeleton('levels', `Loading ${displayName(route.department)} ${loadingText}...`);
    
    try {
      // Fetch levels for this department
      const levels = await driveAPI.fetchLevels(route.department);
      
      if (!levels || levels.length === 0) {
        container.innerHTML = this.renderEmptyState(`No ${loadingText} available`, 'Check back later for updates');
        return;
      }

      // Special handling for Jupeb
      if (route.department === 'Jupeb') {
        container.innerHTML = `
          <div class="level-grid">
            ${levels.map(level => `
              <a href="#/${encodeSegment(route.department)}/${encodeSegment(level)}" 
                 class="level-card">
                <div class="level-icon">
                  <i class="fas fa-book"></i>
                </div>
                <h3>${level}</h3>
              </a>
            `).join('')}
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="level-grid">
            ${levels.map(level => `
              <a href="#/${encodeSegment(route.department)}/${encodeSegment(level)}" 
                 class="level-card">
                <div class="level-number">${level.match(/\d+/)?.[0] || level}</div>
                <div class="level-label">Level</div>
              </a>
            `).join('')}
          </div>
        `;
      }
      
      this.ensureFontAwesomeIcons();
    } catch (error) {
      console.error('Failed to load levels:', error);
      container.innerHTML = this.renderErrorState(`Failed to load ${loadingText}. Please try again.`);
    }
  }

  /**
   * Render semesters view (async with lazy loading)
   * @param {HTMLElement} container - Container element
   * @param {Object} route - Current route
   */
  async renderSemestersAsync(container, route) {
    // Show skeleton immediately
    container.innerHTML = this.renderSkeleton('semesters', `Loading ${displayName(route.level)} semesters...`);
    
    try {
      // Fetch semesters for this level
      const semesters = await driveAPI.fetchSemesters(route.department, route.level);
      
      if (!semesters || semesters.length === 0) {
        container.innerHTML = this.renderEmptyState('No semesters available', 'Check back later for updates');
        return;
      }

      container.innerHTML = `
        <div class="semester-grid">
          ${semesters.map(semester => `
            <a href="#/${encodeSegment(route.department)}/${encodeSegment(route.level)}/${encodeSegment(semester)}" 
               class="semester-card">
              <div class="semester-name">${semester}</div>
            </a>
          `).join('')}
        </div>
      `;
      
      this.ensureFontAwesomeIcons();
    } catch (error) {
      console.error('Failed to load semesters:', error);
      container.innerHTML = this.renderErrorState('Failed to load semesters. Please try again.');
    }
  }

  /**
   * Render sessions view (async with lazy loading)
   * @param {HTMLElement} container - Container element
   * @param {Object} route - Current route
   */
  async renderSessionsAsync(container, route) {
    const isJupeb = route.department === 'Jupeb';
    const loadingMsg = isJupeb ? `Loading ${displayName(route.level)} sessions...` : `Loading ${displayName(route.semester)} sessions...`;
    
    // Show skeleton immediately
    container.innerHTML = this.renderSkeleton('sessions', loadingMsg);
    
    try {
      let sessions;
      
      if (isJupeb) {
        // Jupeb: Subject → Session (no semester)
        sessions = await driveAPI.fetchSemesters(route.department, route.level);
      } else {
        // Standard: Level → Semester → Session
        sessions = await driveAPI.fetchSessions(route.department, route.level, route.semester);
      }
      
      if (!sessions || sessions.length === 0) {
        container.innerHTML = this.renderEmptyState('No sessions available', 'Check back later for updates');
        return;
      }

      if (isJupeb) {
        container.innerHTML = `
          <div class="semester-grid">
            ${sessions.map(session => `
              <a href="#/${encodeSegment(route.department)}/${encodeSegment(route.level)}/${encodeSegment(session)}" 
                 class="semester-card">
                <div class="semester-name">${session}</div>
              </a>
            `).join('')}
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="semester-grid">
            ${sessions.map(session => `
              <a href="#/${encodeSegment(route.department)}/${encodeSegment(route.level)}/${encodeSegment(route.semester)}/${encodeSegment(session)}" 
                 class="semester-card">
                <div class="semester-name">${session}</div>
              </a>
            `).join('')}
          </div>
        `;
      }
      
      this.ensureFontAwesomeIcons();
    } catch (error) {
      console.error('Failed to load sessions:', error);
      container.innerHTML = this.renderErrorState('Failed to load sessions. Please try again.');
    }
  }

  /**
   * Render files view (async with lazy loading)
   * @param {HTMLElement} container - Container element
   * @param {Object} route - Current route
   */
  async renderFilesAsync(container, route) {
    // Show skeleton immediately
    container.innerHTML = this.renderSkeleton('files', 'Loading files...');
    
    try {
      let files;
      const isJupeb = route.department === 'Jupeb';
      
      if (isJupeb) {
        // Jupeb: Subject → Session → Files
        const path = `/${route.department}/${route.level}/${route.session}`;
        files = await driveAPI.fetchFiles(path);
      } else {
        // Standard: Level → Semester → Session → Files
        const path = `/${route.department}/${route.level}/${route.semester}/${route.session}`;
        files = await driveAPI.fetchFiles(path);
      }
      
      if (!files || files.length === 0) {
        // Check if this is 1st semester 2024/2025 (route.session has ~ substitution)
        const isFirstSemester2024_2025 = route.semester === '1st Semester' && route.session === '2024~25 Session';
        
        if (isFirstSemester2024_2025) {
          container.innerHTML = this.renderEmptyState(
            'No files available for 1st Semester 2024/2025',
            'Files are available from 2nd semester 2024/2025 onwards.'
          );
        } else {
          container.innerHTML = this.renderEmptyState(
            'No files available yet', 
            'Files will be added soon. Check back later or contact us if you have materials to share.'
          );
        }
        return;
      }

      container.innerHTML = `
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
      
      this.ensureFontAwesomeIcons();
    } catch (error) {
      console.error('Failed to load files:', error);
      container.innerHTML = this.renderErrorState('Failed to load files. Please try again.');
    }
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
    }, 50);
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
   * Fetch team data from API or return fallback.
   * @returns {Promise<Object>} Team data with executives and departmentReps.
   */
  async fetchTeamData() {
    try {
      const response = await fetch(`${CONFIG.apiBase}/team`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.executives && data.departmentReps) {
        return {
          executives: data.executives,
          departmentReps: data.departmentReps,
          fromApi: true
        };
      }
      
      throw new Error('Invalid API response');
    } catch (error) {
      console.warn('Failed to fetch team data from API, using fallback:', error.message);
      // Return fallback data from config
      return {
        executives: CONFIG.about.executives,
        departmentReps: CONFIG.about.departmentReps,
        fromApi: false
      };
    }
  }

  /**
   * Render the About Us page with mission, vision, and team information.
   * Fetches team data from API, falls back to config if unavailable.
   * @param {HTMLElement} container - The main content container to render into.
   * @returns {Promise<void>}
   */
  async renderAboutPageAsync(container) {
    const about = CONFIG.about;
    
    // Show loading skeleton while fetching
    container.innerHTML = this.renderAboutSkeleton();
    
    // Fetch team data from API
    const teamData = await this.fetchTeamData();
    
    // Default colors for different roles
    const roleColors = {
      founder: '#0F9D58',
      executive: '#1E88E5',
      rep: '#26A69A'
    };
    
    /**
     * Generate initials from a person's name.
     * @param {string} name - Full name of the person.
     * @returns {string} Initials (max 2 characters).
     */
    const getInitials = (name) => {
      if (!name || name === 'TBD' || name === 'Coming Soon') return '?';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };
    
    /**
     * Render a team member card with optional photo support.
     * @param {Object} member - Team member object.
     * @param {string} size - Card size: 'large', 'medium', or 'small'.
     * @param {string} defaultColor - Default avatar color.
     * @returns {string} HTML string for the card.
     */
    const renderTeamCard = (member, size = 'medium', defaultColor = roleColors.rep) => {
      const name = member.name || 'TBD';
      const initials = getInitials(name);
      const isPlaceholder = name === 'TBD' || name === 'Coming Soon';
      const cardClass = `team-card team-card--${size}${isPlaceholder ? ' team-card--placeholder' : ''}`;
      
      // Generate role from department if not provided (for department reps)
      const role = member.role || `${member.department} Representative`;
      const color = member.color || defaultColor;
      const photoUrl = member.photoUrl || member.photourl || '';
      
      // Avatar: use photo if available, otherwise initials
      const avatarContent = photoUrl 
        ? `<img src="${photoUrl}" alt="${name}" class="team-card__photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <span class="team-card__initials" style="display:none;">${initials}</span>`
        : `<span class="team-card__initials">${initials}</span>`;
      
      return `
        <div class="${cardClass}">
          <div class="team-card__avatar" style="background-color: ${color}">
            ${avatarContent}
          </div>
          <div class="team-card__info">
            <h3 class="team-card__name">${isPlaceholder ? 'Coming Soon' : name}</h3>
            <p class="team-card__role">${role}</p>
          </div>
        </div>
      `;
    };
    
    // Separate founder from executives (founder is first with order=1 or role contains 'Founder')
    let founder = teamData.executives.find(e => 
      e.role && e.role.toLowerCase().includes('founder')
    );
    
    // If no founder found in API, use fallback
    if (!founder) {
      founder = about.founder;
    }
    
    // Filter out founder from executives list
    const executives = teamData.executives.filter(e => 
      !e.role || !e.role.toLowerCase().includes('founder')
    );
    
    // Build the About page HTML
    const html = `
      <div class="about-page">
        <!-- Back Navigation -->
        <div class="about-back">
          <a href="#/" class="about-back__link">
            <i class="fas fa-arrow-left"></i>
            <span>Back to Home</span>
          </a>
        </div>
        
        <!-- Mission Section -->
        <section class="about-section about-section--mission">
          <div class="about-mission">
            <div class="about-mission__item about-mission__item--full">
              <div class="about-mission__icon">
                <i class="fas fa-bullseye"></i>
              </div>
              <h2 class="about-mission__title">Our Mission</h2>
              <p class="about-mission__text">${about.mission}</p>
            </div>
          </div>
        </section>
        
        <!-- Founder Section -->
        <section class="about-section about-section--founder">
          <h2 class="about-section__title">
            <i class="fas fa-star"></i>
            Founder
          </h2>
          <div class="about-founder">
            ${renderTeamCard(founder, 'large', roleColors.founder)}
          </div>
        </section>
        
        <!-- Executive Team Section -->
        <section class="about-section about-section--executives">
          <h2 class="about-section__title">
            <i class="fas fa-users-cog"></i>
            Executive Team
          </h2>
          <div class="about-team-grid about-team-grid--executives">
            ${executives.map(exec => renderTeamCard(exec, 'medium', roleColors.executive)).join('')}
          </div>
        </section>
        
        <!-- Department Representatives Section -->
        <section class="about-section about-section--reps">
          <h2 class="about-section__title">
            <i class="fas fa-user-friends"></i>
            Department Representatives
          </h2>
          <div class="about-team-grid about-team-grid--reps">
            ${teamData.departmentReps.map(rep => renderTeamCard(rep, 'small', roleColors.rep)).join('')}
          </div>
        </section>
        
        <!-- Join the Team CTA Section -->
        <section class="about-section about-section--cta">
          <div class="about-cta">
            <div class="about-cta__icon">
              <i class="fas fa-hand-holding-heart"></i>
            </div>
            <h2 class="about-cta__title">Join the Team</h2>
            <p class="about-cta__text">
              Interested in contributing to CURB and helping students access quality academic resources? 
              We're always looking for passionate individuals to join our growing team.
            </p>
            <p class="about-cta__contact">
              <i class="fas fa-envelope"></i>
              Contact us if you'd like to get involved!
            </p>
          </div>
        </section>
      </div>
    `;
    
    container.innerHTML = html;
  }

  /**
   * Render skeleton loading state for About page.
   * @returns {string} HTML string for skeleton.
   */
  renderAboutSkeleton() {
    return `
      <div class="about-page">
        <section class="about-section about-section--mission">
          <div class="about-mission">
            <div class="about-mission__item skeleton-loading">
              <div class="skeleton-content" style="width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 1rem;"></div>
              <div class="skeleton-content" style="width: 150px; height: 24px; margin: 0 auto 0.5rem;"></div>
              <div class="skeleton-content" style="width: 100%; height: 60px;"></div>
            </div>
            <div class="about-mission__item skeleton-loading">
              <div class="skeleton-content" style="width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 1rem;"></div>
              <div class="skeleton-content" style="width: 150px; height: 24px; margin: 0 auto 0.5rem;"></div>
              <div class="skeleton-content" style="width: 100%; height: 60px;"></div>
            </div>
          </div>
        </section>
        <section class="about-section">
          <div class="skeleton-content" style="width: 120px; height: 28px; margin-bottom: 1.5rem;"></div>
          <div class="skeleton-loading" style="width: 200px; height: 180px; border-radius: 12px; margin: 0 auto;"></div>
        </section>
        <section class="about-section">
          <div class="skeleton-content" style="width: 180px; height: 28px; margin-bottom: 1.5rem;"></div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem;">
            ${Array(5).fill('<div class="skeleton-loading" style="height: 140px; border-radius: 12px;"></div>').join('')}
          </div>
        </section>
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
   * Render error state HTML for inline display.
   * @param {string} message - Error message to display.
   * @returns {string} HTML string for error state.
   */
  renderErrorState(message) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fas fa-exclamation-circle"></i></div>
        <h2 class="empty-state-title">Something went wrong</h2>
        <p class="empty-state-text">${message || 'An error occurred'}</p>
        <button onclick="app.handleRefresh()" class="btn btn-primary">Try Again</button>
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
   * Handle refresh button click - refreshes current path
   */
  async handleRefresh() {
    const route = appNavigator.getCurrentRoute();
    const mainContent = document.getElementById('main-content');
    
    if (!mainContent) return;
    
    // Build the current path for cache invalidation
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
    
    // Force refresh by invalidating cache and re-fetching
    if (currentPath && pathCache) {
      // Clear the cache for the current path (force re-fetch)
      pathCache.invalidatePath(currentPath);
    }
    
    // Re-render the current view (will fetch fresh data)
    await this.handleRouteChange();
    
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
   * @param {string} message - The message to display
   * @param {string} type - The notification type: 'info', 'success', 'warning', 'error'
   */
  showToast(message, type = 'info') {
    this.showNotification(message, type);
  }

  /**
   * Get icon for department
   * Existing departments have custom icons, new ones get a fallback
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
    
    // Check exact match first
    if (icons[dept]) return icons[dept];
    
    // Try keyword matching for new departments
    const deptLower = dept.toLowerCase();
    if (deptLower.includes('computer') || deptLower.includes('software') || deptLower.includes('tech')) return 'fas fa-laptop-code';
    if (deptLower.includes('business') || deptLower.includes('management') || deptLower.includes('admin')) return 'fas fa-briefcase';
    if (deptLower.includes('law') || deptLower.includes('legal')) return 'fas fa-balance-scale';
    if (deptLower.includes('medicine') || deptLower.includes('medical') || deptLower.includes('health')) return 'fas fa-heartbeat';
    if (deptLower.includes('engineering')) return 'fas fa-cogs';
    if (deptLower.includes('science')) return 'fas fa-flask';
    if (deptLower.includes('art') || deptLower.includes('design')) return 'fas fa-palette';
    if (deptLower.includes('education') || deptLower.includes('teaching')) return 'fas fa-chalkboard-teacher';
    if (deptLower.includes('communication') || deptLower.includes('media')) return 'fas fa-tv';
    if (deptLower.includes('finance') || deptLower.includes('accounting') || deptLower.includes('banking')) return 'fas fa-chart-line';
    
    // Default fallback
    return 'fas fa-graduation-cap';
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
      if (!this.isInstalled && this.installationInProgress) {
        this.isInstalled = true;
        this.installationInProgress = false;
        this.hideInstallButton();
        // Hide the current progress modal first
        this.hideInstallProgress();
        // Then show completion message
        this.showInstallProgress('Installation complete! CURB is now installed.', 'success');
      }
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

    // Show footer install link
    const installLinkFooter = document.getElementById('install-link-footer');
    if (installLinkFooter) {
      installLinkFooter.style.display = 'block';
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

    // Hide footer install link
    const installLinkFooter = document.getElementById('install-link-footer');
    if (installLinkFooter) {
      installLinkFooter.style.display = 'none';
    }
  }

  /**
   * Handle install button click
   */
  async installApp() {
    if (this.deferredPrompt) {
      try {
        // Show installation started message
        this.showInstallProgress('Starting installation...', 'info');
        
        // Show the automatic install prompt
        this.deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;

        // Clear the deferredPrompt
        this.deferredPrompt = null;

        if (outcome === 'accepted') {
          // Set installation in progress flag
          this.installationInProgress = true;
          
          // Hide the current "Starting installation..." modal
          this.hideInstallProgress();
          
          // Show installation in progress
          this.showInstallProgress('Installing CURB... Please wait', 'info');
          
          // Hide the install button
          this.hideInstallButton();
          
          // Set a fallback timeout in case appinstalled event doesn't fire
          setTimeout(() => {
            if (this.installationInProgress) {
              this.installationInProgress = false;
              this.hideInstallProgress();
              this.showInstallProgress('Installation may have completed. Please check your app drawer.', 'success');
            }
          }, 10000); // 10 second fallback
        } else {
          this.hideInstallProgress();
          this.showInstallProgress('Installation cancelled', 'warning');
        }
      } catch (error) {
        this.showInstallProgress('Installation failed. Please try again.', 'error');
        this.showNativeInstallOption();
      }
    } else {
      // Try to trigger install prompt first
      this.triggerInstallPrompt();
    }
  }

  /**
   * Show installation progress message
   */
  showInstallProgress(message, type = 'info') {
    // Create progress overlay
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
      z-index: 10001;
    `;

    // Create progress modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 8px;
      max-width: 400px;
      margin: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;

    // Set colors based on type
    let color = '#0F9D58'; // Default green
    if (type === 'error') color = '#dc3545';
    if (type === 'warning') color = '#ffc107';
    if (type === 'info') color = '#17a2b8';

    modal.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <div style="
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid ${color};
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        "></div>
        <h3 style="margin: 0; color: ${color};">${message}</h3>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;

    overlay.className = 'install-progress-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Auto-remove after 5 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 5000);
    }

    // Store reference for manual removal
    this.currentProgressModal = overlay;
  }

  /**
   * Hide installation progress
   */
  hideInstallProgress() {
    if (this.currentProgressModal) {
      this.currentProgressModal.remove();
      this.currentProgressModal = null;
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

