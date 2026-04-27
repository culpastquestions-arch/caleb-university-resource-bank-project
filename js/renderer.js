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
     * Render skeleton loading UI.
     * @param {string} type - 'departments', 'levels', 'semesters', 'sessions', or 'files'.
     * @param {string} message - Loading message.
     * @returns {string} HTML string.
     */
    renderSkeleton(type, message = 'Loading...') {
        const skeletonCount = type === 'files' ? 5 : (type === 'departments' ? 8 : 4);
        const gridClass = type === 'files' ? 'file-list' :
            (type === 'departments' ? 'departments-grid' :
                (type === 'levels' ? 'level-grid' : 'semester-grid'));
        const itemClass = type === 'files' ? 'skeleton-file' :
            (type === 'departments' ? 'skeleton-department' : 'skeleton-card');

        return `
      <div class="skeleton-container">
        <p class="skeleton-message">${this.escapeHtml(message)}</p>
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
     * Render home view — department grid with search.
     * @param {HTMLElement} container - Main content container.
     * @returns {Promise<Array>} Fetched departments for route validation.
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
          <a href="#/${encodeSegment(dept)}" class="department-card" data-department="${this.escapeAttr(dept)}">
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
        this.ensureFontAwesomeIcons();
        return departments;
    }

    /**
     * Render levels view for a department.
     * @param {HTMLElement} container - Main content container.
     * @param {Object} route - Current route object.
     */
    async renderLevels(container, route, options = {}) {
      const { forceRefresh = false } = options;
        const loadingText = route.department === 'Jupeb' ? 'subjects' : 'levels';
        container.innerHTML = this.renderSkeleton('levels', `Loading ${displayName(route.department)} ${loadingText}...`);

      const levels = await driveAPI.fetchLevels(route.department, forceRefresh);

        if (!levels || levels.length === 0) {
            container.innerHTML = this.renderEmptyState(`No ${loadingText} available`, 'Check back later for updates');
            return;
        }

        if (route.department === 'Jupeb') {
            container.innerHTML = `
        <div class="level-grid">
          ${levels.map(level => `
            <a href="#/${encodeSegment(route.department)}/${encodeSegment(level)}"
               class="level-card">
              <div class="level-icon">
                <i class="fas fa-book"></i>
              </div>
              <h3>${this.escapeHtml(level)}</h3>
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
              <div class="level-number">${this.escapeHtml(level.match(/\d+/)?.[0] || level)}</div>
              <div class="level-label">Level</div>
            </a>
          `).join('')}
        </div>
      `;
        }

        this.ensureFontAwesomeIcons();
    }

    /**
     * Render semesters view.
     * @param {HTMLElement} container - Main content container.
     * @param {Object} route - Current route object.
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
          <a href="#/${encodeSegment(route.department)}/${encodeSegment(route.level)}/${encodeSegment(semester)}"
             class="semester-card">
            <div class="semester-name">${this.escapeHtml(semester)}</div>
          </a>
        `).join('')}
      </div>
    `;

        this.ensureFontAwesomeIcons();
    }

    /**
     * Render sessions view (handles both standard and Jupeb structure).
     * @param {HTMLElement} container - Main content container.
     * @param {Object} route - Current route object.
     */
    async renderSessions(container, route, options = {}) {
      const { forceRefresh = false } = options;
        const isJupeb = route.department === 'Jupeb';
        const loadingMsg = isJupeb
            ? `Loading ${displayName(route.level)} sessions...`
            : `Loading ${displayName(route.semester)} sessions...`;

        container.innerHTML = this.renderSkeleton('sessions', loadingMsg);

        let sessions;

        if (isJupeb) {
          sessions = await driveAPI.fetchSemesters(route.department, route.level, forceRefresh);
        } else {
          sessions = await driveAPI.fetchSessions(route.department, route.level, route.semester, forceRefresh);
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
              <div class="semester-name">${this.escapeHtml(session)}</div>
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
              <div class="semester-name">${this.escapeHtml(session)}</div>
            </a>
          `).join('')}
        </div>
      `;
        }

        this.ensureFontAwesomeIcons();
    }

    /**
     * Render files view.
     * @param {HTMLElement} container - Main content container.
     * @param {Object} route - Current route object.
     */
    async renderFiles(container, route, options = {}) {
      const { forceRefresh = false } = options;
        container.innerHTML = this.renderSkeleton('files', 'Loading files...');

        const isJupeb = route.department === 'Jupeb';
        let path;

        if (isJupeb) {
            path = `/${route.department}/${route.level}/${route.session}`;
        } else {
            path = `/${route.department}/${route.level}/${route.semester}/${route.session}`;
        }

        const files = await driveAPI.fetchFiles(path, forceRefresh);

        if (!files || files.length === 0) {
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
          <div class="file-card">
            <div class="file-icon"><i class="far fa-file-pdf"></i></div>
            <div class="file-info">
              <div class="file-name">${this.escapeHtml(file.name)}</div>
              <div class="file-meta">
                ${this.escapeHtml(file.size ? driveAPI.formatFileSize(file.size) : '')} •
                ${this.escapeHtml(file.modifiedTime ? driveAPI.formatDate(file.modifiedTime) : '')}
              </div>
              <div class="file-actions">
                <a href="${this.escapeAttr(this.safeUrl(driveAPI.getViewLink(file)))}" target="_blank" rel="noopener noreferrer" class="btn-secondary">View</a>
                <a href="${this.escapeAttr(this.safeUrl(driveAPI.getDownloadLink(file)))}" target="_blank" rel="noopener noreferrer" class="btn-primary">Download</a>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

        this.ensureFontAwesomeIcons();
    }

    /**
     * Fetch team data from the API, optionally filtered by session.
     * Falls back to CONFIG.about when the API is unavailable.
     * @param {string} [session] - Optional academic session to filter by (e.g. '2025/26').
     * @returns {Promise<Object>} Team data with executives, departmentReps, session, and sessions list.
     */
    async fetchTeamData(session, options = {}) {
        try {
        const { forceRefresh = false } = options;
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

          const configuredSessions = Array.isArray(CONFIG.about.sessions)
            ? CONFIG.about.sessions.filter(s => typeof s === 'string' && s.trim())
            : [];
          const configuredPrimarySession = typeof CONFIG.about.session === 'string'
            ? CONFIG.about.session.trim()
            : '';
          const fallbackSessions = Array.from(
            new Set([...configuredSessions, configuredPrimarySession].filter(Boolean))
          );

          const getSessionStartYear = (value) => {
            const match = String(value).match(/(\d{4})\s*[\/~-]\s*(\d{2,4})/);
            if (!match) return Number.NEGATIVE_INFINITY;
            const year = Number.parseInt(match[1], 10);
            return Number.isFinite(year) ? year : Number.NEGATIVE_INFINITY;
          };

          fallbackSessions.sort((a, b) => {
            const yearDiff = getSessionStartYear(b) - getSessionStartYear(a);
            if (yearDiff !== 0) return yearDiff;
            return b.localeCompare(a);
          });

          const activeFallbackSession = (session && fallbackSessions.includes(session))
            ? session
            : (fallbackSessions[0] || '');

          const fallbackExecutivesRaw = Array.isArray(CONFIG.about.executives) ? CONFIG.about.executives : [];
          const fallbackRepsRaw = Array.isArray(CONFIG.about.departmentReps) ? CONFIG.about.departmentReps : [];

          const hasExecutiveSessions = fallbackExecutivesRaw.some(member =>
            member && typeof member.session === 'string' && member.session.trim()
          );
          const hasRepSessions = fallbackRepsRaw.some(member =>
            member && typeof member.session === 'string' && member.session.trim()
          );

          const fallbackExecutives = (activeFallbackSession && hasExecutiveSessions)
            ? fallbackExecutivesRaw.filter(member => member.session === activeFallbackSession)
            : fallbackExecutivesRaw;
          const fallbackReps = (activeFallbackSession && hasRepSessions)
            ? fallbackRepsRaw.filter(member => member.session === activeFallbackSession)
            : fallbackRepsRaw;

          const cleanFallbackExecutives = fallbackExecutives.map(({ session: _memberSession, ...rest }) => rest);
          const cleanFallbackReps = fallbackReps.map(({ session: _memberSession, ...rest }) => rest);

            return {
            executives: cleanFallbackExecutives,
            departmentReps: cleanFallbackReps,
            session: activeFallbackSession,
            sessions: fallbackSessions,
                fromApi: false
            };
        }
    }

    /**
     * Render the About Us page with session picker.
     * @param {HTMLElement} container - Main content container.
     */
    async renderAboutPage(container, options = {}) {
      return this.teamRenderer.renderAboutPage(container, options);
    }

    /**
     * Render the full about page structure (team + mission + CTA).
     * @param {HTMLElement} container - Main content container.
     * @param {Object} about - CONFIG.about data.
     * @param {Object} teamData - Fetched team data with session info.
     */
    _renderAboutFull(container, about, teamData) {
      return this.teamRenderer._renderAboutFull(container, about, teamData);
    }

    /**
     * Render the session picker (horizontal pill tabs).
     * Only renders if there are multiple sessions.
     * @param {Array<string>} sessions - Available sessions.
     * @param {string} activeSession - Currently active session.
     * @returns {string} HTML string.
     */
    _renderSessionPicker(sessions, activeSession) {
      return this.teamRenderer._renderSessionPicker(sessions, activeSession);
    }

    /**
     * Render the team content (executives + reps grids).
     * This is the part that gets swapped when switching sessions.
     * @param {Object} teamData - Team data with executives and departmentReps.
     * @returns {string} HTML string.
     */
    _renderTeamContent(teamData) {
      return this.teamRenderer._renderTeamContent(teamData);
    }

      /**
       * Attach CSP-safe image fallback handlers for team photos.
       * @param {HTMLElement} scope - Container to scan.
       */
      attachTeamPhotoFallbackHandlers(scope) {
        return this.teamRenderer.attachTeamPhotoFallbackHandlers(scope);
      }

    /**
     * Attach click listeners to session picker tabs.
     * Handles session switching by re-fetching and re-rendering only the team content.
     */
    _attachSessionListeners() {
      return this.teamRenderer._attachSessionListeners();
    }

    /**
     * Render skeleton for the About page.
     * @returns {string} HTML string.
     */
    renderAboutSkeleton() {
      return this.teamRenderer.renderAboutSkeleton();
    }

    /**
     * Render the Coverage Dashboard (track route).
     * @param {HTMLElement} container - Main content container
     */
    async renderCoverage(container, options = {}) {
      return this.coverageRenderer.renderCoverage(container, options);
    }

    /**
     * Renders the coverage data table for a department.
     * @param {Array} coverageData - Coverage tree data returned from new API.
     */
    _renderCoverageTable(coverageData) {
      return this.coverageRenderer._renderCoverageTable(coverageData);
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
     * Render empty state.
     * @param {string} title - Title text.
     * @param {string} message - Description text.
     * @returns {string} HTML string.
     */
    renderEmptyState(title, message) {
        return `
      <div class="empty-state">
        <div class="empty-state-icon-wrap">
          <i class="far fa-folder-open"></i>
        </div>
        <p class="empty-state-title">${this.escapeHtml(title)}</p>
        <p class="meta-text">${this.escapeHtml(message)}</p>
        <button class="btn-secondary" data-action="refresh-content" type="button">
          <i class="fas fa-rotate-right"></i> Refresh Content
        </button>
      </div>
    `;
    }

    /**
     * Render error state.
     * @param {string} message - Error message.
     * @returns {string} HTML string.
     */
    renderErrorState(message) {
        return `
      <div class="empty-state">
        <div class="empty-state-icon-wrap">
          <i class="far fa-circle-xmark"></i>
        </div>
        <p class="empty-state-title">Something went wrong</p>
        <p class="meta-text">${this.escapeHtml(message || 'An error occurred')}</p>
          <button class="btn-secondary" data-action="refresh-content" type="button">
          <i class="fas fa-rotate-right"></i> Try Again
        </button>
      </div>
    `;
    }

    /**
     * Render 404 not found.
     * @returns {string} HTML string.
     */
    renderNotFound() {
        return `
      <div class="empty-state">
        <div class="empty-state-icon-wrap">
          <i class="far fa-circle-question"></i>
        </div>
        <p class="empty-state-title">Page Not Found</p>
        <p class="meta-text">The page you're looking for doesn't exist.</p>
          <button class="btn-secondary" data-action="go-home" type="button">
          <i class="fas fa-house"></i> Go Home
        </button>
      </div>
    `;
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

    /**
     * Ensure Font Awesome icons render properly after DOM updates.
     */
    ensureFontAwesomeIcons() {
        setTimeout(() => {
            const fontAwesomeLoaded = document.querySelector('link[href*="fontawesome"]') ||
                document.querySelector('link[href*="font-awesome"]');

            if (!fontAwesomeLoaded) {
                console.warn('Font Awesome CSS not found, icons may not display properly');
                return;
            }

            const icons = document.querySelectorAll('.card-icon i, .search-icon i, .empty-state-icon i');
            icons.forEach(icon => {
                const className = icon.className;
                icon.className = '';
                requestAnimationFrame(() => {
                    icon.className = className;
                });
            });
        }, 50);
    }
}

// Create singleton instance
const renderer = new Renderer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Renderer, renderer };
}
