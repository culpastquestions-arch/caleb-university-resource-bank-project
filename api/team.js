// Serverless Function: Team Data from Google Sheets CSV
// Fetches team member data from published Google Sheets for the About page
// Supports session-based filtering (e.g. ?session=2025/26)
// This allows no-code maintenance of team information across academic years

const https = require('https');

// Cache for the full parsed sheet data (all sessions)
// We cache the raw parsed data and filter per-request
const cache = {
  executives: { data: null, timestamp: null },
  reps: { data: null, timestamp: null }
};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch data from a URL using HTTPS.
 * @param {string} url - The URL to fetch from.
 * @returns {Promise<string>} Raw response text.
 * @throws {Error} If the request fails.
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects (Google Sheets often redirects)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Fetch failed with status ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse CSV text into an array of objects.
 * First row is treated as headers.
 * @param {string} csvText - Raw CSV text.
 * @returns {Array<Object>} Array of row objects with header keys.
 */
function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return [];
  }

  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return []; // Need at least header + 1 data row
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};

    headers.forEach((header, index) => {
      // Normalize header names (lowercase, trim)
      const key = header.toLowerCase().trim();
      row[key] = values[index] ? values[index].trim() : '';
    });

    // Only include rows that have at least a name
    if (row.name && row.name !== '') {
      data.push(row);
    }
  }

  return data;
}

/**
 * Get the first non-empty value from a row by trying multiple key variants.
 * @param {Object} row - Parsed CSV row object.
 * @param {Array<string>} keys - Candidate key names in priority order.
 * @returns {string} First non-empty value, otherwise empty string.
 */
