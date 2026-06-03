<?php
/**
 * PHP API Endpoint: Auto-Generated Progress Coverage (Per-Session).
 * Scans a specific department's Drive hierarchy to see if a target session exists
 * and has PDFs. Direct port of api/coverage.js for cPanel/PHP hosting.
 *
 * Query parameters:
 *   department - Department name (e.g. "Computer Science")
 *   session    - Target session (e.g. "2025/26")
 *   refresh    - "1" to bypass cache
 *
 * @package CURB\API
 */

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . '_utils.php';

// ──────────────────────────────────────────────────────────────────────
// Coverage-Specific Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Normalize a session label for folder-name matching.
 * More aggressive than the canonical normalizeSessionLabel — lowercases,
 * strips "session", and normalizes separators for Drive folder comparison.
 *
 * @param string $label Raw folder name.
 * @return string Normalized label for comparison.
 */
function normalizeSessionFolderName(string $label): string
{
    if ($label === '') {
        return '';
    }

    $compact = normalizeFolderName($label);
    $compact = strtolower($compact);
    $compact = preg_replace('/\bsession\b/', '', $compact);
    $compact = preg_replace('/[~\-_]/', '/', $compact);
    $compact = preg_replace('/\s*\/\s*/', '/', $compact);
    $compact = preg_replace('/\s+/', ' ', $compact);
    $compact = trim($compact);

    if (preg_match('/(\d{4})\/(\d{2}|\d{4})/', $compact, $match)) {
        $startYear   = $match[1];
        $endRaw      = $match[2];
        $endTwoDigit = strlen($endRaw) === 4 ? substr($endRaw, -2) : str_pad($endRaw, 2, '0', STR_PAD_LEFT);
        return "{$startYear}/{$endTwoDigit}";
    }

    return $compact;
}

/**
 * Extract numeric tokens from a session name for fuzzy matching.
 *
 * @param string $sessionName Session name string.
 * @return list<string> Array of numeric strings found.
 */
function extractSessionNumbers(string $sessionName): array
{
    if (preg_match_all('/\d+/', $sessionName, $matches)) {
        return $matches[0];
    }
    return [];
}

/**
 * Find the target session folder inside a parent folder.
 * Uses exact normalized label matching first, then fuzzy numeric matching.
 *
 * @param string $parentId          Parent folder Drive ID.
 * @param string $targetSessionName Desired session (e.g. "2025/26 Session").
 * @param string $apiKey            Google API key.
 * @return array|null Matching folder or null.
 * @throws RuntimeException On API error.
 */
function findTargetSessionFolder(string $parentId, string $targetSessionName, string $apiKey): ?array
{
    $folders = listFolders($parentId, $apiKey);

    // Prefer exact match against normalized session labels
    $normalizedTargetLabel = normalizeSessionFolderName($targetSessionName);
    if ($normalizedTargetLabel !== '') {
        foreach ($folders as $f) {
            if (normalizeSessionFolderName($f['name'] ?? '') === $normalizedTargetLabel) {
                return $f;
            }
        }
    }

    // Fuzzy numerical matching
    $targetNums = extractSessionNumbers($targetSessionName);

    if (count($targetNums) === 0) {
        $normalizedTarget = strtolower(normalizeFolderName($targetSessionName));
        foreach ($folders as $f) {
            if (str_contains(strtolower(normalizeFolderName($f['name'] ?? '')), $normalizedTarget)) {
                return $f;
            }
        }
        return null;
    }

    foreach ($folders as $f) {
        $folderNameLower = strtolower($f['name'] ?? '');
        $allFound = true;
        foreach ($targetNums as $num) {
            if (!str_contains($folderNameLower, $num)) {
                $allFound = false;
                break;
            }
        }
        if ($allFound) {
            return $f;
        }
    }

    return null;
}

/**
 * Check whether a folder contains at least one PDF.
 *
 * @param string $folderId Drive folder ID.
 * @param string $apiKey   Google API key.
 * @return bool True if any PDF exists.
 * @throws RuntimeException On API error.
 */
function hasFiles(string $folderId, string $apiKey): bool
{
    $query = urlencode("'{$folderId}' in parents and mimeType='application/pdf' and trashed=false");
    $url   = "https://www.googleapis.com/drive/v3/files?q={$query}&fields=files(id)&pageSize=1&key={$apiKey}";

    $response = makeApiRequest($url);
    return isset($response['files']) && count($response['files']) > 0;
}

