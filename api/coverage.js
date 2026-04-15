// Serverless Function: Auto-Generated Progress Coverage (Per-Session)
// Scans a specific department's Drive hierarchy to see if a TARGET SESSION exists and has PDFs.
// Very fast because it uses targeted Google Drive queries.

const {
  LEVEL_EXCEPTIONS,
  normalizeFolderName,
  makeAPIRequest,
  listFolders,
  setupCors,
  handlePreflightAndMethodGuard,
  normalizeSessionLabel
} = require('./_utils');

const coverageCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_PARAM_LENGTH = 120;

// Item #13: Rate limiter — track active scans to prevent Google API quota exhaustion.
// In serverless, this only protects within a single warm instance, but that's still valuable.
let activeScans = 0;
const MAX_CONCURRENT_SCANS = 5;

/**
 * Extract numeric tokens from a session name for fuzzy matching.
 * @param {string} sessionName - Session name string.
 * @returns {Array<string>} Array of numeric strings found.
 */
function extractSessionNumbers(sessionName) {
  return (sessionName.match(/\d+/g) || []);
}

/**
 * Normalize a session label for folder-name matching.
 * More aggressive than the canonical normalizeSessionLabel — lowercases,
 * strips "session", and normalizes separators for Drive folder comparison.
 * @param {string} label - Raw folder name.
 * @returns {string} Normalized label for comparison.
 */
function normalizeSessionFolderName(label) {
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

/**
 * Find the target session folder inside a parent.
 * Uses exact normalized label matching first, then falls back to fuzzy numeric matching.
 * @param {string} parentId - Parent folder Drive ID.
 * @param {string} targetSessionName - Desired session (e.g. "2025/26 Session").
 * @param {string} apiKey - Google API key.
 * @returns {Promise<Object|null>} Matching folder or null.
 */
async function findTargetSessionFolder(parentId, targetSessionName, apiKey) {
  const folders = await listFolders(parentId, apiKey);

  // Prefer exact match against normalized session labels
  const normalizedTargetLabel = normalizeSessionFolderName(targetSessionName);
  if (normalizedTargetLabel) {
    const exactMatch = folders.find(f => normalizeSessionFolderName(f.name) === normalizedTargetLabel);
    if (exactMatch) {
      return exactMatch;
    }
  }

  // Fuzzy numerical matching (e.g. target "2024/25" matches "2024-2025 Session")
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

/**
 * Check whether a folder contains at least one PDF.
 * @param {string} folderId - Drive folder ID.
 * @param {string} apiKey - Google API key.
 * @returns {Promise<boolean>} True if any PDF exists.
 */
async function hasFiles(folderId, apiKey) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&pageSize=1&key=${apiKey}`;
  const response = await makeAPIRequest(url);
  return response.files && response.files.length > 0;
}

/**
 * Check whether a folder tree contains at least one PDF (BFS).
 * Handles structures where PDFs are placed in nested course folders.
 * @param {string} rootFolderId - Session folder ID.
 * @param {string} apiKey - Google API key.
 * @returns {Promise<boolean>} True if any PDF exists in the subtree.
 */
async function hasFilesDeep(rootFolderId, apiKey) {
  if (!rootFolderId) return false;

  const queue = [{ id: rootFolderId, depth: 0 }];
  const visited = new Set();
  const MAX_DEPTH = 3;            // Item #13: Tightened from 5 → 3
  const MAX_FOLDERS_SCANNED = 50; // Item #13: Tightened from 300 → 50
  let scannedCount = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !current.id || visited.has(current.id)) {
      continue;
    }

    visited.add(current.id);
    scannedCount += 1;

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

/**
 * Main handler for Vercel serverless function.
 * @param {Object} req - HTTP request.
 * @param {Object} res - HTTP response.
 */
module.exports = async (req, res) => {
  setupCors(req, res);
  if (handlePreflightAndMethodGuard(req, res)) return;

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

  // Item #13: Rate limiter — reject if too many scans active in this instance
  if (activeScans >= MAX_CONCURRENT_SCANS) {
    return res.status(429).json({
      error: 'Too many concurrent scans',
      message: 'Please wait a moment and try again.'
    });
  }

  activeScans += 1;

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
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      department: deptNameTarget,
      session: targetSessionQuery,
      data: coverageData,
      cached: false
    });

  } catch (error) {
    console.error(`Coverage API Error:`, error);
    return res.status(500).json({ error: 'Failed to generate coverage', message: error.message });
  } finally {
    activeScans -= 1;
  }
};
