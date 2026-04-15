/**
 * Shared Utilities for CURB API Serverless Functions
 * Centralizes common helpers to prevent duplication across browse.js, coverage.js, team.js.
 * @module api/_utils
 */

const https = require('https');

// ──────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────

/**
 * Level exceptions for departments with non-standard level structures.
 * Only departments listed here are filtered.
 * All other departments return folders exactly as they exist in Google Drive.
 *
 * NOTE: Department names here must EXACTLY match the Google Drive folder names.
 * Keep this list minimal and only for truly special structures.
 */
const LEVEL_EXCEPTIONS = {
  "Jupeb": ["Art", "Business", "Science"],
};

// ──────────────────────────────────────────────────────────────────────
// Folder / String Normalization
// ──────────────────────────────────────────────────────────────────────

/**
 * Normalize folder names to handle trailing spaces and inconsistent formatting.
 * @param {string} name - The folder name to normalize.
 * @returns {string} Normalized folder name.
 */
function normalizeFolderName(name) {
  if (!name || typeof name !== 'string') return name;
  return name.trim().replace(/\s+/g, ' ');
}

// ──────────────────────────────────────────────────────────────────────
// HTTP Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Make HTTPS request to Google Drive API.
 * @param {string} url - The API URL to request.
 * @returns {Promise<Object>} Parsed JSON response.
 * @throws {Error} If request fails or response is not valid JSON.
 */
function makeAPIRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse API response: ${e.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// ──────────────────────────────────────────────────────────────────────
// Google Drive Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * List folders in a Google Drive directory.
 * @param {string} folderId - The Drive folder ID.
 * @param {string} apiKey - Google API key.
 * @param {string} [fields='files(id,name)'] - Drive API fields to return.
 * @returns {Promise<Array>} Array of folder objects.
 */
async function listFolders(folderId, apiKey, fields = 'files(id,name)') {
  const query = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${encodeURIComponent(fields)}&orderBy=name&key=${apiKey}`;

  const response = await makeAPIRequest(url);
  return response.files || [];
}

// ──────────────────────────────────────────────────────────────────────
// CORS Middleware
// ──────────────────────────────────────────────────────────────────────

/**
 * Apply CORS headers based on the ALLOWED_ORIGIN environment variable.
 * If ALLOWED_ORIGIN is not set or origin doesn't match, no CORS header
 * is sent — browsers will block cross-origin requests (safe default).
 *
 * @param {Object} req - HTTP request object.
 * @param {Object} res - HTTP response object.
 */
function setupCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  const requestOrigin = req.headers.origin || '';

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Handle preflight + method guard.
 * Returns true if the request was handled (caller should return early).
 * @param {Object} req - HTTP request object.
 * @param {Object} res - HTTP response object.
 * @returns {boolean} True if request was fully handled.
 */
function handlePreflightAndMethodGuard(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }

  return false;
}

// ──────────────────────────────────────────────────────────────────────
// Session Normalization (shared between coverage.js and team.js)
// ──────────────────────────────────────────────────────────────────────

/**
 * Normalize an academic session label to a canonical "YYYY/YY" format.
 * Examples: "2025~26", "2025/2026", "2025/26 Session" → "2025/26".
 * Non-matching values are returned trimmed with normalized spacing.
 * @param {string} value - Raw session label.
 * @returns {string} Normalized session label.
 */
function normalizeSessionLabel(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return '';
  }

  const match = trimmed.match(/(\d{4})\s*[\/~-]\s*(\d{2}|\d{4})(?:\s*session)?/i);
  if (!match) {
    return trimmed;
  }

  const startYear = Number.parseInt(match[1], 10);
  if (!Number.isFinite(startYear)) {
    return trimmed;
  }

  const endRaw = match[2];
  const endTwoDigit = endRaw.length === 4 ? endRaw.slice(-2) : endRaw.padStart(2, '0');
  return `${startYear}/${endTwoDigit}`;
}

module.exports = {
  LEVEL_EXCEPTIONS,
  normalizeFolderName,
  makeAPIRequest,
  listFolders,
  setupCors,
  handlePreflightAndMethodGuard,
  normalizeSessionLabel
};
