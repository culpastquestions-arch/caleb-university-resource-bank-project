/**
 * @fileoverview Tests for CURB Node.js server.
 */

const http = require('http');
const path = require('path');
const { createServer } = require('../server');

/**
 * Perform a basic HTTP request.
 * @param {Object} options - Request options.
 * @returns {Promise<{ statusCode: number, body: string }>} Response info.
 */
function httpRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Start a server on an ephemeral port for tests.
 * @param {Object} [overrides] - Server overrides.
 * @returns {Promise<{ server: http.Server, port: number }>} Server info.
 */
function startTestServer(overrides = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer(overrides);
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start server'));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

describe('CURB server', () => {
  test('serves index.html on root', async () => {
    const { server, port } = await startTestServer({
      staticRoot: path.resolve(__dirname, '..')
    });

    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/',
      method: 'GET'
    });

    server.close();

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<!DOCTYPE html>');
  });

  test('returns 404 for missing file with extension', async () => {
    const { server, port } = await startTestServer({
      staticRoot: path.resolve(__dirname, '..')
    });

    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/missing-file.js',
      method: 'GET'
    });

    server.close();

    expect(response.statusCode).toBe(404);
  });

  test('does not serve private project files', async () => {
    const { server, port } = await startTestServer({
      staticRoot: path.resolve(__dirname, '..')
    });

    const privatePaths = ['/.env', '/.gitignore', '/package.json', '/server.js', '/api/browse.js'];
    const statusCodes = [];
    for (const privatePath of privatePaths) {
      const response = await httpRequest({
        hostname: 'localhost',
        port,
        path: privatePath,
        method: 'GET'
      });
      statusCodes.push(response.statusCode);
    }

    server.close();

    // /api/* is routed to API handlers, which also answer 404 for unknown endpoints.
    expect(statusCodes).toEqual([404, 404, 404, 404, 404]);
  });

  test('serves public app assets', async () => {
    const { server, port } = await startTestServer({
      staticRoot: path.resolve(__dirname, '..')
    });

    const publicPaths = ['/js/app.js', '/css/styles.css', '/manifest.json', '/sw.js', '/offline.html'];
    const statusCodes = [];
    for (const publicPath of publicPaths) {
      const response = await httpRequest({
        hostname: 'localhost',
        port,
        path: publicPath,
        method: 'GET'
      });
      statusCodes.push(response.statusCode);
    }

    server.close();

    expect(statusCodes).toEqual([200, 200, 200, 200, 200]);
  });

  test('routes API requests to handler', async () => {
    const apiHandlers = {
      browse: (req, res) => {
        res.status(200).json({ ok: true, query: req.query });
      },
      coverage: (req, res) => res.status(200).json({ ok: true }),
      team: (req, res) => res.status(200).json({ ok: true })
    };

    const { server, port } = await startTestServer({
      apiHandlers,
      staticRoot: path.resolve(__dirname, '..')
    });

    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/browse?path=%2FComputer%20Science&type=folders',
      method: 'GET'
    });

    server.close();

    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.ok).toBe(true);
    expect(parsed.query.path).toBe('/Computer Science');
    expect(parsed.query.type).toBe('folders');
  });
});
