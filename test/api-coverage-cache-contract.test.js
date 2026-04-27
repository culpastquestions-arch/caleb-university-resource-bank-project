jest.mock('../api/_utils', () => ({
  LEVEL_EXCEPTIONS: {},
  normalizeFolderName: jest.fn((value) => value),
  makeAPIRequest: jest.fn(),
  listFolders: jest.fn(),
  setupCors: jest.fn(),
  handlePreflightAndMethodGuard: jest.fn(() => false)
}));

const coverageHandler = require('../api/coverage');
const utils = require('../api/_utils');

function createMockRes() {
  const res = {
    headers: {},
    statusCode: null,
    body: null,
    setHeader: jest.fn((key, value) => {
      res.headers[key] = value;
    }),
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((payload) => {
      res.body = payload;
      return res;
    }),
    end: jest.fn(() => res)
  };

  return res;
}

describe('coverage API cache contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_DRIVE_API_KEY = 'test-key';
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-folder';

    utils.listFolders.mockImplementation(async (folderId) => {
      if (folderId === 'root-folder') {
        return [{ id: 'dept-1', name: 'Computer Science' }];
      }
      if (folderId === 'dept-1') {
        return [{ id: 'level-1', name: '100 Level' }];
      }
      if (folderId === 'level-1') {
        return [{ id: 'semester-1', name: '1st Semester' }];
      }
      if (folderId === 'semester-1') {
        return [];
      }
      return [];
    });
  });

  test('normal mode returns cacheable headers', async () => {
    const req = {
      method: 'GET',
      query: { department: 'Computer Science', session: '2025/26' },
      headers: {}
    };
    const res = createMockRes();

    await coverageHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('public, s-maxage=300, stale-while-revalidate=600');
    expect(res.headers['X-Cache']).toBe('MISS');
  });

  test('refresh=1 returns no-store and bypass header', async () => {
    const req = {
      method: 'GET',
      query: { department: 'Computer Science', session: '2025/26', refresh: '1' },
      headers: {}
    };
    const res = createMockRes();

    await coverageHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
    expect(res.headers['X-Cache']).toBe('BYPASS');
    expect(res.body.forceRefresh).toBe(true);
  });
});