/**
 * Check whether a folder tree contains at least one PDF (BFS).
 * Handles structures where PDFs are placed in nested course folders.
 *
 * @param string $rootFolderId Session folder ID.
 * @param string $apiKey       Google API key.
 * @return bool True if any PDF exists in the subtree.
 * @throws RuntimeException On API error.
 */
function hasFilesDeep(string $rootFolderId, string $apiKey): bool
{
    if ($rootFolderId === '') {
        return false;
    }

    $queue        = [['id' => $rootFolderId, 'depth' => 0]];
    $visited      = [];
    $scannedCount = 0;

    while (count($queue) > 0) {
        $current = array_shift($queue);

        if (!isset($current['id']) || $current['id'] === '' || isset($visited[$current['id']])) {
            continue;
        }

        $visited[$current['id']] = true;
        $scannedCount++;

        if ($scannedCount > COVERAGE_MAX_FOLDERS_SCANNED) {
            break;
        }

        if (hasFiles($current['id'], $apiKey)) {
            return true;
        }

        if ($current['depth'] >= COVERAGE_MAX_DEPTH) {
            continue;
        }

        $children = listFolders($current['id'], $apiKey);
        foreach ($children as $child) {
            if (isset($child['id']) && $child['id'] !== '' && !isset($visited[$child['id']])) {
                $queue[] = ['id' => $child['id'], 'depth' => $current['depth'] + 1];
            }
        }
    }

    return false;
}

// ──────────────────────────────────────────────────────────────────────
// Rate Limiting (file-lock based)
// ──────────────────────────────────────────────────────────────────────

/**
 * Try to acquire a scan slot. Returns a lock file path on success, null if limit reached.
 *
 * @return string|null Lock file path or null.
 */
function acquireScanSlot(): ?string
{
    $lockDir = CACHE_DIR . DIRECTORY_SEPARATOR . '_locks';
    if (!is_dir($lockDir)) {
        @mkdir($lockDir, 0755, true);
    }

    // Count active locks (files less than 120 seconds old)
    $activeLocks = 0;
    $files = @scandir($lockDir);
    if ($files !== false) {
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') {
                continue;
            }
            $lockFile = $lockDir . DIRECTORY_SEPARATOR . $f;
            $mtime = @filemtime($lockFile);
            if ($mtime !== false && (time() - $mtime) < 120) {
                $activeLocks++;
            } else {
                // Stale lock, clean up
                @unlink($lockFile);
            }
        }
    }

    if ($activeLocks >= COVERAGE_MAX_CONCURRENT_SCANS) {
        return null;
    }

    // Create our lock file
    $lockFile = $lockDir . DIRECTORY_SEPARATOR . uniqid('scan_', true) . '.lock';
    @file_put_contents($lockFile, (string) getmypid());

    return $lockFile;
}

/**
 * Release a scan slot.
 *
 * @param string|null $lockFile Lock file path.
 * @return void
 */
function releaseScanSlot(?string $lockFile): void
{
    if ($lockFile !== null && is_file($lockFile)) {
        @unlink($lockFile);
    }
}

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

$lockFile = null;

