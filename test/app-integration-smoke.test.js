/** @jest-environment jsdom */

describe('route-level integration smoke tests', () => {
  let App;

  function setupDom() {
    document.body.innerHTML = `
      <button id="refresh-btn" type="button">Refresh</button>
      <main id="main-content"></main>
      <div id="breadcrumb"></div>
    `;
  }

  beforeEach(() => {
    jest.resetModules();
    setupDom();

    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'loading'
    });

    global.CONFIG = {
      version: '1.0.0',
      api: { endpoint: '/api/browse' },
      apiBase: '/api',
      about: { session: '2025/26' }
    };

    global.localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };

    global.pathCache = {
      clearAll: jest.fn(),
      invalidatePath: jest.fn()
    };

    global.pwaManager = {
      setup: jest.fn(),
      installApp: jest.fn()
    };

    global.emailGate = {
      isVerified: jest.fn(() => true),
      show: jest.fn().mockResolvedValue()
    };

    global.driveAPI = {
      init: jest.fn().mockResolvedValue(true),
      fetchDepartments: jest.fn().mockResolvedValue(['Computer Science'])
    };

    global.appNavigator = {
      getCurrentRoute: jest.fn(() => ({ view: 'home' })),
      updateTitle: jest.fn(),
      goHome: jest.fn(),
      init: jest.fn(),
      addListener: jest.fn()
    };

    global.renderer = {
      renderBreadcrumbs: jest.fn(),
      renderHome: jest.fn().mockResolvedValue(['Computer Science']),
      renderAboutPage: jest.fn().mockResolvedValue(undefined),
      renderCoverage: jest.fn().mockResolvedValue(undefined),
      renderLevels: jest.fn().mockResolvedValue(undefined),
      renderSemesters: jest.fn().mockResolvedValue(undefined),
      renderSessions: jest.fn().mockResolvedValue(undefined),
      renderSessionContent: jest.fn().mockResolvedValue(undefined),
      renderFiles: jest.fn().mockResolvedValue(undefined),
      renderNotFound: jest.fn(() => '<div>Not Found</div>'),
      renderErrorState: jest.fn((msg) => `<div>${msg}</div>`)
    };

    global.navigator.onLine = true;

    ({ App } = require('../js/app'));
  });

  test('home render wires route to department fetch/render', async () => {
    const app = new App();

    await app.handleRouteChange();

    expect(global.renderer.renderBreadcrumbs).toHaveBeenCalledTimes(1);
    expect(global.appNavigator.updateTitle).toHaveBeenCalledTimes(1);
    const view = document.querySelector('#main-content > .route-view');
    expect(view).not.toBeNull();
    expect(global.renderer.renderHome).toHaveBeenCalledWith(view, { forceRefresh: false });
  });

  test('a slow older navigation cannot overwrite the newer view', async () => {
    let finishSlowRender;
    global.renderer.renderLevels.mockImplementation((container) => new Promise((resolve) => {
      finishSlowRender = () => {
        container.innerHTML = '<p id="stale">Levels</p>';
        resolve();
      };
    }));
    global.renderer.renderHome.mockImplementation(async (container) => {
      container.innerHTML = '<p id="fresh">Home</p>';
    });

    const app = new App();

    global.appNavigator.getCurrentRoute.mockReturnValue({ view: 'levels', department: 'Law' });
    const slowNavigation = app.handleRouteChange();

    global.appNavigator.getCurrentRoute.mockReturnValue({ view: 'home' });
    await app.handleRouteChange();

    finishSlowRender();
    await slowNavigation;

    expect(document.getElementById('fresh')).not.toBeNull();
    expect(document.getElementById('stale')).toBeNull();
  });

  test('refresh reports failure when the view fails to render', async () => {
    global.renderer.renderHome.mockRejectedValue(new Error('Server error: 500'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const app = new App();
    app.showToast = jest.fn();

    await app.handleRefresh();

    expect(app.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(app.showToast).not.toHaveBeenCalledWith(expect.any(String), 'success');
  });

  test('refresh on a Jupeb files route invalidates the full path', async () => {
    global.appNavigator.getCurrentRoute.mockReturnValue({
      view: 'files',
      department: 'Jupeb',
      level: 'Science',
      semester: null,
      session: '2024~25 Session',
      category: null
    });

    const app = new App();
    app.handleRouteChange = jest.fn().mockResolvedValue(true);
    app.showToast = jest.fn();

    await app.handleRefresh();

    expect(global.pathCache.invalidatePath).toHaveBeenCalledWith('/Jupeb/Science/2024~25 Session');
  });

  test('deep navigation route renders files view', async () => {
    global.appNavigator.getCurrentRoute.mockReturnValue({
      view: 'files',
      department: 'Computer Science',
      level: '100 Level',
      semester: '1st Semester',
      session: '2025~26 Session'
    });

    const app = new App();
    await app.handleRouteChange();

    expect(global.renderer.renderFiles).toHaveBeenCalledWith(
      document.querySelector('#main-content > .route-view'),
      expect.objectContaining({
        view: 'files',
        department: 'Computer Science',
        level: '100 Level',
        semester: '1st Semester',
        session: '2025~26 Session'
      }),
      { forceRefresh: false }
    );
  });

  test('session navigation route renders adaptive session content', async () => {
    global.appNavigator.getCurrentRoute.mockReturnValue({
      view: 'session',
      department: 'Cybersecurity',
      level: '300 Level',
      semester: '1st Semester',
      session: '2025~26 Session'
    });

    const app = new App();
    await app.handleRouteChange();

    expect(global.renderer.renderSessionContent).toHaveBeenCalledWith(
      document.querySelector('#main-content > .route-view'),
      expect.objectContaining({
        view: 'session',
        department: 'Cybersecurity',
        level: '300 Level',
        semester: '1st Semester',
        session: '2025~26 Session'
      }),
      { forceRefresh: false }
    );
  });

  test('about route dispatches to about renderer', async () => {
    global.appNavigator.getCurrentRoute.mockReturnValue({ view: 'about' });

    const app = new App();
    await app.handleRouteChange();

    expect(global.renderer.renderAboutPage).toHaveBeenCalledWith(
      document.querySelector('#main-content > .route-view'),
      { forceRefresh: false }
    );
  });

  test('refresh action forces refresh path on controller route handling', async () => {
    global.appNavigator.getCurrentRoute.mockReturnValue({ view: 'track' });

    const app = new App();
    app.handleRouteChange = jest.fn().mockResolvedValue(undefined);
    app.showToast = jest.fn();

    await app.handleRefresh();

    expect(global.pathCache.invalidatePath).toHaveBeenCalledWith('/');
    expect(app.handleRouteChange).toHaveBeenCalledWith({ forceRefresh: true });
    expect(app.showToast).toHaveBeenCalledWith('Content refreshed successfully!', 'success');
  });

});

describe('track page coverage scan integration smoke', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<main id="main-content"></main>';

    global.CONFIG = {
      apiBase: '/api',
      about: { session: '2025/26' }
    };

    global.lucide = undefined;

    global.app = {
      showToast: jest.fn()
    };

    global.driveAPI = {
      fetchDepartments: jest.fn().mockResolvedValue(['Computer Science'])
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [{ level: '100 Level', semester: '1st Semester', status: 'uploaded' }]
      })
    });
  });

  test('track page scan call includes refresh=1 in force mode', async () => {
    const { CoverageRenderer } = require('../js/renderers/coverage-renderer');

    const rendererFacade = {
      fetchTeamData: jest.fn().mockResolvedValue({
        session: '2025/26',
        sessions: ['2025/26']
      }),
      escapeAttr: (value) => String(value),
      escapeHtml: (value) => String(value),
      getDepartmentLucideIcon: () => 'book-open',
      renderEmptyState: jest.fn(() => '<div>Empty</div>'),
      renderErrorState: jest.fn((msg) => `<div>${msg}</div>`)
    };

    const coverageRenderer = new CoverageRenderer(rendererFacade);
    const container = document.getElementById('main-content');

    await coverageRenderer.renderCoverage(container, { forceRefresh: true });

    const accordionHeader = container.querySelector('.coverage-accordion__header');
    expect(accordionHeader).not.toBeNull();

    accordionHeader.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('refresh=1'),
      expect.objectContaining({ cache: 'no-store' })
    );
  });
});
