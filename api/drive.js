// Serverless Function: Google Drive API Proxy
// This acts as a secure backend that:
// 1. Keeps API credentials secret
// 2. Caches responses to reduce API calls
// 3. Handles all 500+ concurrent users efficiently

const https = require('https');

// In-memory cache (persists across requests in the same serverless instance)
const cache = {
  data: null,
  timestamp: null,
  ttl: 30 * 60 * 1000 // 30 minutes cache duration
};

/**
 * Normalize folder names to handle trailing spaces and inconsistent formatting
 * @param {string} name - The folder name to normalize
 * @returns {string} Normalized folder name
 */
function normalizeFolderName(name) {
  if (!name || typeof name !== 'string') return name;
  
  // Trim whitespace and collapse multiple spaces into single spaces
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Make HTTPS request to Google Drive API
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
          resolve(JSON.parse(data));
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
 */
async function listFolders(folderId, apiKey) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&orderBy=name&key=${apiKey}`;
  
  const response = await makeAPIRequest(url);
  return response.files || [];
}

/**
 * List PDF files in a Google Drive folder
 */
async function listFiles(folderId, apiKey) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size,webViewLink,webContentLink)&orderBy=name&key=${apiKey}`;
  
  const response = await makeAPIRequest(url);
  return response.files || [];
}

/**
 * Fetch the complete folder structure from Drive
 */
async function fetchStructure(rootFolderId, apiKey, departments, levelExceptions, defaultLevels) {
  const structure = {};

  // Get all department folders
  const departmentFolders = await listFolders(rootFolderId, apiKey);
  
  for (const dept of departmentFolders) {
    const normalizedDeptName = normalizeFolderName(dept.name);
    if (!departments.includes(normalizedDeptName)) continue;

    structure[normalizedDeptName] = {};
    const levels = levelExceptions[normalizedDeptName] || defaultLevels;

    // Get level folders for this department
    const levelFolders = await listFolders(dept.id, apiKey);
    

    for (const levelFolder of levelFolders) {
      const normalizedLevelName = normalizeFolderName(levelFolder.name);
      let isValidLevel = false;
      
      // Check if this is a numeric level (e.g., "100 Level" -> 100)
      const levelMatch = normalizedLevelName.match(/(\d+)/);
      if (levelMatch) {
        const levelNum = parseInt(levelMatch[1]);
        isValidLevel = levels.includes(levelNum);
      } else {
        // Check if this is a named level (e.g., "Art", "Business", "Science")
        isValidLevel = levels.includes(normalizedLevelName);
      }
      
      if (!isValidLevel) continue;

      structure[normalizedDeptName][normalizedLevelName] = {};

      // Special handling for Jupeb - it has direct session structure
      if (normalizedDeptName === 'Jupeb') {
        // Get session folders directly under the subject
        const sessions = await listFolders(levelFolder.id, apiKey);
        
        for (const session of sessions) {
          const normalizedSessionName = normalizeFolderName(session.name);
          // Get PDF files in this session
          const files = await listFiles(session.id, apiKey);
          structure[normalizedDeptName][normalizedLevelName][normalizedSessionName] = files;
        }
      } else {
        // Standard structure for other departments
        // Get semester folders
        const semesters = await listFolders(levelFolder.id, apiKey);

        for (const semester of semesters) {
          const normalizedSemesterName = normalizeFolderName(semester.name);
          structure[normalizedDeptName][normalizedLevelName][normalizedSemesterName] = {};

          // Get session folders
          const sessions = await listFolders(semester.id, apiKey);

          for (const session of sessions) {
            const normalizedSessionName = normalizeFolderName(session.name);
            // Get PDF files in this session
            const files = await listFiles(session.id, apiKey);
            structure[normalizedDeptName][normalizedLevelName][normalizedSemesterName][normalizedSessionName] = files;
          }
        }
      }
    }
  }

  return structure;
}

/**
 * Check if cache is still valid
 */
function isCacheValid() {
  if (!cache.data || !cache.timestamp) {
    return false;
  }
  
  const age = Date.now() - cache.timestamp;
  return age < cache.ttl;
}

/**
 * Main handler for Vercel Serverless Function
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
        message: 'API credentials not configured. Check environment variables.'
      });
      return;
    }

    // Department configuration (from config.js)
    const departments = [
      "Accounting", "Architecture", "Biochemistry", "Business Administration",
      "Computer Science", "Criminology", "Cybersecurity", "Economics",
      "Human Anatomy", "Human Physiology", "Industrial Chemistry",
      "International Relations", "Jupeb", "Law", "Mass Communication",
      "Microbiology", "Nursing", "Political Science", "Psychology",
      "Software Engineering"
    ];

    const levelExceptions = {
      "Human Anatomy": [100],
      "Human Physiology": [100],
      "Software Engineering": [100],
      "Nursing": [100, 200],
      "Jupeb": ["Art", "Business ", "Science"] // Note: Keep original names to match Google Drive
    };

    const defaultLevels = [100, 200, 300, 400];

    // Check if we have valid cached data
    if (isCacheValid()) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=1800'); // Cache on client for 30 minutes
      res.status(200).json({
        data: cache.data,
        cached: true,
        timestamp: cache.timestamp
      });
      return;
    }

    // Fetch fresh data from Google Drive API
    const structure = await fetchStructure(
      rootFolderId, 
      apiKey, 
      departments, 
      levelExceptions, 
      defaultLevels
    );

    // Update cache
    cache.data = structure;
    cache.timestamp = Date.now();

    // Return response
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=1800'); // Cache on client for 30 minutes
    res.status(200).json({
      data: structure,
      cached: false,
      timestamp: cache.timestamp
    });

  } catch (error) {
    console.error('Error in serverless function:', error);
    res.status(500).json({ 
      error: 'Failed to fetch data',
      message: error.message
    });
  }
};

