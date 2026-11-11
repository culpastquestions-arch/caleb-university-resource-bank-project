// Renderer Module for CURB
// Handles all view rendering: departments, levels, semesters, sessions, files, about page

/**
 * Manages rendering of all views in the CURB application.
 * Each render method shows a skeleton placeholder, fetches data,
 * and replaces the container content with the final view.
 */
class Renderer {
  constructor() {
    this.teamRenderer = new TeamRenderer(this);
    this.coverageRenderer = new CoverageRenderer(this);
  }

  /**
   * Escape text for safe HTML rendering.
   * @param {string} value - Raw text.
   * @returns {string} Escaped text.
   */
  escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape attribute values.
   * @param {string} value - Raw attribute value.
   * @returns {string} Escaped attribute-safe string.
   */
  escapeAttr(value) {
    return this.escapeHtml(value);
  }

  /**
   * Ensure URLs are safe before injecting into href/src attributes.
   * @param {string} value - Raw URL string.
   * @param {string} fallback - Fallback URL when invalid.
   * @returns {string} Safe URL.
   */
  safeUrl(value, fallback = '#') {
    if (!value || typeof value !== 'string') return fallback;

    try {
      let normalizedValue = value.trim();
      if (normalizedValue.startsWith('//')) {
        normalizedValue = `https:${normalizedValue}`;
      } else if (/^(drive\.google\.com|docs\.google\.com|docs\.googleusercontent\.com)\//i.test(normalizedValue)) {
        normalizedValue = `https://${normalizedValue}`;
      }

      const parsed = new URL(normalizedValue, window.location.origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
      return fallback;
    } catch (error) {
      return fallback;
    }
  }

  /**
   * Get display metadata and icons for a file based on name and mimeType.
   * @param {string} fileName - Name of the file.
   * @param {string} [mimeType] - MIME type of the file.
   * @returns {Object} Metadata object { iconHtml, badgeClass, colorClass, label }.
   */
  getFileMeta(fileName = '', mimeType = '') {
    const lowerName = (fileName || '').toLowerCase();
    const lowerMime = (mimeType || '').toLowerCase();
    const ext = lowerName.includes('.') ? lowerName.split('.').pop() : '';

    if (ext === 'pdf' || lowerMime === 'application/pdf') {
      return {
        iconHtml: '<i class="far fa-file-pdf"></i>',
        badgeClass: 'file-badge--pdf',
        colorClass: 'file-icon--pdf',
        label: 'PDF'
      };
    }

    if (['docx', 'doc', 'rtf'].includes(ext) || lowerMime.includes('word') || lowerMime.includes('officedocument.wordprocessingml')) {
      return {
        iconHtml: '<i class="far fa-file-word"></i>',
        badgeClass: 'file-badge--word',
        colorClass: 'file-icon--word',
        label: 'DOC'
      };
    }

    if (['pptx', 'ppt'].includes(ext) || lowerMime.includes('presentation') || lowerMime.includes('powerpoint')) {
      return {
        iconHtml: '<i class="far fa-file-powerpoint"></i>',
        badgeClass: 'file-badge--ppt',
        colorClass: 'file-icon--ppt',
        label: 'PPT'
      };
    }

    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || lowerMime.includes('zip') || lowerMime.includes('compressed')) {
      return {
        iconHtml: '<i class="fas fa-file-zipper"></i>',
        badgeClass: 'file-badge--zip',
        colorClass: 'file-icon--zip',
        label: 'ZIP'
      };
    }

    if (['xlsx', 'xls', 'csv'].includes(ext) || lowerMime.includes('spreadsheet') || lowerMime.includes('excel')) {
      return {
        iconHtml: '<i class="far fa-file-excel"></i>',
        badgeClass: 'file-badge--excel',
        colorClass: 'file-icon--excel',
        label: 'XLS'
      };
    }

    if (['txt', 'md'].includes(ext) || lowerMime.startsWith('text/')) {
      return {
        iconHtml: '<i class="far fa-file-lines"></i>',
        badgeClass: 'file-badge--txt',
        colorClass: 'file-icon--txt',
        label: 'TXT'
      };
    }

    return {
      iconHtml: '<i class="far fa-file"></i>',
      badgeClass: 'file-badge--default',
      colorClass: 'file-icon--default',
      label: (ext ? ext.toUpperCase() : 'FILE')
    };
  }

