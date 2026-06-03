<?php
/**
 * PHP API Endpoint: Lazy-Loading Google Drive Browser.
 * Fetches contents of a specific folder path on-demand.
 * Direct port of api/browse.js for cPanel/PHP hosting.
 *
 * Query parameters:
 *   path    - Folder path (e.g. "/Computer Science/100 Level/1st Semester")
 *   type    - "folders" or "files" (default: "folders")
 *   refresh - "1" to bypass cache
 *
 * @package CURB\API
 */

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . '_utils.php';

// ──────────────────────────────────────────────────────────────────────
// CORS + Method Guard
// ──────────────────────────────────────────────────────────────────────

setupCors();
if (handlePreflightAndMethodGuard()) {
    exit;
}

// ──────────────────────────────────────────────────────────────────────
// Main Handler
// ──────────────────────────────────────────────────────────────────────

try {
    // Verify credentials
    $apiKey       = GOOGLE_DRIVE_API_KEY;
    $rootFolderId = GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if ($apiKey === '' || $rootFolderId === '') {
        error_log('CURB browse.php: Missing environment variables');
        sendJson(500, [
            'error'   => 'Server configuration error',
            'message' => 'API credentials not configured.',
        ]);
    }

    // Parse query parameters
    $rawPath = getQueryParam('path', '/');
    $rawType = getQueryParam('type', 'folders');
    $path    = $rawPath !== '' ? $rawPath : '/';
    $type    = strtolower($rawType);
    $forceRefresh = getQueryParam('refresh') === '1' || getQueryParam('force') === '1';

    // Validate type
    $allowedTypes = ['folders', 'files'];
    if (!in_array($type, $allowedTypes, true)) {
        sendJson(400, [
            'error'   => 'Invalid query parameter',
            'message' => 'type must be either "folders" or "files".',
        ]);
    }

    // Validate path length
    if (strlen($path) > BROWSE_MAX_PATH_LENGTH) {
        sendJson(400, [
            'error'   => 'Invalid query parameter',
            'message' => 'path is too long.',
        ]);
    }

    // Parse segments
    $segments = array_values(array_filter(explode('/', $path), function (string $s): bool {
        return $s !== '';
    }));

    // Validate segment count
    if (count($segments) > BROWSE_MAX_SEGMENTS) {
        sendJson(400, [
            'error'   => 'Invalid query parameter',
            'message' => 'path has too many segments.',
        ]);
    }

    // Validate segment content
    foreach ($segments as $segment) {
        if (strlen($segment) > BROWSE_MAX_SEGMENT_LENGTH || hasInvalidChars($segment)) {
            sendJson(400, [
                'error'   => 'Invalid query parameter',
                'message' => 'path contains invalid segment values.',
            ]);
        }
    }

    // Check cache
    $cacheKey = "browse:{$path}:{$type}";
    if (!$forceRefresh) {
        $cached = cacheGet($cacheKey, BROWSE_CACHE_TTL);
        if ($cached !== null) {
            header('X-Cache: HIT');
            header('Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600');
            sendJson(200, [
                'path'      => $path,
                'type'      => $type,
                'data'      => $cached['data'] ?? [],
                'cached'    => true,
                'timestamp' => $cached['timestamp'] ?? time(),
            ]);
        }
    }

    // Navigate to target folder
    $currentFolderId = $rootFolderId;

    foreach ($segments as $segment) {
        $folder = findFolderByName($currentFolderId, $segment, $apiKey);

        if ($folder === null) {
            sendJson(404, [
                'error'   => 'Path not found',
                'message' => "Folder \"{$segment}\" not found in path",
                'path'    => $path,
            ]);
        }

        $currentFolderId = $folder['id'];
    }

    // Fetch requested content
    $data = [];

    if ($type === 'files') {
        // Get PDF files in this folder
        $data = listFiles($currentFolderId, $apiKey);
    } else {
        // Get subfolders
        $folders = listFolders($currentFolderId, $apiKey, 'files(id,name,modifiedTime)');

        // Filter and normalize folder names
        $data = array_map(function (array $f): array {
            return [
                'id'           => $f['id'] ?? '',
                'name'         => normalizeFolderName($f['name'] ?? ''),
                'modifiedTime' => $f['modifiedTime'] ?? null,
            ];
        }, $folders);

        // Apply level filtering for departments with special structures
        if (count($segments) === 1) {
            $deptName   = normalizeFolderName($segments[0]);
            $validLevels = LEVEL_EXCEPTIONS[$deptName] ?? null;

            if ($validLevels !== null) {
                $data = array_values(array_filter($data, function (array $f) use ($validLevels): bool {
                    if (preg_match('/(\d+)/', $f['name'], $levelMatch)) {
                        return in_array((int) $levelMatch[1], $validLevels, true);
                    }
                    // For non-numeric levels (Jupeb subjects)
                    return in_array($f['name'], $validLevels, true);
                }));
            }
        }
    }

    // Store in cache
    cacheSet($cacheKey, [
        'data'      => $data,
        'timestamp' => time(),
    ]);

    // Send response
    header('X-Cache: ' . ($forceRefresh ? 'BYPASS' : 'MISS'));
    if ($forceRefresh) {
        header('Cache-Control: no-store, no-cache, must-revalidate');
    } else {
        header('Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600');
    }

    sendJson(200, [
        'path'         => $path,
        'type'         => $type,
        'data'         => $data,
        'cached'       => false,
        'forceRefresh' => $forceRefresh,
        'timestamp'    => time(),
    ]);

} catch (Throwable $e) {
    error_log('CURB browse.php error: ' . $e->getMessage());
    sendJson(500, [
        'error'   => 'Failed to fetch data',
        'message' => $e->getMessage(),
    ]);
}
