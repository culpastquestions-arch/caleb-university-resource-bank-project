/**
 * @fileoverview Lightweight Node.js HTTP server for CURB.
 * Serves static assets and mounts API handlers compatible with serverless endpoints.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const DEFAULT_PORT = 3000;
const STATIC_ROOT = path.resolve(__dirname);

/**
 * Build a minimal response wrapper compatible with serverless handlers.
 * @param {http.ServerResponse} res - Node.js response.
 * @returns {Object} Response wrapper with status/json/end helpers.
 */
function createResponse(res) {
  const wrapper = {
    setHeader: (name, value) => res.setHeader(name, value),
    status: (code) => {
      res.statusCode = code;
      return wrapper;
    },
    json: (payload) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
    },
    end: (data) => res.end(data)
  };

  return wrapper;
}

/**
 * Parse query parameters into a plain object.
 * @param {URL} parsedUrl - Parsed URL instance.
 * @returns {Object} Query parameters.
 */
function parseQuery(parsedUrl) {
  const query = {};
  for (const [key, value] of parsedUrl.searchParams.entries()) {
    query[key] = value;
  }
  return query;
}

/**
 * Map a URL path to an API handler.
 * @param {string} pathname - Request path.
 * @param {Object} apiHandlers - API handlers map.
 * @returns {Function|null} Handler function or null.
 */
function resolveApiHandler(pathname, apiHandlers) {
  if (pathname === '/api/browse') return apiHandlers.browse;
  if (pathname === '/api/coverage') return apiHandlers.coverage;
  if (pathname === '/api/team') return apiHandlers.team;
  return null;
}

/**
 * Resolve a safe filesystem path for static content.
 * @param {string} pathname - Request pathname.
 * @param {string} staticRoot - Root directory for static files.
 * @returns {string|null} Absolute path or null when invalid.
 */
function resolveStaticPath(pathname, staticRoot) {
  let decoded = '';
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    return null;
  }
  const normalized = decoded.replace(/\\/g, '/');

  if (normalized.includes('..')) {
    return null;
  }

  const target = normalized === '/' ? '/index.html' : normalized;
  const absolutePath = path.resolve(staticRoot, `.${target}`);

  if (!absolutePath.startsWith(staticRoot)) {
    return null;
  }

  return absolutePath;
}

/**
 * Determine a basic content type for a file path.
 * @param {string} filePath - Absolute file path.
 * @returns {string} Content type.
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Serve a static file or fallback to index.html for SPA-style paths.
 * @param {string} pathname - Request pathname.
 * @param {http.IncomingMessage} req - Request object.
 * @param {Object} res - Response wrapper.
 * @param {string} staticRoot - Static root path.
 * @param {Object} logger - Logger interface.
 */
function serveStatic(pathname, req, res, staticRoot, logger) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  const resolvedPath = resolveStaticPath(pathname, staticRoot);
  if (!resolvedPath) {
    res.status(400).end('Bad Request');
    return;
  }

  const hasExtension = path.extname(resolvedPath) !== '';
  const candidatePath = fs.existsSync(resolvedPath)
    ? resolvedPath
    : (!hasExtension ? path.join(staticRoot, 'index.html') : null);

  if (!candidatePath) {
    res.status(404).end('Not Found');
    return;
  }

  fs.readFile(candidatePath, (err, data) => {
    if (err) {
      logger.error('Static file read error:', err);
      res.status(500).end('Server Error');
      return;
    }

    res.setHeader('Content-Type', getContentType(candidatePath));
    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }

    res.status(200).end(data);
  });
}

/**
 * Handle API requests by delegating to serverless-style handlers.
 * @param {string} pathname - Request pathname.
 * @param {http.IncomingMessage} req - Request object.
 * @param {Object} res - Response wrapper.
 * @param {Object} apiHandlers - Handler map.
 * @param {Object} logger - Logger interface.
 */
async function handleApi(pathname, req, res, apiHandlers, logger) {
  const handler = resolveApiHandler(pathname, apiHandlers);
  if (!handler) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  try {
    await handler(req, res);
  } catch (error) {
    logger.error('API handler error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * Create the CURB HTTP server instance.
 * @param {Object} [options] - Optional configuration overrides.
 * @param {Object} [options.apiHandlers] - Override API handlers.
 * @param {string} [options.staticRoot] - Static root folder.
 * @param {Object} [options.logger] - Logger implementation.
 * @returns {http.Server} Node.js HTTP server.
 */
function createServer(options = {}) {
  const apiHandlers = options.apiHandlers || {
    browse: require('./api/browse'),
    coverage: require('./api/coverage'),
    team: require('./api/team')
  };
  const staticRoot = options.staticRoot || STATIC_ROOT;
  const logger = options.logger || console;

  return http.createServer((req, res) => {
    const safeRes = createResponse(res);
    const baseUrl = `http://${req.headers.host || 'localhost'}`;
    const parsedUrl = new URL(req.url || '/', baseUrl);

    req.query = parseQuery(parsedUrl);

    const pathname = parsedUrl.pathname || '/';

    if (pathname.startsWith('/api/')) {
      handleApi(pathname, req, safeRes, apiHandlers, logger);
      return;
    }

    serveStatic(pathname, req, safeRes, staticRoot, logger);
  });
}

/**
 * Start the server when running directly.
 * @param {number} [port] - Port to listen on.
 */
function startServer(port = DEFAULT_PORT) {
  const server = createServer();
  server.listen(port, () => {
    console.log(`CURB server running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  const portEnv = Number.parseInt(process.env.PORT, 10);
  const port = Number.isFinite(portEnv) ? portEnv : DEFAULT_PORT;
  startServer(port);
}

module.exports = {
  createServer,
  startServer
};