function pickRowValue(row, keys) {
  if (!row || typeof row !== 'object' || !Array.isArray(keys)) {
    return '';
  }

  for (const key of keys) {
    if (!key) continue;
    const value = row[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return '';
}

/**
 * Parse a single CSV line, handling quoted values.
 * @param {string} line - A single CSV line.
 * @returns {Array<string>} Array of cell values.
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last value
  values.push(current);

  return values;
}

/**
 * Sanitize text to prevent XSS attacks.
 * @param {string} text - Input text to sanitize.
 * @returns {string} Sanitized text.
 */
function sanitize(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check whether a parsed URL uses an allowed protocol.
 * @param {URL} parsedUrl - Parsed URL instance.
 * @returns {boolean} True if protocol is safe for image src.
 */
function isSafeImageProtocol(parsedUrl) {
  return parsedUrl && (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:');
}

/**
 * Extract a Google Drive file id from a URL-like string.
 * Supports common share URL variants and plain file IDs.
 * @param {string} input - URL-like input.
 * @returns {string|null} Drive file id if found.
 */
function extractDriveFileId(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Allow pasting only the Drive file id directly.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  // Common URL patterns: /d/<id> and ?id=<id>
  const pathMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  return null;
}

/**
 * Convert a Google Drive share link into a direct image URL.
 * If the URL is not a recognized Drive link, return it as-is.
 * @param {string} url - The URL to format.
 * @returns {string} Formatted URL.
 */
function formatPhotoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const str = url.trim();

  // If user already provided a Drive uc URL with a valid export mode,
  // preserve it rather than forcing a different mode.
  try {
    const parsedInput = new URL(str);
    if (parsedInput.hostname === 'drive.google.com' && parsedInput.pathname === '/uc') {
      const exportMode = parsedInput.searchParams.get('export');
      const id = parsedInput.searchParams.get('id');
      const allowedExportModes = new Set(['download', 'view']);
      if (id && exportMode && allowedExportModes.has(exportMode)) {
        return `https://drive.google.com/uc?export=${exportMode}&id=${id}`;
      }
    }
  } catch (error) {
    // Ignore parse failure here and continue with ID extraction flow.
  }

  const driveFileId = extractDriveFileId(str);
  if (driveFileId) {
    return `https://drive.google.com/uc?export=download&id=${driveFileId}`;
  }

  // Accept only http/https URLs for direct image sources.
  try {
    const parsed = new URL(str);
    if (!isSafeImageProtocol(parsed)) {
      return '';
    }
    return parsed.toString();
  } catch (error) {
    // Invalid URL should not be returned to the client.
    return '';
  }
}

/**
 * Check if cache is still valid.
 * @param {Object} cacheEntry - Cache entry with timestamp.
 * @returns {boolean} True if cache is valid.
 */
function isCacheValid(cacheEntry) {
  return cacheEntry.data !== null &&
    cacheEntry.timestamp !== null &&
    (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
}

/**
 * Normalize an academic session label to a canonical format.
 * Canonical format is "YYYY/YY" when a year range is detected.
 * Examples: "2025~26", "2025/2026", "2025/26 Session" -> "2025/26".
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

/**
 * Build a numeric sort key for an academic session label.
 * Higher values represent newer sessions.
 * @param {string} sessionLabel - Session label.
 * @returns {number} Sort key.
 */
function getSessionSortKey(sessionLabel) {
  const normalized = normalizeSessionLabel(sessionLabel);
  const fullMatch = normalized.match(/^(\d{4})\/(\d{2})$/);
  if (fullMatch) {
    const startYear = Number.parseInt(fullMatch[1], 10);
    const endYearTwoDigit = Number.parseInt(fullMatch[2], 10);
    if (Number.isFinite(startYear) && Number.isFinite(endYearTwoDigit)) {
      return (startYear * 100) + endYearTwoDigit;
    }
  }

  const fallbackMatch = normalized.match(/(\d{4})/);
  if (fallbackMatch) {
    const year = Number.parseInt(fallbackMatch[1], 10);
    if (Number.isFinite(year)) {
      return year * 100;
    }
  }

  return Number.NEGATIVE_INFINITY;
}

/**
 * Compare two session labels with latest first ordering.
 * @param {string} a - Session A.
 * @param {string} b - Session B.
 * @returns {number} Sort comparator result.
 */
function compareSessionsDesc(a, b) {
  const keyDiff = getSessionSortKey(b) - getSessionSortKey(a);
  if (keyDiff !== 0) {
    return keyDiff;
  }

  const normalizedA = normalizeSessionLabel(a);
  const normalizedB = normalizeSessionLabel(b);
  return normalizedB.localeCompare(normalizedA);
}

/**
 * Extract unique session values from an array of rows,
 * sorted in descending order (latest first).
 * @param {Array<Object>} rows - Array of parsed row objects.
 * @returns {Array<string>} Unique session strings.
 */
function extractSessions(rows) {
  const sessionSet = new Set();
  for (const row of rows) {
    const session = normalizeSessionLabel(row.session || '');
    if (session) {
      sessionSet.add(session);
    }
  }

  // Sort sessions descending so latest is first.
  return Array.from(sessionSet).sort(compareSessionsDesc);
}

/**
 * Fetch and parse all executives data from Google Sheets (all sessions).
 * @param {string} sheetUrl - Published CSV URL for executives sheet.
 * @returns {Promise<Array>} Array of executive objects with session field.
 */
async function fetchAllExecutives(sheetUrl, options = {}) {
  const { bypassCache = false } = options;

  // Check cache first
  if (!bypassCache && isCacheValid(cache.executives)) {
    return cache.executives.data;
  }

  try {
    const csvText = await fetchUrl(sheetUrl);
    const data = parseCSV(csvText);

    // Transform and sanitize data — preserve session column
    const executives = data.map(row => ({
      name: sanitize(row.name || 'TBD'),
      role: sanitize(row.role || 'Team Member'),
      photoUrl: formatPhotoUrl(pickRowValue(row, [
        'photourl',
        'photo url',
        'photo_url',
        'photo',
        'imageurl',
        'image url',
        'image_url',
        'image',
        'picture',
        'avatar'
      ])), // Convert Drive links to direct image URLs

      order: parseInt(row.order, 10) || 999,
      session: normalizeSessionLabel(row.session || '')
    }));

    // Sort by order within each session
    executives.sort((a, b) => a.order - b.order);

    // Update cache
    cache.executives = { data: executives, timestamp: Date.now() };

    return executives;
  } catch (error) {
    console.error('Failed to fetch executives:', error.message);
    // Return cached data if available, even if stale
    if (cache.executives.data) {
      return cache.executives.data;
    }
    throw error;
  }
}

/**
 * Fetch and parse all department reps data from Google Sheets (all sessions).
 * @param {string} sheetUrl - Published CSV URL for reps sheet.
 * @returns {Promise<Array>} Array of department rep objects with session field.
 */
async function fetchAllDepartmentReps(sheetUrl, options = {}) {
  const { bypassCache = false } = options;

  // Check cache first
  if (!bypassCache && isCacheValid(cache.reps)) {
    return cache.reps.data;
  }

  try {
    const csvText = await fetchUrl(sheetUrl);
    const data = parseCSV(csvText);

    // Transform and sanitize data — preserve session column
    const reps = data.map(row => ({
      department: sanitize(row.department || 'Unknown'),
      name: sanitize(row.name || 'TBD'),
      photoUrl: formatPhotoUrl(pickRowValue(row, [
        'photourl',
        'photo url',
        'photo_url',
        'photo',
        'imageurl',
        'image url',
        'image_url',
        'image',
        'picture',
        'avatar'
      ])), // Convert Drive links to direct image URLs

      session: normalizeSessionLabel(row.session || '')
    }));

    // Sort by department name
    reps.sort((a, b) => a.department.localeCompare(b.department));

    // Update cache
    cache.reps = { data: reps, timestamp: Date.now() };

    return reps;
  } catch (error) {
    console.error('Failed to fetch department reps:', error.message);
    // Return cached data if available, even if stale
    if (cache.reps.data) {
      return cache.reps.data;
    }
    throw error;
  }
}

/**
 * Main handler for Vercel serverless function.
 * Accepts optional ?session=2025/26 query param.
 * Returns team data filtered by session, plus available sessions list.
 * @param {Object} req - HTTP request object.
 * @param {Object} res - HTTP response object.
 */
module.exports = async function handler(req, res) {
  // CORS - restrict to configured origin (set ALLOWED_ORIGIN env var on Vercel)
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  const requestOrigin = req.headers.origin || '';

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  // If ALLOWED_ORIGIN is not configured or origin doesn't match,
  // no CORS header is sent — browser will block cross-origin requests (safe default)

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get sheet URLs from environment variables
  const executivesUrl = process.env.TEAM_SHEET_EXECUTIVES_URL;
  const repsUrl = process.env.TEAM_SHEET_REPS_URL;

  // Validate configuration
  if (!executivesUrl || !repsUrl) {
    console.error('Team sheet URLs not configured');
    return res.status(500).json({
      error: 'Team data not configured',
      fallback: true
    });
  }

  try {
    const forceRefresh = req.query.refresh === '1' || req.query.force === '1';

    // Fetch all data from both sheets (cached for 24h)
    const [allExecutives, allReps] = await Promise.all([
      fetchAllExecutives(executivesUrl, { bypassCache: forceRefresh }),
      fetchAllDepartmentReps(repsUrl, { bypassCache: forceRefresh })
    ]);

    // Discover all available sessions from both sheets
    const execSessions = extractSessions(allExecutives);
    const repSessions = extractSessions(allReps);
    const allSessions = Array.from(
      new Set([...execSessions, ...repSessions])
    ).sort(compareSessionsDesc); // Latest first

    // Determine which session to return
    const requestedSession = normalizeSessionLabel(req.query.session || '');
    let activeSession = '';

    if (requestedSession && allSessions.includes(requestedSession)) {
      // User requested a valid session
      activeSession = requestedSession;
    } else if (allSessions.length > 0) {
      // Default to the latest session
      activeSession = allSessions[0];
    }

    // Filter data by the active session
    const executives = activeSession
      ? allExecutives.filter(e => e.session === activeSession)
      : allExecutives;

    const departmentReps = activeSession
      ? allReps.filter(r => r.session === activeSession)
      : allReps;

    // Strip session field from response (frontend doesn't need it per-member)
    const cleanExecutives = executives.map(({ session, ...rest }) => rest);
    const cleanReps = departmentReps.map(({ session, ...rest }) => rest);

    // Return combined data with session metadata
    if (forceRefresh) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    }
    return res.status(200).json({
      success: true,
      session: activeSession,
      sessions: allSessions,
      executives: cleanExecutives,
      departmentReps: cleanReps,
      cached: isCacheValid(cache.executives) && isCacheValid(cache.reps)
    });

  } catch (error) {
    console.error('Team API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch team data',
      message: error.message,
      fallback: true
    });
  }
};
