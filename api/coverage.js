// Serverless Function: Auto-Generated Progress Coverage (Per-Session)
// Scans a specific department's Drive hierarchy to see if a TARGET SESSION exists and has PDFs.
// Very fast because it uses targeted Google Drive queries.

const https = require('https');

const coverageCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_PARAM_LENGTH = 120;

function normalizeFolderName(name) {
  if (!name || typeof name !== 'string') return name;
  return name.trim().replace(/\s+/g, ' ');
}

function makeAPIRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        } else {
          reject(new Error(`API request failed [${res.statusCode}]: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function listFolders(folderId, apiKey) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=name&key=${apiKey}`;
  const response = await makeAPIRequest(url);
  return response.files || [];
}

function extractSessionNumbers(sessionName) {
  return (sessionName.match(/\d+/g) || []); 
}

function normalizeSessionLabel(label) {
  if (!label || typeof label !== 'string') {
    return '';
  }

  const compact = normalizeFolderName(label)
    .toLowerCase()
    .replace(/\bsession\b/g, '')
    .replace(/[~\-_]/g, '/')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();

  const match = compact.match(/(\d{4})\/(\d{2}|\d{4})/);
  if (!match) {
    return compact;
  }

  const startYear = match[1];
  const endRaw = match[2];
  const endTwoDigit = endRaw.length === 4 ? endRaw.slice(-2) : endRaw.padStart(2, '0');
  return `${startYear}/${endTwoDigit}`;
}

async function findTargetSessionFolder(parentId, targetSessionName, apiKey) {
  // We MUST fetch all folders and filter in JS because Google Drive's API 'q' parameter 
  // fails silently or doesn't support exact equality matches on names containing slashes (e.g., '2025/26 Session')
  const folders = await listFolders(parentId, apiKey);

  // Prefer exact match against normalized session labels to avoid wrong fuzzy hits.
  const normalizedTargetLabel = normalizeSessionLabel(targetSessionName);
  if (normalizedTargetLabel) {
    const exactMatch = folders.find(f => normalizeSessionLabel(f.name) === normalizedTargetLabel);
    if (exactMatch) {
      return exactMatch;
    }
  }
  
  // Use fuzzy numerical matching to avoid exact string match failures 
  // e.g., target "2024/25" will match folder "2024-2025 Session"
  const targetNums = extractSessionNumbers(targetSessionName);
  
  if (targetNums.length === 0) {
      const normalizedTarget = normalizeFolderName(targetSessionName).toLowerCase();
      return folders.find(f => normalizeFolderName(f.name).toLowerCase().includes(normalizedTarget)) || null;
  }

  return folders.find(f => {
      const folderNameLower = f.name.toLowerCase();
      return targetNums.every(num => folderNameLower.includes(num));
  }) || null;
}

async function hasFiles(folderId, apiKey) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&pageSize=1&key=${apiKey}`;
  const response = await makeAPIRequest(url);
  return response.files && response.files.length > 0;
}

/**
 * Check whether a folder tree contains at least one PDF.
 * This handles structures where PDFs are placed in nested course folders.
 * @param {string} rootFolderId - Session folder ID.
 * @param {string} apiKey - Google API key.
 * @returns {Promise<boolean>} True if any PDF exists in the subtree.
 */
async function hasFilesDeep(rootFolderId, apiKey) {
  if (!rootFolderId) return false;

  const queue = [{ id: rootFolderId, depth: 0 }];
  const visited = new Set();
  const MAX_DEPTH = 5;
  const MAX_FOLDERS_SCANNED = 300;
  let scannedCount = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !current.id || visited.has(current.id)) {
      continue;
    }

    visited.add(current.id);
    scannedCount += 1;

    // Prevent runaway scans on unexpectedly large trees.
    if (scannedCount > MAX_FOLDERS_SCANNED) {
      break;
    }

    const hasPdfDirectly = await hasFiles(current.id, apiKey);
    if (hasPdfDirectly) {
      return true;
    }

    if (current.depth >= MAX_DEPTH) {
      continue;
    }

    const children = await listFolders(current.id, apiKey);
    for (const child of children) {
      if (child && child.id && !visited.has(child.id)) {
        queue.push({ id: child.id, depth: current.depth + 1 });
      }
    }
  }

  return false;
}

const LEVEL_EXCEPTIONS = {
  "Jupeb": ["Art", "Business", "Science"],
};

module.exports = async (req, res) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  const requestOrigin = req.headers.origin || '';

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  const departmentQuery = typeof req.query.department === 'string' ? req.query.department.trim() : '';
  let targetSessionQuery = typeof req.query.session === 'string' ? req.query.session.trim() : '';

  if (!apiKey || !rootFolderId) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!departmentQuery || !targetSessionQuery) {
    return res.status(400).json({ error: 'Missing department or session parameter' });
  }

  if (departmentQuery.length > MAX_PARAM_LENGTH || targetSessionQuery.length > MAX_PARAM_LENGTH) {
    return res.status(400).json({ error: 'Invalid parameter length' });
  }

  if (/[\u0000-\u001F\u007F\\]/.test(departmentQuery) || /[\u0000-\u001F\u007F\\]/.test(targetSessionQuery)) {
    return res.status(400).json({ error: 'Invalid department or session value' });
  }

  // Ensure "Session" is in the name, e.g. user passes "2025/26" we look for "2025/26 Session"
  if (!targetSessionQuery.toLowerCase().includes('session')) {
    targetSessionQuery += ' Session';
  }

  const deptNameTarget = normalizeFolderName(departmentQuery.replace(/~/g, '/'));
  const cacheKey = `${deptNameTarget}_${targetSessionQuery}`;

  const cached = coverageCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ department: deptNameTarget, session: targetSessionQuery, data: cached.data, cached: true });
  }

  try {
    const rootFolders = await listFolders(rootFolderId, apiKey);
    const deptFolder = rootFolders.find(f => normalizeFolderName(f.name) === deptNameTarget);
    if (!deptFolder) return res.status(404).json({ error: 'Department not found' });

    const isJupeb = deptNameTarget === 'Jupeb';
    let levels = await listFolders(deptFolder.id, apiKey);
    
    const validLevels = LEVEL_EXCEPTIONS[deptNameTarget];
    if (validLevels) {
      levels = levels.filter(f => {
        const levelMatch = f.name.match(/(\d+)/);
        if (levelMatch) return validLevels.includes(parseInt(levelMatch[1]));
        return validLevels.includes(f.name);
      });
    }

    const coverageData = [];

    await Promise.all(levels.map(async (level) => {
      const subFolders = await listFolders(level.id, apiKey);

      if (isJupeb) {
        // Jupeb: Subject (Level) -> Session (Target)
        // Check if the subject folder contains the target session directly
        const sessionFolder = await findTargetSessionFolder(level.id, targetSessionQuery, apiKey);
        let hasPdf = false;
        if (sessionFolder) {
          hasPdf = await hasFilesDeep(sessionFolder.id, apiKey);
        }
        coverageData.push({
            level: level.name,
            semester: 'Full Year',
            status: hasPdf ? 'uploaded' : (sessionFolder ? 'empty-folder' : 'missing-folder')
        });
      } else {
        // Standard: Level -> Semesters -> Session (Target)
        await Promise.all(subFolders.map(async (semester) => {
          const sessionFolder = await findTargetSessionFolder(semester.id, targetSessionQuery, apiKey);
          let hasPdf = false;
          if (sessionFolder) {
              hasPdf = await hasFilesDeep(sessionFolder.id, apiKey);
          }
          coverageData.push({
              level: level.name,
              semester: semester.name,
              status: hasPdf ? 'uploaded' : (sessionFolder ? 'empty-folder' : 'missing-folder')
          });
        }));
      }
    }));

    // Sort properly
    coverageData.sort((a, b) => {
        if (a.level !== b.level) return a.level.localeCompare(b.level);
        return a.semester.localeCompare(b.semester);
    });

    coverageCache.set(cacheKey, { data: coverageData, timestamp: Date.now() });
    
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      department: deptNameTarget,
      session: targetSessionQuery,
      data: coverageData,
      cached: false
    });

  } catch (error) {
    console.error(`Coverage API Error:`, error);
    return res.status(500).json({ error: 'Failed to generate coverage', message: error.message });
  }
};
