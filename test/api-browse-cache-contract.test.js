jest.mock('../api/_utils', () => ({
  LEVEL_EXCEPTIONS: {},
  normalizeFolderName: jest.fn((value) => value),
  makeAPIRequest: jest.fn(),
  listFolders: jest.fn(),
  setupCors: jest.fn(),
  handlePreflightAndMethodGuard: jest.fn(() => false)
}));

const browseHandler = require('../api/browse');
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

describe('browse API cache contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_DRIVE_API_KEY = 'test-key';
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-folder';

    utils.listFolders.mockResolvedValue([{ id: 'dept-1', name: 'Computer Science' }]);
  });

  test('normal mode returns cacheable headers', async () => {
    const req = {
      method: 'GET',
      query: { path: '/', type: 'folders' },
      headers: {}
    };
    const res = createMockRes();

    await browseHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe(
      'public, s-maxage=1800, stale-while-revalidate=3600'
    );
    expect(res.headers['X-Cache']).toBe('MISS');
  });

  test('refresh=1 returns no-store and bypass header', async () => {
    const req = {
      method: 'GET',
      query: { path: '/', type: 'folders', refresh: '1' },
      headers: {}
    };
    const res = createMockRes();

    await browseHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
    expect(res.headers['X-Cache']).toBe('BYPASS');
    expect(res.body.forceRefresh).toBe(true);
  });
});
