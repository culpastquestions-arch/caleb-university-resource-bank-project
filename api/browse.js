// Serverless Function: Lazy-Loading Google Drive Browser
// This endpoint fetches contents of a specific folder path on-demand
// Much faster than fetching the entire structure upfront

const https = require('https');

// Per-path cache with 30-minute TTL (survives within same serverless instance)
const pathCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Normalize folder names to handle trailing spaces and inconsistent formatting
 * @param {string} name - The folder name to normalize
 * @returns {string} Normalized folder name
 */
function normalizeFolderName(name) {
  if (!name || typeof name !== 'string') return name;
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Make HTTPS request to Google Drive API
 * @param {string} url - The API URL to request
 * @returns {Promise<Object>} Parsed JSON response
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

/**
 * List folders in a Google Drive directory
 * @param {string} folderId - The Drive folder ID
 * @param {string} apiKey - Google API key
 * @returns {Promise<Array>} Array of folder objects
 */
async function listFolders(folderId, apiKey) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&orderBy=name&key=${apiKey}`;
  
  const response = await makeAPIRequest(url);
  return response.files || [];
}

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
  const folders = await listFolders(parentId, apiKey);
  
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
 * Department configuration
 */
/**
 * Level exceptions for departments with non-standard level structures.
 * Departments NOT listed here default to [100, 200, 300, 400].
 * 
 * NOTE: Department names here must EXACTLY match the Google Drive folder names.
 * New departments with standard levels (100-400) work automatically - no code change needed.
 */
const LEVEL_EXCEPTIONS = {
  // Single-level departments (100 only)
  "Human Anatomy": [100],
  "Human Physiology": [100],
  "Software Engineering": [100],
  "MLS": [100],
  
  // Two-level departments
  "Nursing": [100, 200],
  
  // Special structure departments
  "Jupeb": ["Art", "Business", "Science"],
  
  // Add new departments with non-standard levels here:
  // "Department Name": [100, 200] // example: only 100 and 200 level
};

const DEFAULT_LEVELS = [100, 200, 300, 400];

/**
 * Main handler for Vercel Serverless Function
 * 
 * Query parameters:
 * - path: The folder path to browse (e.g., "/Computer Science/100 Level/1st Semester")
 * - type: What to return - "folders" or "files" (default: "folders")
 */
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
    const path = req.query.path || '/';
    const type = req.query.type || 'folders'; // 'folders' or 'files'
    
    // Note: ~ is used in URLs to represent / in folder names (e.g., "2024~25 Session")
    // The conversion from ~ to / happens in findFolderByName, not here
    // This preserves correct path splitting

    // Check cache first
    const cacheKey = `${path}:${type}`;
    const cached = getCached(cacheKey);
    
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=1800');
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
      const folders = await listFolders(currentFolderId, apiKey);
      
      // Filter and normalize folder names
      data = folders.map(f => ({
        id: f.id,
        name: normalizeFolderName(f.name),
        modifiedTime: f.modifiedTime
      }));

      // Apply level filtering only at department level
      // Root level shows ALL folders from Google Drive (no-code department management)
      if (segments.length === 1) {
        // Department level - filter to valid levels for this department
        const deptName = normalizeFolderName(segments[0]);
        const validLevels = LEVEL_EXCEPTIONS[deptName] || DEFAULT_LEVELS;
        
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

    // Cache the result
    setCache(cacheKey, data);

    // Return response
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=1800');
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