try {
    $apiKey       = GOOGLE_DRIVE_API_KEY;
    $rootFolderId = GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if ($apiKey === '' || $rootFolderId === '') {
        sendJson(500, ['error' => 'Server configuration error']);
    }

    $departmentQuery    = getQueryParam('department');
    $targetSessionQuery = getQueryParam('session');
    $forceRefresh       = getQueryParam('refresh') === '1' || getQueryParam('force') === '1';

    // Validate required params
    if ($departmentQuery === '' || $targetSessionQuery === '') {
        sendJson(400, ['error' => 'Missing department or session parameter']);
    }

    // Validate length
    if (strlen($departmentQuery) > COVERAGE_MAX_PARAM_LENGTH || strlen($targetSessionQuery) > COVERAGE_MAX_PARAM_LENGTH) {
        sendJson(400, ['error' => 'Invalid parameter length']);
    }

    // Validate content
    if (hasInvalidChars($departmentQuery) || hasInvalidChars($targetSessionQuery)) {
        sendJson(400, ['error' => 'Invalid department or session value']);
    }

    // Ensure "Session" is in the name
    if (stripos($targetSessionQuery, 'session') === false) {
        $targetSessionQuery .= ' Session';
    }

    $deptNameTarget = normalizeFolderName(str_replace('~', '/', $departmentQuery));
    $cacheKey       = "coverage:{$deptNameTarget}_{$targetSessionQuery}";

    // Check cache
    if (!$forceRefresh) {
        $cached = cacheGet($cacheKey, COVERAGE_CACHE_TTL);
        if ($cached !== null) {
            header('X-Cache: HIT');
            header('Cache-Control: public, s-maxage=300, stale-while-revalidate=600');
            sendJson(200, [
                'department' => $deptNameTarget,
                'session'    => $targetSessionQuery,
                'data'       => $cached['data'] ?? [],
                'cached'     => true,
            ]);
        }
    }

    // Rate limit
    $lockFile = acquireScanSlot();
    if ($lockFile === null) {
        sendJson(429, [
            'error'   => 'Too many concurrent scans',
            'message' => 'Please wait a moment and try again.',
        ]);
    }

    // Find department folder
    $rootFolders = listFolders($rootFolderId, $apiKey);
    $deptFolder  = null;
    foreach ($rootFolders as $f) {
        if (normalizeFolderName($f['name'] ?? '') === $deptNameTarget) {
            $deptFolder = $f;
            break;
        }
    }

    if ($deptFolder === null) {
        sendJson(404, ['error' => 'Department not found']);
    }

    $isJupeb = ($deptNameTarget === 'Jupeb');
    $levels  = listFolders($deptFolder['id'], $apiKey);

    // Apply level exceptions
    $validLevels = LEVEL_EXCEPTIONS[$deptNameTarget] ?? null;
    if ($validLevels !== null) {
        $levels = array_values(array_filter($levels, function (array $f) use ($validLevels): bool {
            if (preg_match('/(\d+)/', $f['name'] ?? '', $levelMatch)) {
                return in_array((int) $levelMatch[1], $validLevels, true);
            }
            return in_array($f['name'] ?? '', $validLevels, true);
        }));
    }

    $coverageData = [];

    foreach ($levels as $level) {
        if ($isJupeb) {
            // Jupeb: no semester sub-level
            $sessionFolder = findTargetSessionFolder($level['id'], $targetSessionQuery, $apiKey);
            $hasPdf = false;
            if ($sessionFolder !== null) {
                $hasPdf = hasFilesDeep($sessionFolder['id'], $apiKey);
            }
            $coverageData[] = [
                'level'    => $level['name'] ?? '',
                'semester' => 'Full Year',
                'status'   => $hasPdf ? 'uploaded' : ($sessionFolder !== null ? 'empty-folder' : 'missing-folder'),
            ];
        } else {
            // Standard department: levels → semesters → sessions
            $subFolders = listFolders($level['id'], $apiKey);

            foreach ($subFolders as $semester) {
                $sessionFolder = findTargetSessionFolder($semester['id'], $targetSessionQuery, $apiKey);
                $hasPdf = false;
                if ($sessionFolder !== null) {
                    $hasPdf = hasFilesDeep($sessionFolder['id'], $apiKey);
                }
                $coverageData[] = [
                    'level'    => $level['name'] ?? '',
                    'semester' => $semester['name'] ?? '',
                    'status'   => $hasPdf ? 'uploaded' : ($sessionFolder !== null ? 'empty-folder' : 'missing-folder'),
                ];
            }
        }
    }

    // Sort: by level then by semester
    usort($coverageData, function (array $a, array $b): int {
        $cmp = strcmp($a['level'], $b['level']);
        if ($cmp !== 0) {
            return $cmp;
        }
        return strcmp($a['semester'], $b['semester']);
    });

    // Cache results
    cacheSet($cacheKey, [
        'data'      => $coverageData,
        'timestamp' => time(),
    ]);

    // Release lock before sending response
    releaseScanSlot($lockFile);
    $lockFile = null;

    header('X-Cache: ' . ($forceRefresh ? 'BYPASS' : 'MISS'));
    if ($forceRefresh) {
        header('Cache-Control: no-store, no-cache, must-revalidate');
    } else {
        header('Cache-Control: public, s-maxage=300, stale-while-revalidate=600');
    }

    sendJson(200, [
        'department'   => $deptNameTarget,
        'session'      => $targetSessionQuery,
        'data'         => $coverageData,
        'cached'       => false,
        'forceRefresh' => $forceRefresh,
    ]);

} catch (Throwable $e) {
    releaseScanSlot($lockFile);
    error_log('CURB coverage.php error: ' . $e->getMessage());
    sendJson(500, [
        'error'   => 'Failed to generate coverage',
        'message' => $e->getMessage(),
    ]);
}
