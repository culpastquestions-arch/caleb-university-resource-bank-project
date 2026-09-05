// Mock window and CONFIG for navigation tests
global.window = {
    location: { hash: '', href: 'http://localhost/' },
    addEventListener: jest.fn(),
    scrollTo: jest.fn()
};

global.CONFIG = {
    app: { name: 'Caleb University Resource Bank' }
};

global.document = {
    title: ''
};

// Load navigation module
const { Navigator } = require('../js/navigation');

let nav;

beforeEach(() => {
    window.location.hash = '';
    nav = new Navigator();
});

describe('encodeSegment and decodeSegment', () => {
    const { encodeSegment, decodeSegment, displayName } = require('../js/navigation');

    test('encodeSegment replaces / with ~ and URI-encodes', () => {
        expect(encodeSegment('2024/25 Session')).toBe('2024~25%20Session');
    });

    test('decodeSegment URI-decodes but preserves ~', () => {
        expect(decodeSegment('2024~25%20Session')).toBe('2024~25 Session');
    });

    test('displayName converts ~ back to /', () => {
        expect(displayName('2024~25 Session')).toBe('2024/25 Session');
    });

    test('handles empty strings', () => {
        expect(encodeSegment('')).toBe('');
        expect(decodeSegment('')).toBe('');
        expect(displayName('')).toBe('');
    });

    test('handles null/undefined gracefully', () => {
        expect(encodeSegment(null)).toBe('');
        expect(decodeSegment(null)).toBe('');
        expect(displayName(null)).toBe('');
    });
});

describe('Navigator.parseRoute', () => {
    test('empty hash returns home view', () => {
        window.location.hash = '';
        const route = nav.parseRoute();
        expect(route.view).toBe('home');
        expect(route.department).toBeNull();
    });

    test('single segment returns levels view', () => {
        window.location.hash = '#/Computer Science';
        const route = nav.parseRoute();
        expect(route.view).toBe('levels');
        expect(route.department).toBe('Computer Science');
    });

    test('two segments returns semesters view for standard departments', () => {
        window.location.hash = '#/Computer Science/100 Level';
        const route = nav.parseRoute();
        expect(route.view).toBe('semesters');
        expect(route.department).toBe('Computer Science');
        expect(route.level).toBe('100 Level');
    });

    test('two segments returns sessions view for Jupeb', () => {
        window.location.hash = '#/Jupeb/Science';
        const route = nav.parseRoute();
        expect(route.view).toBe('sessions');
        expect(route.department).toBe('Jupeb');
        expect(route.level).toBe('Science');
    });

    test('three segments: standard → sessions, Jupeb → files', () => {
        // Standard
        window.location.hash = '#/Computer Science/100 Level/1st Semester';
        let route = nav.parseRoute();
        expect(route.view).toBe('sessions');
        expect(route.semester).toBe('1st Semester');

        // Jupeb
        window.location.hash = '#/Jupeb/Science/2024~25 Session';
        route = nav.parseRoute();
        expect(route.view).toBe('files');
        expect(route.session).toBe('2024~25 Session');
        expect(route.semester).toBeNull();
    });

    test('four segments returns session view for standard', () => {
        window.location.hash = '#/Computer Science/100 Level/1st Semester/2024~25 Session';
        const route = nav.parseRoute();
        expect(route.view).toBe('session');
        expect(route.department).toBe('Computer Science');
        expect(route.level).toBe('100 Level');
        expect(route.semester).toBe('1st Semester');
        expect(route.session).toBe('2024~25 Session');
        expect(route.category).toBeNull();
    });

    test('five segments returns files view with category for standard', () => {
        window.location.hash = '#/Cybersecurity/300 Level/1st Semester/2024~25 Session/Course Material';
        const route = nav.parseRoute();
        expect(route.view).toBe('files');
        expect(route.department).toBe('Cybersecurity');
        expect(route.level).toBe('300 Level');
        expect(route.semester).toBe('1st Semester');
        expect(route.session).toBe('2024~25 Session');
        expect(route.category).toBe('Course Material');
    });

    test('about route is recognized', () => {
        window.location.hash = '#/about';
        const route = nav.parseRoute();
        expect(route.view).toBe('about');
    });

    test('track route is recognized (case-insensitive)', () => {
        window.location.hash = '#/TRACK';
        const route = nav.parseRoute();
        expect(route.view).toBe('track');
        expect(route.department).toBeNull();
    });

    test('backward compatibility: fixes old session URLs with /', () => {
        window.location.hash = '#/Computer Science/100 Level/1st Semester/2024/25 Session';
        const route = nav.parseRoute();
        expect(route.view).toBe('session');
        expect(route.session).toBe('2024~25 Session');
    });
});

