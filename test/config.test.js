const { CONFIG } = require('../js/config');

describe('CONFIG', () => {
    test('has required app metadata', () => {
        expect(CONFIG.app.name).toBe('Caleb University Resource Bank');
        expect(CONFIG.app.shortName).toBe('CURB');
    });

    test('has version string in the format the build stamper rewrites', () => {
        expect(CONFIG.version).toBeTruthy();
        expect(typeof CONFIG.version).toBe('string');

        const source = require('fs').readFileSync(require.resolve('../js/config'), 'utf8');
        expect(source).toMatch(/version: "[^"]*"/);
    });

    test('has API base and about-page fallback data', () => {
        expect(CONFIG.apiBase).toBe('/api');
        expect(CONFIG.about.session).toBeTruthy();
        expect(CONFIG.about.sessions).toContain(CONFIG.about.session);
        expect(Array.isArray(CONFIG.about.executives)).toBe(true);
        expect(Array.isArray(CONFIG.about.departmentReps)).toBe(true);
        expect(CONFIG.about.mission).toBeTruthy();
    });

    test('does NOT have levelExceptions (moved to server-side)', () => {
        expect(CONFIG.levelExceptions).toBeUndefined();
    });
});
