// Renderer Module for CURB
// Handles all view rendering: departments, levels, semesters, sessions, files, about page

/**
 * Manages rendering of all views in the CURB application.
 * Each render method shows a skeleton placeholder, fetches data,
 * and replaces the container content with the final view.
 */
class Renderer {
    /**
     * Render skeleton loading UI.
     * @param {string} type - 'departments', 'levels', 'semesters', 'sessions', or 'files'.
     * @param {string} message - Loading message.
     * @returns {string} HTML string.
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
     * Render home view — department grid with search.
     * @param {HTMLElement} container - Main content container.
     * @returns {Promise<Array>} Fetched departments for route validation.
     */
    async renderHome(container) {
        container.innerHTML = this.renderSkeleton('departments', 'Loading departments...');

        const departments = await driveAPI.fetchDepartments();

        if (!departments || departments.length === 0) {
            container.innerHTML = this.renderEmptyState('No departments available', 'Please check back later');
            return [];
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

        this.ensureFontAwesomeIcons();
        return departments;
    }

    /**
     * Render levels view for a department.
     * @param {HTMLElement} container - Main content container.
     * @param {Object} route - Current route object.
     */
    async renderLevels(container, route) {
        const loadingText = route.department === 'Jupeb' ? 'subjects' : 'levels';
        container.innerHTML = this.renderSkeleton('levels', `Loading ${displayName(route.department)} ${loadingText}...`);

        const levels = await driveAPI.fetchLevels(route.department);

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
    }

    /**
     * Render semesters view.
     * @param {HTMLElement} container - Main content container.
     * @param {Object} route - Current route object.
     */
    async renderSemesters(container, route) {
        container.innerHTML = this.renderSkeleton('semesters', `Loading ${displayName(route.level)} semesters...`);

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
    }

    /**
     * Render sessions view (handles both standard and Jupeb structure).
     * @param {HTMLElement} container - Main content container.
     * @param {Object} route - Current route object.
     */
    async renderSessions(container, route) {
        const isJupeb = route.department === 'Jupeb';
        const loadingMsg = isJupeb
            ? `Loading ${displayName(route.level)} sessions...`
            : `Loading ${displayName(route.semester)} sessions...`;

        container.innerHTML = this.renderSkeleton('sessions', loadingMsg);

        let sessions;

        if (isJupeb) {
            sessions = await driveAPI.fetchSemesters(route.department, route.level);
        } else {
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
    }

    /**
     * Render files view.
     * @param {HTMLElement} container - Main content container.
     * @param {Object} route - Current route object.
     */
    async renderFiles(container, route) {
        container.innerHTML = this.renderSkeleton('files', 'Loading files...');

        const isJupeb = route.department === 'Jupeb';
        let path;

        if (isJupeb) {
            path = `/${route.department}/${route.level}/${route.session}`;
        } else {
            path = `/${route.department}/${route.level}/${route.semester}/${route.session}`;
        }

        const files = await driveAPI.fetchFiles(path);

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
    }

    /**
     * Fetch team data from the API, falling back to CONFIG.about.
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
            return {
                executives: CONFIG.about.executives,
                departmentReps: CONFIG.about.departmentReps,
                fromApi: false
            };
        }
    }

    /**
     * Render the About Us page.
     * @param {HTMLElement} container - Main content container.
     */
    async renderAboutPage(container) {
        const about = CONFIG.about;

        container.innerHTML = this.renderAboutSkeleton();

        const teamData = await this.fetchTeamData();

        const roleColors = {
            founder: '#0F9D58',
            executive: '#1E88E5',
            rep: '#26A69A'
        };

        /**
         * Generate initials from a name.
         * @param {string} name - Person's name.
         * @returns {string} Initials.
         */
        const getInitials = (name) => {
            if (!name || name === 'TBD' || name === 'Coming Soon') return '?';
            const parts = name.trim().split(/\s+/);
            if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
            return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
        };

        /**
         * Render a team member card.
         * @param {Object} member - Team member.
         * @param {string} size - 'large', 'medium', or 'small'.
         * @param {string} defaultColor - Fallback avatar color.
         * @returns {string} HTML string.
         */
        const renderTeamCard = (member, size = 'medium', defaultColor = roleColors.rep) => {
            const name = member.name || 'TBD';
            const initials = getInitials(name);
            const isPlaceholder = name === 'TBD' || name === 'Coming Soon';
            const cardClass = `team-card team-card--${size}${isPlaceholder ? ' team-card--placeholder' : ''}`;

            const role = member.role || `${member.department} Representative`;
            const color = member.color || defaultColor;
            const photoUrl = member.photoUrl || member.photourl || '';

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

        let founder = teamData.executives.find(e =>
            e.role && e.role.toLowerCase().includes('founder')
        );

        if (!founder) {
            founder = about.founder;
        }

        const executives = teamData.executives.filter(e =>
            !e.role || !e.role.toLowerCase().includes('founder')
        );

        container.innerHTML = `
      <div class="about-page">
        <div class="about-back">
          <a href="#/" class="about-back__link">
            <i class="fas fa-arrow-left"></i>
            <span>Back to Home</span>
          </a>
        </div>

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

        <section class="about-section about-section--founder">
          <h2 class="about-section__title">
            <i class="fas fa-star"></i>
            Founder
          </h2>
          <div class="about-founder">
            ${renderTeamCard(founder, 'large', roleColors.founder)}
          </div>
        </section>

        <section class="about-section about-section--executives">
          <h2 class="about-section__title">
            <i class="fas fa-users-cog"></i>
            Executive Team
          </h2>
          <div class="about-team-grid about-team-grid--executives">
            ${executives.map(exec => renderTeamCard(exec, 'medium', roleColors.executive)).join('')}
          </div>
        </section>

        <section class="about-section about-section--reps">
          <h2 class="about-section__title">
            <i class="fas fa-user-friends"></i>
            Department Representatives
          </h2>
          <div class="about-team-grid about-team-grid--reps">
            ${teamData.departmentReps.map(rep => renderTeamCard(rep, 'small', roleColors.rep)).join('')}
          </div>
        </section>

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
    }

    /**
     * Render skeleton for the About page.
     * @returns {string} HTML string.
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
     * Render breadcrumbs into the breadcrumb container.
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
     * Render empty state.
     * @param {string} title - Title text.
     * @param {string} message - Description text.
     * @returns {string} HTML string.
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
     * Render error state.
     * @param {string} message - Error message.
     * @returns {string} HTML string.
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
     * Render 404 not found.
     * @returns {string} HTML string.
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
     * Get Font Awesome icon class for a department.
     * Falls back to keyword matching for new departments.
     * @param {string} dept - Department name.
     * @returns {string} CSS class string.
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

        if (icons[dept]) return icons[dept];

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

        return 'fas fa-graduation-cap';
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

            const icons = document.querySelectorAll('.department-icon i, .search-icon i, .empty-state-icon i');
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
