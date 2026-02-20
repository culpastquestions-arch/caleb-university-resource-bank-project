const { CONFIG, getDepartmentColor, formatLevel } = require('../js/config');

describe('getDepartmentColor', () => {
    test('returns predefined color for known departments', () => {
        expect(getDepartmentColor('Computer Science')).toBe('#4DB6AC');
        expect(getDepartmentColor('Accounting')).toBe('#B2DFDB');
        expect(getDepartmentColor('Law')).toBe('#26A69A');
    });

    test('returns deterministic color for unknown departments', () => {
        const color1 = getDepartmentColor('New Department');
        const color2 = getDepartmentColor('New Department');
        expect(color1).toBe(color2);
    });

    test('generates different colors for different unknown departments', () => {
        const color1 = getDepartmentColor('Unknown Dept A');
        const color2 = getDepartmentColor('Unknown Dept B');
        expect(color1).not.toBe(color2);
    });

    test('generated colors are valid HSL format', () => {
        const color = getDepartmentColor('Test Department XYZ');
        expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    });

    test('handles empty string gracefully', () => {
        const color = getDepartmentColor('');
        expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    });
});

describe('formatLevel', () => {
    test('formats numeric levels correctly', () => {
        expect(formatLevel(100)).toBe('100 Level');
        expect(formatLevel(200)).toBe('200 Level');
        expect(formatLevel(400)).toBe('400 Level');
    });

    test('formats string input', () => {
        expect(formatLevel('300')).toBe('300 Level');
    });
});

describe('CONFIG', () => {
    test('has required app metadata', () => {
        expect(CONFIG.app.name).toBe('Caleb University Resource Bank');
        expect(CONFIG.app.shortName).toBe('CURB');
    });

    test('has cache settings', () => {
        expect(CONFIG.cache.ttlHours).toBe(6);
        expect(CONFIG.cache.hardExpiryHours).toBe(24);
    });

    test('has version string', () => {
        expect(CONFIG.version).toBeTruthy();
        expect(typeof CONFIG.version).toBe('string');
    });

    test('has semesters defined', () => {
        expect(CONFIG.semesters).toEqual(['1st Semester', '2nd Semester']);
    });

    test('does NOT have levelExceptions (moved to server-side)', () => {
        expect(CONFIG.levelExceptions).toBeUndefined();
    });
});
