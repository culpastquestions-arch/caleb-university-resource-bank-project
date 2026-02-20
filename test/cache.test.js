// Mock localStorage for testing
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; }),
        key: jest.fn((index) => Object.keys(store)[index] || null),
        get length() { return Object.keys(store).length; }
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock Blob for size calculation
global.Blob = class {
    constructor(parts) {
        this.size = parts.reduce((acc, part) => acc + String(part).length, 0);
    }
};

const { PathCacheManager } = require('../js/cache');

let cache;

beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    cache = new PathCacheManager();
});

describe('PathCacheManager', () => {
    describe('getKey', () => {
        test('generates correct key for root path', () => {
            expect(cache.getKey('/', 'folders')).toBe('curb_path__folders');
        });

        test('generates correct key for nested path', () => {
            expect(cache.getKey('/Computer Science/100 Level', 'folders'))
                .toBe('curb_path_Computer Science__100 Level_folders');
        });

        test('generates different keys for folders vs files', () => {
            const foldersKey = cache.getKey('/Dept', 'folders');
            const filesKey = cache.getKey('/Dept', 'files');
            expect(foldersKey).not.toBe(filesKey);
        });
    });

    describe('set and get', () => {
        test('stores and retrieves data', () => {
            const testData = [{ name: 'Test Folder' }];
            cache.set('/test', 'folders', testData);
            const result = cache.get('/test', 'folders');

            expect(result).not.toBeNull();
            expect(result.data).toEqual(testData);
            expect(result.isStale).toBe(false);
            expect(result.isExpired).toBe(false);
        });

        test('returns null for non-existent path', () => {
            expect(cache.get('/nonexistent', 'folders')).toBeNull();
        });
    });

    describe('isStale', () => {
        test('fresh data is not stale', () => {
            expect(cache.isStale(Date.now(), '/test')).toBe(false);
        });

        test('data older than 6 hours is stale for non-root paths', () => {
            const sevenHoursAgo = Date.now() - (7 * 60 * 60 * 1000);
            expect(cache.isStale(sevenHoursAgo, '/Computer Science')).toBe(true);
        });

        test('root path has longer TTL (24 hours)', () => {
            const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
            expect(cache.isStale(twelveHoursAgo, '/')).toBe(false);
            expect(cache.isStale(twelveHoursAgo, '')).toBe(false);
        });
    });

    describe('isExpired', () => {
        test('fresh data is not expired', () => {
            expect(cache.isExpired(Date.now(), '/test')).toBe(false);
        });

        test('data older than 24 hours is expired for non-root paths', () => {
            const thirtyHoursAgo = Date.now() - (30 * 60 * 60 * 1000);
            expect(cache.isExpired(thirtyHoursAgo, '/Computer Science')).toBe(true);
        });

        test('root path has 7-day hard expiry', () => {
            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
            expect(cache.isExpired(threeDaysAgo, '/')).toBe(false);

            const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
            expect(cache.isExpired(eightDaysAgo, '/')).toBe(true);
        });
    });

    describe('hasFresh and has', () => {
        test('hasFresh returns true for fresh cached data', () => {
            cache.set('/test', 'folders', ['data']);
            expect(cache.hasFresh('/test', 'folders')).toBe(true);
        });

        test('hasFresh returns false for non-existent path', () => {
            expect(cache.hasFresh('/nonexistent', 'folders')).toBe(false);
        });

        test('has returns true for any non-expired cached data', () => {
            cache.set('/test', 'folders', ['data']);
            expect(cache.has('/test', 'folders')).toBe(true);
        });
    });

    describe('invalidatePath', () => {
        test('removes both folders and files cache for a path', () => {
            cache.set('/test', 'folders', ['folders']);
            cache.set('/test', 'files', ['files']);

            cache.invalidatePath('/test');

            expect(cache.get('/test', 'folders')).toBeNull();
            expect(cache.get('/test', 'files')).toBeNull();
        });
    });

    describe('clearAll', () => {
        test('removes all path caches', () => {
            cache.set('/a', 'folders', ['a']);
            cache.set('/b', 'folders', ['b']);

            const result = cache.clearAll();
            expect(result).toBe(true);
        });
    });

    describe('isAvailable', () => {
        test('returns true when localStorage works', () => {
            expect(cache.isAvailable()).toBe(true);
        });
    });
});
