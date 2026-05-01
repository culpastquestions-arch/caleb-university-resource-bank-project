/* exported TeamRenderer */
// TeamRenderer module
// Extracts About/Team page rendering and interactions from the main Renderer.

class TeamRenderer {
  /**
   * @param {Renderer} renderer - Shared renderer facade with escape helpers and API methods.
   */
  constructor(renderer) {
    this.renderer = renderer;
  }

  /**
   * Render the About Us page with session picker.
   * @param {HTMLElement} container - Main content container.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   */
  async renderAboutPage(container, options = {}) {
    const { forceRefresh = false } = options;
    const about = CONFIG.about;

    container.innerHTML = this.renderAboutSkeleton();

    const teamData = await this.renderer.fetchTeamData(undefined, { forceRefresh });

    // Store reference for session switching.
    this.renderer._aboutContainer = container;
    this.renderer._aboutMission = about.mission;

    this._renderAboutFull(container, about, teamData);
    this.attachTeamPhotoFallbackHandlers(container);
  }

  /**
   * Render the full about page structure (team + mission + CTA).
   * @param {HTMLElement} container - Main content container.
   * @param {Object} about - CONFIG.about data.
   * @param {Object} teamData - Fetched team data with session info.
   */
  _renderAboutFull(container, about, teamData) {
    const renderer = this.renderer;

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
              <p class="about-mission__text">${renderer.escapeHtml(about.mission)}</p>
            </div>
          </div>
        </section>

      </div>
    `;

    this._attachSessionListeners();
  }

  /**
   * Render the session picker (horizontal pill tabs).
   * @param {Array<string>} sessions - Available sessions.
   * @param {string} activeSession - Currently active session.
   * @returns {string} HTML string.
   */
  _renderSessionPicker(sessions, activeSession) {
    const renderer = this.renderer;

    if (!sessions || sessions.length <= 1) {
      const label = activeSession || sessions[0] || '';
      return label
        ? `<p class="about-section__subtitle"><i class="fas fa-calendar-alt"></i> ${renderer.escapeHtml(label)} Session Team</p>`
        : '';
    }

    return `
      <div class="session-picker" id="session-picker">
        ${sessions
          .map(
            (s) => `
          <button class="session-picker__tab${s === activeSession ? ' session-picker__tab--active' : ''}"
                  data-session="${renderer.escapeAttr(s)}"
                  aria-label="View ${renderer.escapeAttr(s)} team"
                  type="button">
            ${renderer.escapeHtml(s)}
          </button>
        `
          )
          .join('')}
      </div>
    `;
  }

  /**
   * Render the team content (executives + reps grids).
   * @param {Object} teamData - Team data with executives and departmentReps.
   * @returns {string} HTML string.
   */
  _renderTeamContent(teamData) {
    const renderer = this.renderer;
    const roleColors = { executive: '#1E88E5', rep: '#26A69A' };
    const invalidNames = new Set(['tbd', 'coming soon', 'tba', 'n/a', '-']);

    const isValidName = (value) => {
      if (!value || typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (!trimmed) return false;
      return !invalidNames.has(trimmed.toLowerCase());
    };

    const getInitials = (name) => {
      if (!isValidName(name)) return '';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const renderTeamCard = (member, type = 'rep', index = 0) => {
      const name = member.name ? String(member.name).trim() : '';
      const initials = getInitials(name);

      const role = member.role || (member.department ? `${member.department} Rep` : 'Team Member');
      const color = member.color || roleColors[type];
      const photoUrl = member.photoUrl || member.photourl || '';
      const safePhotoUrl = renderer.escapeAttr(renderer.safeUrl(photoUrl, ''));
      const safeAlt = renderer.escapeAttr(name);
      const safeName = renderer.escapeHtml(name);
      const safeRole = renderer.escapeHtml(role);
      const safeInitials = renderer.escapeHtml(initials);

       const avatarContent = photoUrl
         ? `<img src="${safePhotoUrl}" alt="${safeAlt}" class="team-card__photo" data-photo-src="${safePhotoUrl}" loading="lazy" decoding="async">
           <span class="team-card__initials">${safeInitials}</span>`
         : `<span class="team-card__initials">${safeInitials}</span>`;

      const delay = Math.min(index * 0.04, 0.4);

      return `
        <div class="team-card team-card--${type}" style="animation-delay: ${delay}s">
          <div class="team-card__avatar" style="background-color: ${color}">
            ${avatarContent}
          </div>
          <div class="team-card__info">
            <h3 class="team-card__name">${safeName}</h3>
            <p class="team-card__role">${safeRole}</p>
          </div>
        </div>
      `;
    };

    const executiveMembers = Array.isArray(teamData.executives)
      ? teamData.executives.filter(member => isValidName(member?.name))
      : [];
    const repMembers = Array.isArray(teamData.departmentReps)
      ? teamData.departmentReps.filter(member => isValidName(member?.name))
      : [];
    const hasExecutives = executiveMembers.length > 0;
    const hasReps = repMembers.length > 0;
    const topExecutives = executiveMembers.slice(0, 2);
    const remainingExecutives = executiveMembers.slice(2);
    let bottomExecutiveColumns = Math.min(Math.max(remainingExecutives.length, 1), 5);
    if (remainingExecutives.length === 6) {
      bottomExecutiveColumns = 3;
    }

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
      ${
        hasExecutives
          ? `
        <div class="team-content__section">
          <h3 class="team-content__heading">
            <i class="fas fa-users-cog"></i>
            Executive Team
          </h3>
          <div class="about-team-grid about-team-grid--executives about-team-grid--executives-top">
            ${topExecutives.map((exec, i) => renderTeamCard(exec, 'executive', i)).join('')}
          </div>
          ${
            remainingExecutives.length
              ? `
            <div class="about-team-grid about-team-grid--executives about-team-grid--executives-bottom" style="--exec-bottom-columns: ${bottomExecutiveColumns};">
              ${remainingExecutives.map((exec, i) => renderTeamCard(exec, 'executive', i + topExecutives.length)).join('')}
            </div>
          `
              : ''
          }
        </div>
      `
          : ''
      }

      ${
        hasReps
          ? `
        <div class="team-content__section">
          <h3 class="team-content__heading">
            <i class="fas fa-user-friends"></i>
            Department Representatives
          </h3>
          <div class="about-team-grid about-team-grid--reps">
            ${repMembers.map((rep, i) => renderTeamCard(rep, 'rep', i)).join('')}
          </div>
        </div>
      `
          : ''
      }
    `;
  }