describe('Navigator.getPageTitle', () => {
    test('home returns base title', () => {
        window.location.hash = '';
        nav.currentRoute = nav.parseRoute();
        expect(nav.getPageTitle()).toBe('Caleb University Resource Bank');
    });

    test('about returns about title', () => {
        window.location.hash = '#/about';
        nav.currentRoute = nav.parseRoute();
        expect(nav.getPageTitle()).toBe('About Us - Caleb University Resource Bank');
    });

    test('track returns coverage tracker title', () => {
        window.location.hash = '#/track';
        nav.currentRoute = nav.parseRoute();
        expect(nav.getPageTitle()).toBe('Coverage Tracker - Caleb University Resource Bank');
    });

    test('department adds department name to title', () => {
        window.location.hash = '#/Computer Science';
        nav.currentRoute = nav.parseRoute();
        expect(nav.getPageTitle()).toContain('Computer Science');
    });
});

describe('Navigator.isValidRoute', () => {
    test('home is always valid', () => {
        window.location.hash = '';
        nav.currentRoute = nav.parseRoute();
        expect(nav.isValidRoute()).toBe(true);
    });

    test('any department name is structurally valid', () => {
        window.location.hash = '#/Anything';
        nav.currentRoute = nav.parseRoute();
        expect(nav.isValidRoute()).toBe(true);
    });

    test('track route is valid', () => {
        window.location.hash = '#/track';
        nav.currentRoute = nav.parseRoute();
        expect(nav.isValidRoute()).toBe(true);
    });
});

describe('Navigator.getBreadcrumbs and goBack with Category', () => {
    test('breadcrumbs include category when present', () => {
        window.location.hash = '#/Cybersecurity/300 Level/1st Semester/2024~25 Session/Course Material';
        nav.currentRoute = nav.parseRoute();
        const crumbs = nav.getBreadcrumbs();

        expect(crumbs.length).toBe(6);
        expect(crumbs[0].label).toBe('Home');
        expect(crumbs[1].label).toBe('Cybersecurity');
        expect(crumbs[2].label).toBe('300 Level');
        expect(crumbs[3].label).toBe('1st Semester');
        expect(crumbs[4].label).toBe('2024/25 Session');
        expect(crumbs[4].active).toBe(false);
        expect(crumbs[5].label).toBe('Course Material');
        expect(crumbs[5].active).toBe(true);
    });

    test('goBack from category returns to session route', () => {
        window.location.hash = '#/Cybersecurity/300 Level/1st Semester/2024~25 Session/Past Question';
        nav.currentRoute = nav.parseRoute();

        nav.goBack();
        expect(window.location.hash).toBe('/Cybersecurity/300%20Level/1st%20Semester/2024~25%20Session');
        expect(decodeURIComponent(window.location.hash)).toBe('/Cybersecurity/300 Level/1st Semester/2024~25 Session');
        expect(nav.getCurrentRoute().view).toBe('session');
    });

    test('goBack from session returns to semester route', () => {
        window.location.hash = '#/Cybersecurity/300 Level/1st Semester/2024~25 Session';
        nav.currentRoute = nav.parseRoute();

        nav.goBack();
        expect(window.location.hash).toBe('/Cybersecurity/300%20Level/1st%20Semester');
        expect(decodeURIComponent(window.location.hash)).toBe('/Cybersecurity/300 Level/1st Semester');
        expect(nav.getCurrentRoute().view).toBe('sessions');
    });
});
