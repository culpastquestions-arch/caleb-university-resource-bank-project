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
            (type === 'departments' ? 'departments-grid' :
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
          <a href="#/${encodeSegment(dept)}" class="department-card" data-department="${dept}">
            <div class="card-icon">
              <i data-lucide="${this.getDepartmentLucideIcon(dept)}"></i>
            </div>
            <span class="card-title">${dept}</span>
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
          <div class="file-card">
            <div class="file-icon"><i class="far fa-file-pdf"></i></div>
            <div class="file-info">
              <div class="file-name">${file.name}</div>
              <div class="file-meta">
                ${file.size ? driveAPI.formatFileSize(file.size) : ''} •
                ${file.modifiedTime ? driveAPI.formatDate(file.modifiedTime) : ''}
              </div>
              <div class="file-actions">
                <a href="${driveAPI.getViewLink(file)}" target="_blank" class="btn-secondary">View</a>
                <a href="${driveAPI.getDownloadLink(file)}" target="_blank" class="btn-primary">Download</a>
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
    async fetchTeamData(session) {
        try {
            const queryParts = ['refresh=1'];
            if (session) {
                queryParts.push(`session=${encodeURIComponent(session)}`);
            }
            const url = `${CONFIG.apiBase}/team?${queryParts.join('&')}`;

            const response = await fetch(url, { cache: 'no-store' });

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

          const cleanFallbackExecutives = fallbackExecutives.map(({ session: memberSession, ...rest }) => rest);
          const cleanFallbackReps = fallbackReps.map(({ session: memberSession, ...rest }) => rest);

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
    async renderAboutPage(container) {
        const about = CONFIG.about;

        container.innerHTML = this.renderAboutSkeleton();

        const teamData = await this.fetchTeamData();

        // Store reference for session switching
        this._aboutContainer = container;
        this._aboutMission = about.mission;

        this._renderAboutFull(container, about, teamData);
    }

    /**
     * Render the full about page structure (team + mission + CTA).
     * @param {HTMLElement} container - Main content container.
     * @param {Object} about - CONFIG.about data.
     * @param {Object} teamData - Fetched team data with session info.
     */
    _renderAboutFull(container, about, teamData) {
        container.innerHTML = `
      <div class="about-page">
        <div class="about-back">
          <a href="#/" class="about-back__link">
            <i class="fas fa-arrow-left"></i>
            <span>Back to Home</span>
          </a>
        </div>

        <section class="about-section about-section--team">
          <h2 class="about-section__title">
            <i class="fas fa-users"></i>
            Meet the Team
          </h2>
          ${this._renderSessionPicker(teamData.sessions, teamData.session)}
          <div id="team-content">
            ${this._renderTeamContent(teamData)}
          </div>
        </section>

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

        // Attach session picker listeners
        this._attachSessionListeners();
    }

    /**
     * Render the session picker (horizontal pill tabs).
     * Only renders if there are multiple sessions.
     * @param {Array<string>} sessions - Available sessions.
     * @param {string} activeSession - Currently active session.
     * @returns {string} HTML string.
     */
    _renderSessionPicker(sessions, activeSession) {
        if (!sessions || sessions.length <= 1) {
            // Single session — show it as a subtle label, no picker needed
            const label = activeSession || sessions[0] || '';
            return label
                ? `<p class="about-section__subtitle"><i class="fas fa-calendar-alt"></i> ${label} Session Team</p>`
                : '';
        }

        return `
      <div class="session-picker" id="session-picker">
        ${sessions.map(s => `
          <button class="session-picker__tab${s === activeSession ? ' session-picker__tab--active' : ''}"
                  data-session="${s}"
                  aria-label="View ${s} team"
                  type="button">
            ${s}
          </button>
        `).join('')}
      </div>
    `;
    }

    /**
     * Render the team content (executives + reps grids).
     * This is the part that gets swapped when switching sessions.
     * @param {Object} teamData - Team data with executives and departmentReps.
     * @returns {string} HTML string.
     */
    _renderTeamContent(teamData) {
        const roleColors = { executive: '#1E88E5', rep: '#26A69A' };

        /**
         * Escape text for safe use in HTML attributes.
         * @param {string} value - Raw attribute value.
         * @returns {string} Escaped value.
         */
        const escapeAttr = (value) => {
            if (value === null || value === undefined) return '';
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
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
         * Render a single team member card.
         * @param {Object} member - Team member object.
         * @param {string} type - 'executive' or 'rep'.
         * @param {number} index - Card index for animation delay.
         * @returns {string} HTML string.
         */
        const renderTeamCard = (member, type = 'rep', index = 0) => {
            const name = member.name || 'TBD';
            const initials = getInitials(name);
            const isPlaceholder = name === 'TBD' || name === 'Coming Soon';

            const role = member.role || `${member.department} Rep`;
            const color = member.color || roleColors[type];
            const photoUrl = member.photoUrl || member.photourl || '';
            const safePhotoUrl = escapeAttr(photoUrl);
            const safeAlt = escapeAttr(name);

            const driveFallbackOnError = "if(!this.dataset.fallbackTried){this.dataset.fallbackTried='1';if(this.src.includes('export=view')){this.src=this.src.replace('export=view','export=download');return;}if(this.src.includes('export=download')){const m=this.src.match(/[?&]id=([^&]+)/);if(m&&m[1]){this.src='https://drive.google.com/thumbnail?id='+m[1]+'&sz=w1000';return;}}}this.style.display='none';this.nextElementSibling.style.display='flex';";

            const avatarContent = photoUrl
              ? `<img src="${safePhotoUrl}" alt="${safeAlt}" class="team-card__photo" onerror="${driveFallbackOnError}">
           <span class="team-card__initials" style="display:none;">${initials}</span>`
                : `<span class="team-card__initials">${initials}</span>`;

            const delay = Math.min(index * 0.04, 0.4);

            return `
        <div class="team-card team-card--${type}${isPlaceholder ? ' team-card--placeholder' : ''}" style="animation-delay: ${delay}s">
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

        const hasExecutives = teamData.executives && teamData.executives.length > 0;
        const hasReps = teamData.departmentReps && teamData.departmentReps.length > 0;
        const executiveMembers = hasExecutives ? teamData.executives : [];
        const topExecutives = executiveMembers.slice(0, 2);
        const remainingExecutives = executiveMembers.slice(2);
        const bottomExecutiveColumns = Math.min(Math.max(remainingExecutives.length, 1), 5);

        if (!hasExecutives && !hasReps) {
            return `
        <div class="empty-state" style="min-height: 200px;">
          <div class="empty-state-icon-wrap">
            <i class="far fa-users"></i>
          </div>
          <p class="empty-state-title">No team data for this session</p>
          <p class="meta-text">Team information hasn't been added yet</p>
        </div>
      `;
        }

        return `
      ${hasExecutives ? `
        <div class="team-content__section">
          <h3 class="team-content__heading">
            <i class="fas fa-users-cog"></i>
            Executive Team
          </h3>
          <div class="about-team-grid about-team-grid--executives about-team-grid--executives-top">
            ${topExecutives.map((exec, i) => renderTeamCard(exec, 'executive', i)).join('')}
          </div>
          ${remainingExecutives.length ? `
            <div class="about-team-grid about-team-grid--executives about-team-grid--executives-bottom" style="--exec-bottom-columns: ${bottomExecutiveColumns};">
              ${remainingExecutives.map((exec, i) => renderTeamCard(exec, 'executive', i + topExecutives.length)).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${hasReps ? `
        <div class="team-content__section">
          <h3 class="team-content__heading">
            <i class="fas fa-user-friends"></i>
            Department Representatives
          </h3>
          <div class="about-team-grid about-team-grid--reps">
            ${teamData.departmentReps.map((rep, i) => renderTeamCard(rep, 'rep', i)).join('')}
          </div>
        </div>
      ` : ''}
    `;
    }

    /**
     * Attach click listeners to session picker tabs.
     * Handles session switching by re-fetching and re-rendering only the team content.
     */
    _attachSessionListeners() {
        const picker = document.getElementById('session-picker');
        if (!picker) return;

        picker.addEventListener('click', async (e) => {
            const tab = e.target.closest('.session-picker__tab');
            if (!tab || tab.classList.contains('session-picker__tab--active')) return;

            const session = tab.dataset.session;
            if (!session) return;

            // Update active tab immediately
            picker.querySelectorAll('.session-picker__tab').forEach(t =>
                t.classList.remove('session-picker__tab--active')
            );
            tab.classList.add('session-picker__tab--active');

            // Show loading in the team content area
            const teamContent = document.getElementById('team-content');
            if (teamContent) {
                teamContent.innerHTML = `
          <div class="loading" style="padding: var(--space-8) 0;">
            <div class="spinner"></div>
            <p>Loading team...</p>
          </div>
        `;
            }

            // Fetch new session data
            try {
                const teamData = await this.fetchTeamData(session);
                if (teamContent) {
                    teamContent.innerHTML = this._renderTeamContent(teamData);
                }
            } catch (error) {
                console.error('Failed to switch session:', error);
                if (teamContent) {
                    teamContent.innerHTML = `
            <div class="empty-state" style="min-height: 200px;">
              <p class="empty-state-title">Failed to load team data</p>
              <p class="meta-text">Please try again</p>
            </div>
          `;
                }
            }
        });
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
     * Render the Coverage Dashboard (track route).
     * @param {HTMLElement} container - Main content container
     */
    async renderCoverage(container) {
        container.innerHTML = `
          <div class="about-page">
            <h1 class="page-title" style="margin-bottom: var(--space-2);">
              <i class="fas fa-chart-line" style="color: var(--color-brand); margin-right: 8px;"></i>
              Content Coverage Tracker
            </h1>
            <p class="meta-text" style="margin-bottom: var(--space-6);">
              Select a target session and click a department to perform a live scan of its Drive structure.
            </p>
            
            <div style="margin-bottom: var(--space-6); max-width: 300px;">
                <label style="display:block; font-size: 0.8rem; font-weight: 600; margin-bottom: 4px; color: var(--color-text-secondary);">Target Session</label>
                <select id="target-session-select" class="search-input" style="width: 100%; border: 1px solid var(--color-border); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text-primary);" aria-label="Select target session">
                  <option value="">Loading sessions...</option>
                </select>
            </div>

            <div id="coverage-departments" class="coverage-accordion-group">
              <div class="loading"><div class="spinner"></div><p>Loading departments...</p></div>
            </div>
          </div>
        `;

        try {
          const teamData = await this.fetchTeamData();
            const departments = await driveAPI.fetchDepartments();
            const deptContainer = document.getElementById('coverage-departments');
          const sessionSelect = document.getElementById('target-session-select');
            if (!deptContainer) return;

          const sessions = (teamData && Array.isArray(teamData.sessions)) ? teamData.sessions : [];
          const selectedSession = (teamData && teamData.session) ? teamData.session : (sessions[0] || '');

          if (sessionSelect) {
            if (sessions.length > 0) {
              sessionSelect.innerHTML = sessions.map(session => {
                const selected = session === selectedSession ? ' selected' : '';
                return `<option value="${session}"${selected}>${session}</option>`;
              }).join('');
            } else {
              const fallbackSession = (CONFIG.about && CONFIG.about.session) ? CONFIG.about.session : '';
              if (fallbackSession) {
                sessionSelect.innerHTML = `<option value="${fallbackSession}">${fallbackSession}</option>`;
              } else {
                sessionSelect.innerHTML = '<option value="">No sessions available</option>';
              }
            }
          }

            if (!departments || departments.length === 0) {
                deptContainer.innerHTML = this.renderEmptyState('No departments found', 'Cannot generate coverage report.');
                return;
            }

            deptContainer.innerHTML = departments.map(dept => `
              <div class="coverage-accordion" data-dept="${dept}">
                <button class="coverage-accordion__header">
                  <span><i data-lucide="${this.getDepartmentLucideIcon(dept)}"></i> ${dept}</span>
                  <i class="fas fa-chevron-down coverage-accordion__icon"></i>
                </button>
                <div class="coverage-accordion__body" style="display: none;">
                   <!-- Coverage table will load here -->
                </div>
              </div>
            `).join('');

            if (typeof lucide !== 'undefined') {
                setTimeout(() => lucide.createIcons(), 0);
            }

            // Attach listeners to accordions
            deptContainer.querySelectorAll('.coverage-accordion__header').forEach(header => {
                header.addEventListener('click', async (e) => {
                    const accordion = e.currentTarget.closest('.coverage-accordion');
                    const body = accordion.querySelector('.coverage-accordion__body');
                    const dept = accordion.dataset.dept;
                    const icon = e.currentTarget.querySelector('.coverage-accordion__icon');
                    
                    // Force refresh if they changed the session input
                    const currentSession = sessionSelect && sessionSelect.value
                      ? sessionSelect.value.trim()
                      : '';
                    if (!currentSession) {
                      app.showToast('Please select a target session', 'error');
                        return;
                    }

                    if (body.dataset.scannedSession !== currentSession) {
                        body.dataset.loaded = "false";
                    }

                    const isOpen = body.style.display === 'block';

                    // Close all others
                    deptContainer.querySelectorAll('.coverage-accordion__body').forEach(b => b.style.display = 'none');
                    deptContainer.querySelectorAll('.coverage-accordion__icon').forEach(i => i.style.transform = 'rotate(0deg)');

                    if (!isOpen) {
                        body.style.display = 'block';
                        icon.style.transform = 'rotate(180deg)';
                        
                        // If not loaded yet (or session changed), fetch it
                        if (body.dataset.loaded !== "true") {
                            body.innerHTML = '<div class="loading" style="padding: 2rem 0;"><div class="spinner"></div><p>Scanning Drive...</p></div>';
                            try {
                                const response = await fetch(`${CONFIG.apiBase}/coverage?department=${encodeURIComponent(dept)}&session=${encodeURIComponent(currentSession)}`);
                                if (!response.ok) {
                                   const errData = await response.json().catch(() => ({}));
                                   throw new Error(errData.error || 'Failed to fetch');
                                }
                                const data = await response.json();
                                body.innerHTML = this._renderCoverageTable(data.data);
                                body.dataset.loaded = "true";
                                body.dataset.scannedSession = currentSession;
                            } catch (err) {
                                body.innerHTML = `<div class="empty-state"><p class="empty-state-title">Scan Failed</p><p class="meta-text">${err.message}</p></div>`;
                            }
                        }
                    }
                });
            });

        } catch (error) {
            container.innerHTML = this.renderErrorState(error.message);
        }
    }

    /**
     * Renders the coverage data table for a department.
     * @param {Array} coverageData - Coverage tree data returned from new API.
     */
    _renderCoverageTable(coverageData) {
        if (!coverageData || coverageData.length === 0) {
            return `<div class="empty-state" style="min-height: 150px; padding: 2rem;"><p class="meta-text">No data found in this department.</p></div>`;
        }

      const summary = {
        uploaded: 0,
        emptyFolder: 0,
        missingFolder: 0,
        other: 0
      };

      coverageData.forEach(item => {
        if (item.status === 'uploaded') {
          summary.uploaded += 1;
        } else if (item.status === 'empty-folder') {
          summary.emptyFolder += 1;
        } else if (item.status === 'missing-folder') {
          summary.missingFolder += 1;
        } else {
          summary.other += 1;
        }
      });

        let html = '<div class="coverage-table-container"><table class="coverage-table">';
      html = `
        <div class="coverage-summary">
        <span class="status-yes"><i class="fas fa-check-circle"></i> Uploaded: ${summary.uploaded}</span>
        <span class="status-empty"><i class="fas fa-folder-open"></i> Empty: ${summary.emptyFolder}</span>
        <span class="status-missing"><i class="fas fa-folder-times"></i> Missing: ${summary.missingFolder}</span>
        ${summary.other > 0 ? `<span class="status-no"><i class="fas fa-circle-question"></i> Other: ${summary.other}</span>` : ''}
        </div>
        <div class="coverage-table-container"><table class="coverage-table">
      `;
        html += '<thead><tr><th style="width: 30%">Level</th><th style="width: 40%">Semester</th><th>Status</th></tr></thead>';
        html += '<tbody>';

        // Group the data by Level
        const grouped = {};
        coverageData.forEach(item => {
            if (!grouped[item.level]) grouped[item.level] = [];
            grouped[item.level].push(item);
        });

        for (const [levelName, items] of Object.entries(grouped)) {
            items.forEach((item, idx) => {
              let statusHtml = '<span class="status-no"><i class="fas fa-circle-question"></i> Unknown</span>';

              if (item.status === 'uploaded') {
                statusHtml = '<span class="status-yes"><i class="fas fa-check-circle"></i> Uploaded</span>';
              } else if (item.status === 'empty-folder') {
                statusHtml = '<span class="status-empty"><i class="fas fa-folder-open"></i> Session Found, No PDFs</span>';
              } else if (item.status === 'missing-folder') {
                statusHtml = '<span class="status-missing"><i class="fas fa-folder-times"></i> Session Folder Missing</span>';
              }

                html += `<tr>
                    ${idx === 0 ? `<td rowspan="${items.length}" style="vertical-align: middle; border-right: 1px solid var(--color-border); font-weight: 600; color: var(--color-brand);">${item.level}</td>` : ''}
                    <td>${item.semester}</td>
                    <td>${statusHtml}</td>
                </tr>`;
            });
        }

        html += '</tbody></table></div>';
        return html;
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
        <div class="empty-state-icon-wrap">
          <i class="far fa-folder-open"></i>
        </div>
        <p class="empty-state-title">${title}</p>
        <p class="meta-text">${message}</p>
        <button onclick="app.handleRefresh()" class="btn-secondary">
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
        <p class="meta-text">${message || 'An error occurred'}</p>
        <button onclick="app.handleRefresh()" class="btn-secondary">
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
        <button onclick="appNavigator.goHome()" class="btn-secondary">
          <i class="fas fa-house"></i> Go Home
        </button>
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
            'Accounting': 'far fa-chart-line',
            'Architecture': 'far fa-building',
            'Biochemistry': 'far fa-dna',
            'Business Administration': 'far fa-briefcase',
            'Computer Science': 'far fa-laptop-code',
            'Criminology': 'far fa-gavel',
            'Cybersecurity': 'far fa-shield-alt',
            'Economics': 'far fa-chart-bar',
            'Human Anatomy': 'far fa-heartbeat',
            'Human Physiology': 'far fa-brain',
            'Industrial Chemistry': 'far fa-flask',
            'International Relations': 'far fa-globe',
            'Jupeb': 'far fa-graduation-cap',
            'Law': 'far fa-balance-scale',
            'Mass Communication': 'far fa-tv',
            'Microbiology': 'far fa-microscope',
            'Nursing': 'far fa-user-md',
            'Political Science': 'far fa-landmark',
            'Psychology': 'far fa-brain',
            'Software Engineering': 'far fa-cogs'
        };

        if (icons[dept]) return icons[dept];

        const deptLower = dept.toLowerCase();
        if (deptLower.includes('computer') || deptLower.includes('software') || deptLower.includes('tech')) return 'far fa-laptop-code';
        if (deptLower.includes('business') || deptLower.includes('management') || deptLower.includes('admin')) return 'far fa-briefcase';
        if (deptLower.includes('law') || deptLower.includes('legal')) return 'far fa-balance-scale';
        if (deptLower.includes('medicine') || deptLower.includes('medical') || deptLower.includes('health')) return 'far fa-heartbeat';
        if (deptLower.includes('engineering')) return 'far fa-cogs';
        if (deptLower.includes('science')) return 'far fa-flask';
        if (deptLower.includes('art') || deptLower.includes('design')) return 'far fa-palette';
        if (deptLower.includes('education') || deptLower.includes('teaching')) return 'far fa-chalkboard-teacher';
        if (deptLower.includes('communication') || deptLower.includes('media')) return 'far fa-tv';
        if (deptLower.includes('finance') || deptLower.includes('accounting') || deptLower.includes('banking')) return 'far fa-chart-line';

        return 'far fa-graduation-cap';
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
