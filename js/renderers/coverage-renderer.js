/* exported CoverageRenderer */
// CoverageRenderer module
// Extracts track-page coverage rendering and table generation from the main Renderer.

class CoverageRenderer {
  /**
   * @param {Renderer} renderer - Shared renderer facade with escape helpers and API methods.
   */
  constructor(renderer) {
    this.renderer = renderer;
  }

  /**
   * Render the Coverage Dashboard (track route).
   * @param {HTMLElement} container - Main content container.
   * @param {{forceRefresh?: boolean}} [options] - Render options.
   */
  async renderCoverage(container, options = {}) {
    const { forceRefresh = false } = options;
    const renderer = this.renderer;

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
      const teamData = await renderer.fetchTeamData(undefined, { forceRefresh });
      const departments = await driveAPI.fetchDepartments(forceRefresh);
      const deptContainer = document.getElementById('coverage-departments');
      const sessionSelect = document.getElementById('target-session-select');
      if (!deptContainer) return;

      const sessions = teamData && Array.isArray(teamData.sessions) ? teamData.sessions : [];
      const selectedSession = teamData && teamData.session ? teamData.session : sessions[0] || '';

      if (sessionSelect) {
        if (sessions.length > 0) {
          sessionSelect.innerHTML = sessions
            .map((session) => {
              const selected = session === selectedSession ? ' selected' : '';
              return `<option value="${renderer.escapeAttr(session)}"${selected}>${renderer.escapeHtml(session)}</option>`;
            })
            .join('');
        } else {
          const fallbackSession = CONFIG.about && CONFIG.about.session ? CONFIG.about.session : '';
          if (fallbackSession) {
            sessionSelect.innerHTML = `<option value="${renderer.escapeAttr(fallbackSession)}">${renderer.escapeHtml(fallbackSession)}</option>`;
          } else {
            sessionSelect.innerHTML = '<option value="">No sessions available</option>';
          }
        }
      }

      if (!departments || departments.length === 0) {
        deptContainer.innerHTML = renderer.renderEmptyState(
          'No departments found',
          'Cannot generate coverage report.'
        );
        return;
      }

      deptContainer.innerHTML = departments
        .map(
          (dept) => `
        <div class="coverage-accordion" data-dept="${renderer.escapeAttr(dept)}">
          <button class="coverage-accordion__header">
            <span><i data-lucide="${renderer.getDepartmentLucideIcon(dept)}"></i> ${renderer.escapeHtml(dept)}</span>
            <i class="fas fa-chevron-down coverage-accordion__icon"></i>
          </button>
          <div class="coverage-accordion__body" style="display: none;">
            <!-- Coverage table will load here -->
          </div>
        </div>
      `
        )
        .join('');

      if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 0);
      }

      deptContainer.querySelectorAll('.coverage-accordion__header').forEach((header) => {
        header.addEventListener('click', async (e) => {
          const accordion = e.currentTarget.closest('.coverage-accordion');
          const body = accordion.querySelector('.coverage-accordion__body');
          const dept = accordion.dataset.dept;
          const icon = e.currentTarget.querySelector('.coverage-accordion__icon');

          const currentSession = sessionSelect && sessionSelect.value ? sessionSelect.value.trim() : '';
          if (!currentSession) {
            app.showToast('Please select a target session', 'error');
            return;
          }

          if (body.dataset.scannedSession !== currentSession) {
            body.dataset.loaded = 'false';
          }

          const isOpen = body.style.display === 'block';

          deptContainer
            .querySelectorAll('.coverage-accordion__body')
            .forEach((b) => (b.style.display = 'none'));
          deptContainer
            .querySelectorAll('.coverage-accordion__icon')
            .forEach((i) => (i.style.transform = 'rotate(0deg)'));

          if (!isOpen) {
            body.style.display = 'block';
            icon.style.transform = 'rotate(180deg)';

            if (body.dataset.loaded !== 'true') {
              body.innerHTML =
                '<div class="loading" style="padding: 2rem 0;"><div class="spinner"></div><p>Scanning Drive...</p></div>';
              try {
                const queryParts = [
                  `department=${encodeURIComponent(dept)}`,
                  `session=${encodeURIComponent(currentSession)}`
                ];

                if (forceRefresh) {
                  queryParts.push('refresh=1');
                }

                const coverageUrl = `${CONFIG.apiBase}/coverage?${queryParts.join('&')}`;
                const response = await fetch(
                  coverageUrl,
                  forceRefresh ? { cache: 'no-store' } : undefined
                );
                if (!response.ok) {
                  const errData = await response.json().catch(() => ({}));
                  throw new Error(errData.error || 'Failed to fetch');
                }
                const data = await response.json();
                body.innerHTML = this._renderCoverageTable(data.data);
                body.dataset.loaded = 'true';
                body.dataset.scannedSession = currentSession;
              } catch (err) {
                body.innerHTML = `<div class="empty-state"><p class="empty-state-title">Scan Failed</p><p class="meta-text">${renderer.escapeHtml(err.message)}</p></div>`;
              }
            }
          }
        });
      });
    } catch (error) {
      container.innerHTML = renderer.renderErrorState(error.message);
    }
  }

  /**
   * Renders the coverage data table for a department.
   * @param {Array} coverageData - Coverage tree data returned from new API.
   * @returns {string} HTML string.
   */
  _renderCoverageTable(coverageData) {
    const renderer = this.renderer;

    if (!coverageData || coverageData.length === 0) {
      return '<div class="empty-state" style="min-height: 150px; padding: 2rem;"><p class="meta-text">No data found in this department.</p></div>';
    }

    const createSummary = () => ({
      uploaded: 0,
      emptyFolder: 0,
      missingFolder: 0,
      other: 0
    });

    const buildSummaryHtml = (title, summary) => `
      <div class="coverage-summary-card">
        <p class="coverage-summary-title">${renderer.escapeHtml(title)}</p>
        <div class="coverage-summary">
          <span class="status-yes"><i class="fas fa-check-circle"></i> Uploaded: ${summary.uploaded}</span>
          <span class="status-empty"><i class="fas fa-folder-open"></i> Empty: ${summary.emptyFolder}</span>
          <span class="status-missing"><i class="fas fa-folder-times"></i> Missing: ${summary.missingFolder}</span>
          ${
            summary.other > 0
              ? `<span class="status-no"><i class="fas fa-circle-question"></i> Other: ${summary.other}</span>`
              : ''
          }
        </div>
      </div>
    `;

    const summaryBySemester = {
      '1st Semester': createSummary(),
      '2nd Semester': createSummary()
    };

    coverageData.forEach((item) => {
      const semesterLabel = (item.semester || '').trim();
      if (!summaryBySemester[semesterLabel]) {
        summaryBySemester[semesterLabel] = createSummary();
      }

      const summary = summaryBySemester[semesterLabel];

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

    const hasFirstOrSecondSemester = coverageData.some((item) => {
      const semesterLabel = (item.semester || '').trim();
      return semesterLabel === '1st Semester' || semesterLabel === '2nd Semester';
    });

    const summaryCardsHtml = hasFirstOrSecondSemester
      ? `
          <div class="coverage-summary-grid">
            ${buildSummaryHtml('1st Semester Summary', summaryBySemester['1st Semester'])}
            ${buildSummaryHtml('2nd Semester Summary', summaryBySemester['2nd Semester'])}
          </div>
        `
      : `
          <div class="coverage-summary-grid coverage-summary-grid--single">
            ${buildSummaryHtml('Coverage Summary', summaryBySemester['Full Year'] || createSummary())}
          </div>
        `;

    let html = '<div class="coverage-table-container"><table class="coverage-table">';
    html = `
        ${summaryCardsHtml}
        <div class="coverage-table-container"><table class="coverage-table">
      `;
    html +=
      '<thead><tr><th style="width: 30%">Level</th><th style="width: 40%">Semester</th><th>Status</th></tr></thead>';
    html += '<tbody>';

    const grouped = {};
    coverageData.forEach((item) => {
      if (!grouped[item.level]) grouped[item.level] = [];
      grouped[item.level].push(item);
    });

    for (const [_levelName, items] of Object.entries(grouped)) {
      items.forEach((item, idx) => {
        let statusHtml =
          '<span class="status-no"><i class="fas fa-circle-question"></i> Unknown</span>';

        if (item.status === 'uploaded') {
          statusHtml =
            '<span class="status-yes"><i class="fas fa-check-circle"></i> Uploaded</span>';
        } else if (item.status === 'empty-folder') {
          statusHtml =
            '<span class="status-empty"><i class="fas fa-folder-open"></i> Session Found, No PDFs</span>';
        } else if (item.status === 'missing-folder') {
          statusHtml =
            '<span class="status-missing"><i class="fas fa-folder-times"></i> Session Folder Missing</span>';
        }

        html += `<tr>
                  ${
                    idx === 0
                      ? `<td rowspan="${items.length}" style="vertical-align: middle; border-right: 1px solid var(--color-border); font-weight: 600; color: var(--color-brand);">${renderer.escapeHtml(item.level)}</td>`
                      : ''
                  }
                  <td>${renderer.escapeHtml(item.semester)}</td>
                    <td>${statusHtml}</td>
                </tr>`;
      });
    }

    html += '</tbody></table></div>';
    return html;
  }
}

// Export for use in tests/Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CoverageRenderer };
}
