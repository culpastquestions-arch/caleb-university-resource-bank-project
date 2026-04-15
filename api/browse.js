// Serverless Function: Lazy-Loading Google Drive Browser
// This endpoint fetches contents of a specific folder path on-demand
// Much faster than fetching the entire structure upfront

const {
  LEVEL_EXCEPTIONS,
  normalizeFolderName,
  makeAPIRequest,
  listFolders,
  setupCors,
  handlePreflightAndMethodGuard
} = require('./_utils');

// Per-path cache with 30-minute TTL (survives within same serverless instance)
const pathCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_PATH_LENGTH = 512;
const MAX_SEGMENTS = 8;
const MAX_SEGMENT_LENGTH = 120;
const ALLOWED_TYPES = new Set(['folders', 'files']);

/**
 * List PDF files in a Google Drive folder
 * @param {string} folderId - The Drive folder ID
 * @param {string} apiKey - Google API key
 * @returns {Promise<Array>} Array of file objects
 */
async function listFiles(folderId, apiKey) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size,webViewLink,webContentLink)&orderBy=name&key=${apiKey}`;

  const response = await makeAPIRequest(url);
  return response.files || [];
}

/**
 * Find a folder by name within a parent folder
 * Handles ~ as / substitution for folder names with slashes
 * @param {string} parentId - Parent folder ID
 * @param {string} folderName - Name of folder to find (may contain ~ instead of /)
 * @param {string} apiKey - Google API key
 * @returns {Promise<Object|null>} Folder object or null if not found
 */
async function findFolderByName(parentId, folderName, apiKey) {
  const folders = await listFolders(parentId, apiKey, 'files(id,name,modifiedTime)');

  // Normalize the target name - convert ~ back to / for matching
  const normalizedTarget = normalizeFolderName(folderName.replace(/~/g, '/'));

  return folders.find(f => normalizeFolderName(f.name) === normalizedTarget) || null;
}

/**
 * Get cache key for a path
 * @param {string} path - The folder path
 * @returns {string} Cache key
 */
function getCacheKey(path) {
  return `path:${path}`;
}

/**
 * Check if cached data is still valid
 * @param {Object} cached - Cached data object
 * @returns {boolean} True if valid
 */
function isCacheValid(cached) {
  if (!cached || !cached.timestamp) return false;
  return (Date.now() - cached.timestamp) < CACHE_TTL;
}

/**
 * Get cached data for a path
 * @param {string} path - The folder path
 * @returns {Object|null} Cached data or null
 */
function getCached(path) {
  const key = getCacheKey(path);
  const cached = pathCache.get(key);

  if (cached && isCacheValid(cached)) {
    return cached;
  }

  // Expired or not found
  pathCache.delete(key);
  return null;
}

/**
 * Set cached data for a path
 * @param {string} path - The folder path
 * @param {Object} data - Data to cache
 */
function setCache(path, data) {
  const key = getCacheKey(path);
  pathCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Main handler for Vercel Serverless Function
 * 
 * Query parameters:
 * - path: The folder path to browse (e.g., "/Computer Science/100 Level/1st Semester")
 * - type: What to return - "folders" or "files" (default: "folders")
 */
module.exports = async (req, res) => {
  // CORS — restrict to configured origin
  setupCors(req, res);

  // Preflight + method guard
  if (handlePreflightAndMethodGuard(req, res)) return;

  try {
    // Get credentials from environment variables
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if (!apiKey || !rootFolderId) {
      console.error('Missing environment variables');
      res.status(500).json({
        error: 'Server configuration error',
        message: 'API credentials not configured.'
      });
      return;
    }

    // Parse query parameters
    const rawPath = typeof req.query.path === 'string' ? req.query.path : '/';
    const rawType = typeof req.query.type === 'string' ? req.query.type : 'folders';
    const path = rawPath.trim() || '/';
    const type = rawType.trim().toLowerCase(); // 'folders' or 'files'

    if (!ALLOWED_TYPES.has(type)) {
      res.status(400).json({
        error: 'Invalid query parameter',
        message: 'type must be either "folders" or "files".'
      });
      return;
    }

    if (path.length > MAX_PATH_LENGTH) {
      res.status(400).json({
        error: 'Invalid query parameter',
        message: 'path is too long.'
      });
      return;
    }

    // Note: ~ is used in URLs to represent / in folder names (e.g., "2024~25 Session")
    // The conversion from ~ to / happens in findFolderByName, not here
    // This preserves correct path splitting

    // Check cache first
    const cacheKey = `${path}:${type}`;
    const cached = getCached(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      // Item #4: CDN-level caching. s-maxage lets Vercel's edge cache serve
      // the same response to all 200 concurrent students without invoking the function.
      res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
      res.status(200).json({
        path,
        type,
        data: cached.data,
        cached: true,
        timestamp: cached.timestamp
      });
      return;
    }

    // Parse the path into segments
    const segments = path.split('/').filter(s => s.length > 0);

    if (segments.length > MAX_SEGMENTS) {
      res.status(400).json({
        error: 'Invalid query parameter',
        message: 'path has too many segments.'
      });
      return;
    }

    const hasInvalidSegment = segments.some(segment =>
      segment.length > MAX_SEGMENT_LENGTH || /[\u0000-\u001F\u007F\\]/.test(segment)
    );

    if (hasInvalidSegment) {
      res.status(400).json({
        error: 'Invalid query parameter',
        message: 'path contains invalid segment values.'
      });
      return;
    }

    // Navigate to the target folder
    let currentFolderId = rootFolderId;

    for (const segment of segments) {
      const folder = await findFolderByName(currentFolderId, segment, apiKey);

      if (!folder) {
        res.status(404).json({
          error: 'Path not found',
          message: `Folder "${segment}" not found in path`,
          path
        });
        return;
      }

      currentFolderId = folder.id;
    }

    // Fetch the requested content
    let data;

    if (type === 'files') {
      // Get PDF files in this folder
      data = await listFiles(currentFolderId, apiKey);
    } else {
      // Get subfolders
      const folders = await listFolders(currentFolderId, apiKey, 'files(id,name,modifiedTime)');

      // Filter and normalize folder names
      data = folders.map(f => ({
        id: f.id,
        name: normalizeFolderName(f.name),
        modifiedTime: f.modifiedTime
      }));

      // Apply level filtering only for departments with special structures
      // All other departments return exactly what exists in Google Drive
      if (segments.length === 1) {
        // Department level - only filter when there is an explicit exception
        const deptName = normalizeFolderName(segments[0]);
        const validLevels = LEVEL_EXCEPTIONS[deptName];

        if (validLevels) {
          data = data.filter(f => {
            const levelMatch = f.name.match(/(\d+)/);
            if (levelMatch) {
              return validLevels.includes(parseInt(levelMatch[1]));
            }
            // For non-numeric levels (Jupeb subjects)
            return validLevels.includes(f.name);
          });
        }
      }
    }

    // Cache the result
    setCache(cacheKey, data);

    // Return response
    res.setHeader('X-Cache', 'MISS');
    // Item #4: CDN-level caching for scalability
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({
      path,
      type,
      data,
      cached: false,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error in browse endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch data',
      message: error.message
    });
  }
};
