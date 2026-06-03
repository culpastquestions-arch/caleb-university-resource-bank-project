<?php
/**
 * PHP API Endpoint: Team Data from Google Sheets CSV.
 * Fetches team member data from published Google Sheets for the About page.
 * Supports session-based filtering (e.g. ?session=2025/26).
 * Direct port of api/team.js for cPanel/PHP hosting.
 *
 * Query parameters:
 *   session - Academic session filter (e.g. "2025/26") — optional
 *   refresh - "1" to bypass cache
 *
 * @package CURB\API
 */

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . '_utils.php';

// ──────────────────────────────────────────────────────────────────────
// Team-Specific Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Photo URL column key variants (tried in priority order).
 *
 * @var list<string>
 */
const PHOTO_URL_KEYS = [
    'photourl',
    'photo url',
    'photo_url',
    'photo',
    'imageurl',
    'image url',
    'image_url',
    'image',
    'picture',
    'avatar',
];

/**
 * Build a numeric sort key for an academic session label.
 * Higher values represent newer sessions.
 *
 * @param string $sessionLabel Session label.
 * @return float Sort key.
 */
function getSessionSortKey(string $sessionLabel): float
{
    $normalized = normalizeSessionLabel($sessionLabel);

    if (preg_match('/^(\d{4})\/(\d{2})$/', $normalized, $fullMatch)) {
        $startYear       = (int) $fullMatch[1];
        $endYearTwoDigit = (int) $fullMatch[2];
        return ($startYear * 100) + $endYearTwoDigit;
    }

    if (preg_match('/(\d{4})/', $normalized, $fallbackMatch)) {
        return ((int) $fallbackMatch[1]) * 100;
    }

    return -INF;
}

/**
 * Compare two session labels with latest-first ordering.
 *
 * @param string $a Session A.
 * @param string $b Session B.
 * @return int Sort comparator result.
 */
function compareSessionsDesc(string $a, string $b): int
{
    $keyDiff = getSessionSortKey($b) - getSessionSortKey($a);

    if ($keyDiff > 0) {
        return 1;
    }
    if ($keyDiff < 0) {
        return -1;
    }

    return strcmp(normalizeSessionLabel($b), normalizeSessionLabel($a));
}

/**
 * Extract unique session values from an array of rows, sorted descending (latest first).
 *
 * @param list<array<string, string>> $rows Array of parsed row objects.
 * @return list<string> Unique session strings.
 */
function extractSessions(array $rows): array
{
    $sessionSet = [];

    foreach ($rows as $row) {
        $session = normalizeSessionLabel($row['session'] ?? '');
        if ($session !== '') {
            $sessionSet[$session] = true;
        }
    }

    $sessions = array_keys($sessionSet);
    usort($sessions, 'compareSessionsDesc');

    return $sessions;
}

/**
 * Fetch and parse all executives from Google Sheets CSV (all sessions).
 *
 * @param string $sheetUrl     Published CSV URL.
 * @param bool   $bypassCache  Whether to bypass cache.
 * @return list<array> Array of executive objects with session field.
 * @throws RuntimeException On fetch failure (if no cached data available).
 */
function fetchAllExecutives(string $sheetUrl, bool $bypassCache = false): array
{
    $cacheKey = 'team:executives';

    if (!$bypassCache) {
        $cached = cacheGet($cacheKey, TEAM_CACHE_TTL);
        if ($cached !== null && isset($cached['data'])) {
            return $cached['data'];
        }
    }

    try {
        $csvText = fetchUrl($sheetUrl);
        $data    = parseCsv($csvText);

        $executives = array_map(function (array $row): array {
            return [
                'name'     => sanitizeText($row['name'] ?? 'TBD'),
                'role'     => sanitizeText($row['role'] ?? 'Team Member'),
                'photoUrl' => formatPhotoUrl(pickRowValue($row, PHOTO_URL_KEYS)),
                'order'    => isset($row['order']) ? ((int) $row['order'] ?: 999) : 999,
                'session'  => normalizeSessionLabel($row['session'] ?? ''),
            ];
        }, $data);

        // Sort by order
        usort($executives, function (array $a, array $b): int {
            return $a['order'] - $b['order'];
        });

        cacheSet($cacheKey, ['data' => $executives, 'timestamp' => time()]);
        return $executives;

    } catch (Throwable $e) {
        error_log('CURB team.php: Failed to fetch executives: ' . $e->getMessage());

        // Return cached data if available, even if stale
        $stale = cacheGet($cacheKey, PHP_INT_MAX);
        if ($stale !== null && isset($stale['data'])) {
            return $stale['data'];
        }

        throw $e;
    }
}

/**
 * Fetch and parse all department reps from Google Sheets CSV (all sessions).
 *
 * @param string $sheetUrl     Published CSV URL.
 * @param bool   $bypassCache  Whether to bypass cache.
 * @return list<array> Array of department rep objects with session field.
 * @throws RuntimeException On fetch failure (if no cached data available).
 */
