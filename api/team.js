// Serverless Function: Team Data from Google Sheets CSV
// Fetches team member data from published Google Sheets for the About page
// This allows no-code maintenance of team information

const https = require('https');

// Cache for team data (24 hour TTL - team doesn't change often)
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
 * Fetch and parse executives data from Google Sheets.
 * @param {string} sheetUrl - Published CSV URL for executives sheet.
 * @returns {Promise<Array>} Array of executive objects.
 */
async function fetchExecutives(sheetUrl) {
  // Check cache first
  if (isCacheValid(cache.executives)) {
    return cache.executives.data;
  }

  try {
    const csvText = await fetchUrl(sheetUrl);
    const data = parseCSV(csvText);

    // Transform and sanitize data
    const executives = data.map(row => ({
      name: sanitize(row.name || 'TBD'),
      role: sanitize(row.role || 'Team Member'),
      photoUrl: row.photourl || row.photo || '', // Don't sanitize URLs
      order: parseInt(row.order, 10) || 999
    }));

    // Sort by order
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
 * Fetch and parse department reps data from Google Sheets.
 * @param {string} sheetUrl - Published CSV URL for reps sheet.
 * @returns {Promise<Array>} Array of department rep objects.
 */
async function fetchDepartmentReps(sheetUrl) {
  // Check cache first
  if (isCacheValid(cache.reps)) {
    return cache.reps.data;
  }

  try {
    const csvText = await fetchUrl(sheetUrl);
    const data = parseCSV(csvText);

    // Transform and sanitize data
    const reps = data.map(row => ({
      department: sanitize(row.department || 'Unknown'),
      name: sanitize(row.name || 'TBD'),
      photoUrl: row.photourl || row.photo || '' // Don't sanitize URLs
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
    // Fetch both sheets in parallel
    const [executives, departmentReps] = await Promise.all([
      fetchExecutives(executivesUrl),
      fetchDepartmentReps(repsUrl)
    ]);

    // Return combined data
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      success: true,
      executives,
      departmentReps,
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
