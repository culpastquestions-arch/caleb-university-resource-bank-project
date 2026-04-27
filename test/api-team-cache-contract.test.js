const { EventEmitter } = require('events');

jest.mock('https', () => ({
  get: jest.fn()
}));

jest.mock('../api/_utils', () => ({
  setupCors: jest.fn(),
  handlePreflightAndMethodGuard: jest.fn(() => false),
  normalizeSessionLabel: jest.fn((value) => {
    if (!value || typeof value !== 'string') return '';

    const trimmed = value.trim();
    const match = trimmed.match(/(\d{4})\s*[\/~-]\s*(\d{2}|\d{4})/);
    if (!match) {
      return trimmed;
    }

    const startYear = match[1];
    const endRaw = match[2];
    const endTwoDigit = endRaw.length === 4 ? endRaw.slice(-2) : endRaw;
    return `${startYear}/${endTwoDigit}`;
  })
}));

const https = require('https');
const teamHandler = require('../api/team');

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

function mockHttpsCsvFetch() {
  https.get.mockImplementation((url, callback) => {
    const response = new EventEmitter();
    response.statusCode = 200;
    response.headers = {};

    process.nextTick(() => {
      callback(response);

      const isExecutives = String(url).includes('executives');
      const csvText = isExecutives
        ? 'name,role,order,session\nAlice,Lead,1,2025/26\n'
        : 'department,name,session\nComputer Science,Bob,2025/26\n';

      response.emit('data', csvText);
      response.emit('end');
    });

    const request = new EventEmitter();
    request.setTimeout = jest.fn();
    request.destroy = jest.fn();
    return request;
  });
}

describe('team API cache contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.TEAM_SHEET_EXECUTIVES_URL = 'https://docs.google.com/spreadsheets/d/executives';
    process.env.TEAM_SHEET_REPS_URL = 'https://docs.google.com/spreadsheets/d/reps';

    mockHttpsCsvFetch();
  });

  test('normal mode returns cacheable headers', async () => {
    const req = {
      method: 'GET',
      query: {},
      headers: {}
    };
    const res = createMockRes();

    await teamHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );
    expect(res.body.success).toBe(true);
  });

  test('refresh=1 returns no-store', async () => {
    const req = {
      method: 'GET',
      query: { refresh: '1' },
      headers: {}
    };
    const res = createMockRes();

    await teamHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
    expect(res.body.success).toBe(true);
  });
});
