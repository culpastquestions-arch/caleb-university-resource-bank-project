// Serverless Function: Auto-Generated Progress Coverage
// This endpoint scans a single department's Google Drive structure to build a coverage matrix.
// Using Promise.all everywhere possible to ensure it completes within Vercel's 10s timeout.

const https = require('https');

// Per-department cache with 5-minute TTL
const coverageCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

// List all folders in a parent
async function listFolders(folderId, apiKey) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=name&key=${apiKey}`;
  const response = await makeAPIRequest(url);
  return response.files || [];
}

// Quick check: does this folder have any PDF files?
// We only need fields=files(id) and pageSize=1 to be as fast as possible
async function hasFiles(folderId, apiKey) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&pageSize=1&key=${apiKey}`;
  const response = await makeAPIRequest(url);
  return response.files && response.files.length > 0;
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
  const departmentQuery = req.query.department;

  if (!apiKey || !rootFolderId) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!departmentQuery) {
    return res.status(400).json({ error: 'Missing department parameter' });
  }

  const deptNameTarget = normalizeFolderName(departmentQuery.replace(/~/g, '/'));
  
  // Check cache
  const cached = coverageCache.get(deptNameTarget);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ department: deptNameTarget, data: cached.data, cached: true });
  }

  try {
    // 1. Find the department folder
    const rootFolders = await listFolders(rootFolderId, apiKey);
    const deptFolder = rootFolders.find(f => normalizeFolderName(f.name) === deptNameTarget);
    
    if (!deptFolder) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const isJupeb = deptNameTarget === 'Jupeb';

    // 2. List Levels (or Subjects for Jupeb)
    let levels = await listFolders(deptFolder.id, apiKey);
    
    // Apply LEVEL_EXCEPTIONS if needed
    const validLevels = LEVEL_EXCEPTIONS[deptNameTarget];
    if (validLevels) {
      levels = levels.filter(f => {
        const levelMatch = f.name.match(/(\d+)/);
        if (levelMatch) return validLevels.includes(parseInt(levelMatch[1]));
        return validLevels.includes(f.name);
      });
    }

    // Build the coverage tree concurrently
    const coverageTree = [];

    // For each level
    await Promise.all(levels.map(async (level) => {
      const levelStructure = { level: level.name, semesters: [] };
      const subFolders = await listFolders(level.id, apiKey); // Semesters (or Sessions for Jupeb)

      if (isJupeb) {
        // Jupeb: Subject -> Sessions
        // subFolders are sessions
        await Promise.all(subFolders.map(async (session) => {
          const hasPdf = await hasFiles(session.id, apiKey);
          // Fake a 'None' semester so the UI is consistent
          let dummySemester = levelStructure.semesters.find(s => s.semester === 'Full Year');
          if (!dummySemester) {
            dummySemester = { semester: 'Full Year', sessions: [] };
            levelStructure.semesters.push(dummySemester);
          }
          dummySemester.sessions.push({ session: session.name, hasFiles: hasPdf });
        }));
      } else {
        // Standard: Level -> Semesters -> Sessions
        await Promise.all(subFolders.map(async (semester) => {
          const semesterData = { semester: semester.name, sessions: [] };
          const sessionFolders = await listFolders(semester.id, apiKey);
          
          await Promise.all(sessionFolders.map(async (session) => {
            const hasPdf = await hasFiles(session.id, apiKey);
            semesterData.sessions.push({ session: session.name, hasFiles: hasPdf });
          }));

          // Sort sessions descending (latest first)
          semesterData.sessions.sort((a, b) => b.session.localeCompare(a.session));
          levelStructure.semesters.push(semesterData);
        }));
        
        // Sort semesters (1st Semester, 2nd Semester)
        levelStructure.semesters.sort((a, b) => a.semester.localeCompare(b.semester));
      }

      coverageTree.push(levelStructure);
    }));

    // Sort levels mostly logically (100 Level, 200 Level)
    coverageTree.sort((a, b) => a.level.localeCompare(b.level));

    // Cache and return
    coverageCache.set(deptNameTarget, { data: coverageTree, timestamp: Date.now() });
    
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      department: deptNameTarget,
      data: coverageTree,
      cached: false
    });

  } catch (error) {
    console.error(`Coverage API Error for ${deptNameTarget}:`, error);
    return res.status(500).json({ error: 'Failed to generate coverage', message: error.message });
  }
};