function fetchAllDepartmentReps(string $sheetUrl, bool $bypassCache = false): array
{
    $cacheKey = 'team:reps';

    if (!$bypassCache) {
        $cached = cacheGet($cacheKey, TEAM_CACHE_TTL);
        if ($cached !== null && isset($cached['data'])) {
            return $cached['data'];
        }
    }

    try {
        $csvText = fetchUrl($sheetUrl);
        $data    = parseCsv($csvText);

        $reps = array_map(function (array $row): array {
            return [
                'department' => sanitizeText($row['department'] ?? 'Unknown'),
                'name'       => sanitizeText($row['name'] ?? 'TBD'),
                'photoUrl'   => formatPhotoUrl(pickRowValue($row, PHOTO_URL_KEYS)),
                'session'    => normalizeSessionLabel($row['session'] ?? ''),
            ];
        }, $data);

        // Sort by department name
        usort($reps, function (array $a, array $b): int {
            return strcmp($a['department'], $b['department']);
        });

        cacheSet($cacheKey, ['data' => $reps, 'timestamp' => time()]);
        return $reps;

    } catch (Throwable $e) {
        error_log('CURB team.php: Failed to fetch department reps: ' . $e->getMessage());

        $stale = cacheGet($cacheKey, PHP_INT_MAX);
        if ($stale !== null && isset($stale['data'])) {
            return $stale['data'];
        }

        throw $e;
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

try {
    $executivesUrl = TEAM_SHEET_EXECUTIVES_URL;
    $repsUrl       = TEAM_SHEET_REPS_URL;

    if ($executivesUrl === '' || $repsUrl === '') {
        error_log('CURB team.php: Team sheet URLs not configured');
        sendJson(500, [
            'error'    => 'Team data not configured',
            'fallback' => true,
        ]);
    }

    $forceRefresh = getQueryParam('refresh') === '1' || getQueryParam('force') === '1';

    // Fetch both sheets, tolerate one failing
    $allExecutives = [];
    $allReps       = [];
    $execFailed    = false;
    $repFailed     = false;

    try {
        $allExecutives = fetchAllExecutives($executivesUrl, $forceRefresh);
    } catch (Throwable $e) {
        $execFailed = true;
        error_log('CURB team.php: Executives sheet fetch failed: ' . $e->getMessage());
    }

    try {
        $allReps = fetchAllDepartmentReps($repsUrl, $forceRefresh);
    } catch (Throwable $e) {
        $repFailed = true;
        error_log('CURB team.php: Department reps sheet fetch failed: ' . $e->getMessage());
    }

    // If both fail and nothing cached, return graceful empty success
    if (count($allExecutives) === 0 && count($allReps) === 0) {
        header('Cache-Control: no-store, no-cache, must-revalidate');
        sendJson(200, [
            'success'        => true,
            'session'        => '',
            'sessions'       => [],
            'executives'     => [],
            'departmentReps' => [],
            'cached'         => false,
            'degraded'       => true,
        ]);
    }

    // Discover all available sessions from both sheets
    $execSessions = extractSessions($allExecutives);
    $repSessions  = extractSessions($allReps);
    $allSessionsMap = [];
    foreach ($execSessions as $s) {
        $allSessionsMap[$s] = true;
    }
    foreach ($repSessions as $s) {
        $allSessionsMap[$s] = true;
    }
    $allSessions = array_keys($allSessionsMap);
    usort($allSessions, 'compareSessionsDesc');

    // Determine which session to return
    $requestedSession = normalizeSessionLabel(getQueryParam('session'));
    $activeSession    = '';

    if ($requestedSession !== '' && in_array($requestedSession, $allSessions, true)) {
        $activeSession = $requestedSession;
    } elseif (count($allSessions) > 0) {
        $activeSession = $allSessions[0];
    }

    // Filter data by active session
    $executives = $activeSession !== ''
        ? array_values(array_filter($allExecutives, function (array $e) use ($activeSession): bool {
            return $e['session'] === $activeSession;
        }))
        : $allExecutives;

    $departmentReps = $activeSession !== ''
        ? array_values(array_filter($allReps, function (array $r) use ($activeSession): bool {
            return $r['session'] === $activeSession;
        }))
        : $allReps;

    // Strip session field from per-member response
    $cleanExecutives = array_map(function (array $e): array {
        unset($e['session']);
        return $e;
    }, $executives);

    $cleanReps = array_map(function (array $r): array {
        unset($r['session']);
        return $r;
    }, $departmentReps);

    // Compute cache status
    $execCached = cacheGet('team:executives', TEAM_CACHE_TTL) !== null;
    $repsCached = cacheGet('team:reps', TEAM_CACHE_TTL) !== null;

    // Send response
    if ($forceRefresh) {
        header('Cache-Control: no-store, no-cache, must-revalidate');
    } else {
        header('Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400');
    }

    sendJson(200, [
        'success'        => true,
        'session'        => $activeSession,
        'sessions'       => $allSessions,
        'executives'     => $cleanExecutives,
        'departmentReps' => $cleanReps,
        'cached'         => $execCached && $repsCached,
        'degraded'       => $execFailed || $repFailed,
    ]);

} catch (Throwable $e) {
    error_log('CURB team.php error: ' . $e->getMessage());
    sendJson(500, [
        'error'    => 'Failed to fetch team data',
        'message'  => $e->getMessage(),
        'fallback' => true,
    ]);
}