  /**
   * Render skeleton loading UI.
   * @param {string} type - 'departments', 'levels', 'semesters', 'sessions', 'categories', or 'files'.
   * @param {string} message - Loading message.
   * @returns {string} HTML string.
   */
  renderSkeleton(type, message = 'Loading...') {
    const layouts = {
      files: { count: 5, gridClass: 'file-list', itemClass: 'skeleton-file' },
      departments: { count: 8, gridClass: 'departments-grid', itemClass: 'skeleton-department' },
      categories: { count: 2, gridClass: 'category-grid', itemClass: 'skeleton-card' },
      levels: { count: 4, gridClass: 'level-grid', itemClass: 'skeleton-card' }
    };
    const { count, gridClass, itemClass } = layouts[type] ||
      { count: 4, gridClass: 'semester-grid', itemClass: 'skeleton-card' };

    return `
      <div class="skeleton-container">
        <p class="skeleton-message">${this.escapeHtml(message)}</p>
        <div class="${gridClass}">
          ${Array(count).fill(0).map(() => `
            <div class="${itemClass} skeleton-loading">
              <div class="skeleton-content"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render home view — department grid with search.
   * @param {HTMLElement} container - Main content container.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   * @returns {Promise<Array>} Fetched department names.
   */
  async renderHome(container, options = {}) {
    const { forceRefresh = false } = options;
    container.innerHTML = this.renderSkeleton('departments', 'Loading departments...');

    const departments = await driveAPI.fetchDepartments(forceRefresh);

    if (!departments || departments.length === 0) {
      container.innerHTML = this.renderEmptyState('No departments available', 'Please check back later');
      return [];
    }

    container.innerHTML = `
      <section class="search-section">
        <h1 class="page-title">Find Past Questions for your department</h1>
        <div class="search-wrapper">
          <i class="fas fa-search search-icon"></i>
          <input
            type="text"
            id="search-input"
            class="search-input"
            placeholder="Search departments..."
            aria-label="Search departments"
          />
        </div>
      </section>

      <p class="departments-section-label">All Departments</p>
      <div class="departments-grid" id="department-grid">
        ${departments.map(dept => `
          <a href="#${buildRoutePath(dept)}" class="department-card" data-department="${this.escapeAttr(dept)}">
            <div class="card-icon">
              <i data-lucide="${this.getDepartmentLucideIcon(dept)}"></i>
            </div>
            <span class="card-title">${this.escapeHtml(dept)}</span>
          </a>
        `).join('')}
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      setTimeout(() => lucide.createIcons(), 0);
    }
    return departments;
  }

  /**
   * Render levels view for a department (subjects for Jupeb).
   * @param {HTMLElement} container - Main content container.
   * @param {Object} route - Current route object.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   */
  async renderLevels(container, route, options = {}) {
    const { forceRefresh = false } = options;
    const isJupeb = route.department === 'Jupeb';
    const loadingText = isJupeb ? 'subjects' : 'levels';
    container.innerHTML = this.renderSkeleton('levels', `Loading ${displayName(route.department)} ${loadingText}...`);

    const levels = await driveAPI.fetchLevels(route.department, forceRefresh);

    if (!levels || levels.length === 0) {
      container.innerHTML = this.renderEmptyState(`No ${loadingText} available`, 'Check back later for updates');
      return;
    }

    // Jupeb lists subjects (book icon + name); other departments list numbered levels.
    const renderCardBody = isJupeb
      ? (level) => `
              <div class="level-icon">
                <i class="fas fa-book"></i>
              </div>
              <h3>${this.escapeHtml(level)}</h3>`
      : (level) => `
              <div class="level-number">${this.escapeHtml(level.match(/\d+/)?.[0] || level)}</div>
              <div class="level-label">Level</div>`;

    container.innerHTML = `
      <div class="level-grid">
        ${levels.map(level => `
          <a href="#${buildRoutePath(route.department, level)}"
             class="level-card">${renderCardBody(level)}
          </a>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render semesters view.
   * @param {HTMLElement} container - Main content container.
   * @param {Object} route - Current route object.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   */
  async renderSemesters(container, route, options = {}) {
    const { forceRefresh = false } = options;
    container.innerHTML = this.renderSkeleton('semesters', `Loading ${displayName(route.level)} semesters...`);

    const semesters = await driveAPI.fetchSemesters(route.department, route.level, forceRefresh);

    if (!semesters || semesters.length === 0) {
      container.innerHTML = this.renderEmptyState('No semesters available', 'Check back later for updates');
      return;
    }

    container.innerHTML = `
      <div class="semester-grid">
        ${semesters.map(semester => `
          <a href="#${buildRoutePath(route.department, route.level, semester)}"
             class="semester-card">
            <div class="semester-name">${this.escapeHtml(semester)}</div>
          </a>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render sessions view (handles both standard and Jupeb structure).
   * @param {HTMLElement} container - Main content container.
   * @param {Object} route - Current route object.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   */
  async renderSessions(container, route, options = {}) {
    const { forceRefresh = false } = options;
    const isJupeb = route.department === 'Jupeb';
    // Jupeb has no semester layer: sessions sit directly under the subject ("level").
    const parentName = isJupeb ? route.level : route.semester;

    container.innerHTML = this.renderSkeleton('sessions', `Loading ${displayName(parentName)} sessions...`);

    const sessions = isJupeb
      ? await driveAPI.fetchSemesters(route.department, route.level, forceRefresh)
      : await driveAPI.fetchSessions(route.department, route.level, route.semester, forceRefresh);

    if (!sessions || sessions.length === 0) {
      container.innerHTML = this.renderEmptyState('No sessions available', 'Check back later for updates');
      return;
    }

    // route.semester is null for Jupeb, so buildRoutePath skips it.
    container.innerHTML = `
      <div class="semester-grid">
        ${sessions.map(session => `
          <a href="#${buildRoutePath(route.department, route.level, route.semester, session)}"
             class="semester-card">
            <div class="semester-name">${this.escapeHtml(session)}</div>
          </a>
        `).join('')}
      </div>
    `;
  }

  /**
   * Helper to classify a category folder and return display metadata.
   * @param {string} folderName - Category folder name in Drive.
   * @returns {Object} Category metadata { title, subtitle, iconHtml, cardModifier, sortRank }.
   */
  getCategoryMeta(folderName = '') {
    const lower = folderName.trim().toLowerCase();

    if (lower.includes('past question') || lower === 'pq' || lower === 'pqs') {
      return {
        title: 'Past Questions',
        subtitle: 'Exam & test question papers',
        iconHtml: '<i class="fas fa-file-signature"></i>',
        cardModifier: 'category-card--pq',
        sortRank: 0
      };
    }

    if (lower.includes('course material') || lower.includes('material') || lower.includes('note') || lower.includes('slide') || lower.includes('lecture')) {
      return {
        title: 'Course Materials',
        subtitle: 'Lecture slides, notes & handouts',
        iconHtml: '<i class="fas fa-book-open"></i>',
        cardModifier: 'category-card--materials',
        sortRank: 1
      };
    }

    return {
      title: folderName,
      subtitle: 'Course study resources',
      iconHtml: '<i class="fas fa-folder-open"></i>',
      cardModifier: 'category-card--general',
      sortRank: 2
    };
  }

  /**
   * Render adaptive session view (dual-state).
   * If category folders exist, displays category cards.
   * If no category folders exist, falls back gracefully to direct file display.
   * @param {HTMLElement} container - Main content container.
   * @param {Object} route - Current route object.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   */
  async renderSessionContent(container, route, options = {}) {
    const { forceRefresh = false } = options;
    const sessionDisplay = displayName(route.session);
    container.innerHTML = this.renderSkeleton('categories', `Loading ${sessionDisplay}...`);

    try {
      const subfolders = await driveAPI.fetchFolders(driveAPI.buildPath(route), forceRefresh);

      if (subfolders && subfolders.length > 0) {
        // Past Questions first, Course Materials second, then everything else alphabetically
        const categories = subfolders
          .map(folder => ({ folder, meta: this.getCategoryMeta(folder.name) }))
          .sort((a, b) =>
            (a.meta.sortRank - b.meta.sortRank) || a.folder.name.localeCompare(b.folder.name)
          );

        container.innerHTML = `
          <div class="category-section">
            <div class="category-header">
              <h2 class="category-heading">Select Resource Category</h2>
              <p class="category-subheading">Choose whether to view past questions or course materials for ${this.escapeHtml(sessionDisplay)}</p>
            </div>
            <div class="category-grid">
              ${categories.map(({ folder, meta }) => `
                <a href="#${buildRoutePath(route.department, route.level, route.semester, route.session, folder.name)}" class="category-card ${meta.cardModifier}">
                  <div class="category-card__icon">
                    ${meta.iconHtml}
                  </div>
                  <div class="category-card__content">
                    <h3 class="category-card__title">${this.escapeHtml(meta.title)}</h3>
                    <p class="category-card__subtitle">${this.escapeHtml(meta.subtitle)}</p>
                  </div>
                  <div class="category-card__arrow">
                    <i class="fas fa-chevron-right"></i>
                  </div>
                </a>
              `).join('')}
            </div>
          </div>
        `;
        return;
      }

      // Fallback for unmigrated sessions: no category folders -> render files directly
      await this.renderFiles(container, route, options);
    } catch (error) {
      console.error('Failed to load session content:', error);
      try {
        await this.renderFiles(container, route, options);
      } catch (fileError) {
        container.innerHTML = this.renderErrorState(fileError.message || 'Failed to load content');
      }
    }
  }

  /**
   * Render files view.
   * @param {HTMLElement} container - Main content container.
   * @param {Object} route - Current route object.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   */
  async renderFiles(container, route, options = {}) {
    const { forceRefresh = false } = options;
    container.innerHTML = this.renderSkeleton('files', 'Loading files...');

    const files = await driveAPI.fetchFiles(driveAPI.buildPath(route), forceRefresh);

    if (!files || files.length === 0) {
      const isFirstSemester2024_2025 = route.semester === '1st Semester' && route.session === '2024~25 Session';

      if (isFirstSemester2024_2025 && !route.category) {
        container.innerHTML = this.renderEmptyState(
          'No files available for 1st Semester 2024/2025',
          'Files are available from 2nd semester 2024/2025 onwards.'
        );
      } else if (route.category) {
        container.innerHTML = this.renderEmptyState(
          `No ${displayName(route.category)} available yet`,
          'Files will be added soon. Check back later or contact us if you have materials to share.'
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
        ${files.map(file => {
          const fileMeta = this.getFileMeta(file.name, file.mimeType);
          return `
            <div class="file-card">
              <div class="file-icon ${fileMeta.colorClass}">${fileMeta.iconHtml}</div>
              <div class="file-info">
                <div class="file-name">${this.escapeHtml(file.name)}</div>
                <div class="file-meta">
                  <span class="file-badge ${fileMeta.badgeClass}">${fileMeta.label}</span>
                  ${file.size ? ` • ${this.escapeHtml(driveAPI.formatFileSize(file.size))}` : ''}
                  ${file.modifiedTime ? ` • ${this.escapeHtml(driveAPI.formatDate(file.modifiedTime))}` : ''}
                </div>
                <div class="file-actions">
                  <a href="${this.escapeAttr(this.safeUrl(driveAPI.getViewLink(file)))}" target="_blank" rel="noopener noreferrer" class="btn-secondary">View</a>
                  <a href="${this.escapeAttr(this.safeUrl(driveAPI.getDownloadLink(file)))}" target="_blank" rel="noopener noreferrer" class="btn-primary" data-download>Download</a>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Fetch team data from the API, optionally filtered by session.
   * Falls back to CONFIG.about when the API is unavailable.
   * @param {string} [session] - Optional academic session to filter by (e.g. '2025/26').
   * @param {{forceRefresh?: boolean}} [options] - Fetch options.
   * @returns {Promise<Object>} Team data with executives, departmentReps, session, and sessions list.
   */
  async fetchTeamData(session, options = {}) {
    const { forceRefresh = false } = options;

    try {
      const queryParts = [];
      if (forceRefresh) {
        queryParts.push('refresh=1');
      }
      if (session) {
        queryParts.push(`session=${encodeURIComponent(session)}`);
      }
      const url = queryParts.length
        ? `${CONFIG.apiBase}/team?${queryParts.join('&')}`
        : `${CONFIG.apiBase}/team`;

      const response = await fetch(url, forceRefresh ? { cache: 'no-store' } : undefined);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.executives && data.departmentReps) {
        return {
          executives: data.executives,
          departmentReps: data.departmentReps,
          session: data.session || '',
          sessions: data.sessions || [],
          fromApi: true
        };
      }

      throw new Error('Invalid API response');
    } catch (error) {
      console.warn('Failed to fetch team data from API, using fallback:', error.message);
      return this.getFallbackTeamData(session);
    }
  }

  /**
   * Build team data from the static CONFIG.about fallback.
   * @param {string} [session] - Requested academic session.
   * @returns {Object} Team data in the same shape as the API result.
   */
  getFallbackTeamData(session) {
    const about = CONFIG.about || {};
    const sessions = Array.from(
      new Set([...(Array.isArray(about.sessions) ? about.sessions : []), about.session].filter(Boolean))
    );

    return {
      executives: Array.isArray(about.executives) ? about.executives : [],
      departmentReps: Array.isArray(about.departmentReps) ? about.departmentReps : [],
      session: sessions.includes(session) ? session : (sessions[0] || ''),
      sessions,
      fromApi: false
    };
  }

  /**
   * Render the About Us page with session picker.
   * @param {HTMLElement} container - Main content container.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   */
  async renderAboutPage(container, options = {}) {
    return this.teamRenderer.renderAboutPage(container, options);
  }

  /**
   * Render the Coverage Dashboard (track route).
   * @param {HTMLElement} container - Main content container.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   */
  async renderCoverage(container, options = {}) {
    return this.coverageRenderer.renderCoverage(container, options);
  }

  /**
   * Render breadcrumbs into the breadcrumb container.
   */
  renderBreadcrumbs() {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer) return;

    const breadcrumbs = appNavigator.getBreadcrumbs();

    breadcrumbContainer.innerHTML = breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      const crumbHTML = isLast || crumb.active
        ? `<span class="breadcrumb-item active">${this.escapeHtml(crumb.label)}</span>`
        : `<a href="#${this.escapeAttr(crumb.path)}" class="breadcrumb-item">${this.escapeHtml(crumb.label)}</a>`;

      const separator = isLast ? '' : '<span class="breadcrumb-separator">›</span>';
      return crumbHTML + separator;
    }).join('');
  }

  /**
   * Render a centered status block (empty / error / not-found states).
   * @param {Object} state - State content.
   * @param {string} state.icon - Font Awesome icon classes.
   * @param {string} state.title - Title text.
   * @param {string} state.message - Description text.
   * @param {string} state.action - data-action value for the button.
   * @param {string} state.actionIcon - Font Awesome icon classes for the button.
   * @param {string} state.actionLabel - Button label.
   * @returns {string} HTML string.
   */
  renderStateBlock({ icon, title, message, action, actionIcon, actionLabel }) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon-wrap">
          <i class="${icon}"></i>
        </div>
        <p class="empty-state-title">${this.escapeHtml(title)}</p>
        <p class="meta-text">${this.escapeHtml(message)}</p>
        <button class="btn-secondary" data-action="${action}" type="button">
          <i class="${actionIcon}"></i> ${actionLabel}
        </button>
      </div>
    `;
  }

  /**
   * Render empty state.
   * @param {string} title - Title text.
   * @param {string} message - Description text.
   * @returns {string} HTML string.
   */
  renderEmptyState(title, message) {
    return this.renderStateBlock({
      icon: 'far fa-folder-open',
      title,
      message,
      action: 'refresh-content',
      actionIcon: 'fas fa-rotate-right',
      actionLabel: 'Refresh Content'
    });
  }

  /**
   * Render error state.
   * @param {string} message - Error message.
   * @returns {string} HTML string.
   */
  renderErrorState(message) {
    return this.renderStateBlock({
      icon: 'far fa-circle-xmark',
      title: 'Something went wrong',
      message: message || 'An error occurred',
      action: 'refresh-content',
      actionIcon: 'fas fa-rotate-right',
      actionLabel: 'Try Again'
    });
  }

  /**
   * Render 404 not found.
   * @returns {string} HTML string.
   */
  renderNotFound() {
    return this.renderStateBlock({
      icon: 'far fa-circle-question',
      title: 'Page Not Found',
      message: "The page you're looking for doesn't exist.",
      action: 'go-home',
      actionIcon: 'fas fa-house',
      actionLabel: 'Go Home'
    });
  }

  /**
   * Get Lucide icon name for a department card.
   * @param {string} dept - Department name.
   * @returns {string} Lucide icon name.
   */
  getDepartmentLucideIcon(dept) {
    const icons = {
      'Accounting':                  'trending-up',
      'Advertising':                 'megaphone',
      'Architecture':                'building-2',
      'Biochemistry':                'dna',
      'Broadcasting':                'radio',
      'Business Administration':     'briefcase',
      'Computer Science':            'monitor',
      'Communication':               'message-circle',
      'Criminology':                 'scale',
      'Cybersecurity':               'shield',
      'Economics':                   'bar-chart-2',
      'Human Anatomy':               'activity',
      'Human Physiology':            'heart-pulse',
      'Industrial Chemistry':        'flask-conical',
      'International Relations':     'globe',
      'Jupeb':                       'graduation-cap',
      'Law':                         'scale',
      'Mass Communication':          'newspaper',
      'Microbiology':                'microscope',
      'MLS':                         'microscope',
      'Medical Lab Science':         'microscope',
      'Nursing':                     'heart-pulse',
      'Political Science':           'landmark',
      'Psychology':                  'brain',
      'Public Health':               'activity',
      'Software Engineering':        'code-2',
    };

    if (icons[dept]) return icons[dept];

    const d = dept.toLowerCase();
    if (d.includes('computer') || d.includes('software') || d.includes('tech')) return 'monitor';
    if (d.includes('business') || d.includes('management') || d.includes('admin')) return 'briefcase';
    if (d.includes('law') || d.includes('legal') || d.includes('criminol')) return 'scale';
    if (d.includes('nurs') || d.includes('physiol') || d.includes('anatomy')) return 'heart-pulse';
    if (d.includes('engineering')) return 'cog';
    if (d.includes('biochem') || d.includes('chem')) return 'flask-conical';
    if (d.includes('micro') || d.includes('lab')) return 'microscope';
    if (d.includes('art') || d.includes('design') || d.includes('architect')) return 'building-2';
    if (d.includes('education') || d.includes('teach')) return 'book-open';
    if (d.includes('communication') || d.includes('media') || d.includes('broadcast')) return 'newspaper';
    if (d.includes('finance') || d.includes('account') || d.includes('banking') || d.includes('econ')) return 'trending-up';
    if (d.includes('psych')) return 'brain';
    if (d.includes('political') || d.includes('public') || d.includes('relation')) return 'landmark';
    if (d.includes('health')) return 'activity';

    return 'graduation-cap';
  }
}

// Create singleton instance
const renderer = new Renderer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Renderer, renderer };
}