  /**
   * Attach CSP-safe image fallback handlers for team photos.
   * @param {HTMLElement} scope - Container to scan.
   */
  attachTeamPhotoFallbackHandlers(scope) {
    if (!scope) return;

    const photos = scope.querySelectorAll('.team-card__photo');
    photos.forEach((img) => {
      if (img.dataset.errorBound === '1') return;
      img.dataset.errorBound = '1';

      const initialSrc = img.dataset.photoSrc || img.src || '';
      const idMatch = initialSrc.match(/[?&]id=([^&]+)/) || initialSrc.match(/\/d\/([^/]+)/);
      if (idMatch && idMatch[1]) {
        img.dataset.driveId = idMatch[1];
      }

      img.addEventListener('load', () => {
        const initials = img.nextElementSibling;
        if (initials && initials.classList.contains('team-card__initials')) {
          initials.classList.add('team-card__initials--hidden');
        }
      });

      img.addEventListener('error', () => {
        const driveId = img.dataset.driveId || '';
        const fallbackUrls = driveId
          ? [
            `https://drive.google.com/uc?export=view&id=${driveId}`,
            `https://drive.google.com/uc?export=download&id=${driveId}`,
            `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`
          ]
          : [];

        const stage = Number.parseInt(img.dataset.fallbackStage || '0', 10);
        if (fallbackUrls.length > 0 && stage < fallbackUrls.length) {
          const nextUrl = fallbackUrls[stage];
          img.dataset.fallbackStage = String(stage + 1);
          if (nextUrl && img.src !== nextUrl) {
            img.src = nextUrl;
            return;
          }
        }

        img.style.display = 'none';
        const initials = img.nextElementSibling;
        if (initials && initials.classList.contains('team-card__initials')) {
          initials.classList.remove('team-card__initials--hidden');
        }
      });
    });
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

      picker
        .querySelectorAll('.session-picker__tab')
        .forEach((t) => t.classList.remove('session-picker__tab--active'));
      tab.classList.add('session-picker__tab--active');

      const teamContent = document.getElementById('team-content');
      if (teamContent) {
        teamContent.innerHTML = `
          <div class="loading" style="padding: var(--space-8) 0;">
            <div class="spinner"></div>
            <p>Loading team...</p>
          </div>
        `;
      }

      try {
        const teamData = await this.renderer.fetchTeamData(session);
        if (teamContent) {
          teamContent.innerHTML = this._renderTeamContent(teamData);
          this.attachTeamPhotoFallbackHandlers(teamContent);
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
            ${Array(5)
              .fill('<div class="skeleton-loading" style="height: 140px; border-radius: 12px;"></div>')
              .join('')}
          </div>
        </section>
      </div>
    `;
  }
}
