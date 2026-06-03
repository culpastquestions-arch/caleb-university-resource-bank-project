<?php
/**
 * Shared Utilities for CURB PHP API.
 * Centralizes CORS, validation, HTTP helpers, Google Drive helpers,
 * caching, and session normalization — direct port of api/_utils.js.
 *
 * @package CURB\API
 */

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . '_config.php';

// ──────────────────────────────────────────────────────────────────────
// CORS
// ──────────────────────────────────────────────────────────────────────

/**
 * Apply CORS headers based on the ALLOWED_ORIGIN constant.
 * If ALLOWED_ORIGIN is empty or the request origin doesn't match,
 * no Access-Control-Allow-Origin header is sent — browsers block
 * cross-origin requests (safe default).
 *
 * @return void
 */
function setupCors(): void
{
    $allowedOrigin  = ALLOWED_ORIGIN;
    $requestOrigin  = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($allowedOrigin !== '' && $requestOrigin === $allowedOrigin) {
        header("Access-Control-Allow-Origin: {$allowedOrigin}");
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

/**
 * Handle OPTIONS preflight and reject non-GET methods.
 * Returns true if the request was fully handled (caller should exit).
 *
 * @return bool
 */
function handlePreflightAndMethodGuard(): bool
{
    $method = $_SERVER['REQUEST_METHOD'] ?? '';

    if ($method === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    if ($method !== 'GET') {
        sendJson(405, ['error' => 'Method not allowed']);
        return true;
    }

    return false;
}

// ──────────────────────────────────────────────────────────────────────
// JSON Response Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Send a JSON response and terminate.
 *
 * @param int   $statusCode HTTP status code.
 * @param mixed $payload    Data to encode as JSON.
 * @return never
 */
function sendJson(int $statusCode, $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ──────────────────────────────────────────────────────────────────────
// Query Parameter Helper
// ──────────────────────────────────────────────────────────────────────

/**
 * Get a query parameter as a trimmed string.
 *
 * @param string $key     Parameter name.
 * @param string $default Default value if not set.
 * @return string
 */
function getQueryParam(string $key, string $default = ''): string
{
    $value = $_GET[$key] ?? null;
    if (!is_string($value)) {
        return $default;
    }
    return trim($value);
}

// ──────────────────────────────────────────────────────────────────────
// Folder / String Normalization
// ──────────────────────────────────────────────────────────────────────

/**
 * Normalize folder names to handle trailing spaces and inconsistent formatting.
 *
 * @param string $name The folder name to normalize.
 * @return string Normalized folder name.
 */
function normalizeFolderName(string $name): string
{
    if ($name === '') {
        return $name;
    }
    return preg_replace('/\s+/', ' ', trim($name));
}

/**
 * Normalize an academic session label to canonical "YYYY/YY" format.
 * Examples: "2025~26", "2025/2026", "2025/26 Session" → "2025/26".
 * Non-matching values are returned trimmed with normalized spacing.
 *
 * @param string $value Raw session label.
 * @return string Normalized session label.
 */
function normalizeSessionLabel(string $value): string
{
    $trimmed = preg_replace('/\s+/', ' ', trim($value));
    if ($trimmed === '') {
        return '';
    }

    if (!preg_match('/(\d{4})\s*[\/~\-]\s*(\d{2}|\d{4})(?:\s*session)?/i', $trimmed, $match)) {
        return $trimmed;
    }

    $startYear = (int) $match[1];
    $endRaw    = $match[2];

    $endTwoDigit = strlen($endRaw) === 4
        ? substr($endRaw, -2)
        : str_pad($endRaw, 2, '0', STR_PAD_LEFT);

    return "{$startYear}/{$endTwoDigit}";
}

// ──────────────────────────────────────────────────────────────────────
// Input Validation
// ──────────────────────────────────────────────────────────────────────

/**
 * Check if a string contains control characters or backslashes.
 *
 * @param string $value Value to check.
 * @return bool True if value contains invalid characters.
 */
function hasInvalidChars(string $value): bool
{
    return (bool) preg_match('/[\x00-\x1F\x7F\\\\]/', $value);
}

// ──────────────────────────────────────────────────────────────────────
// HTTP / cURL Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Make an HTTPS GET request to the Google Drive API using cURL.
 *
 * @param string $url The API URL.
 * @return array Decoded JSON response.
 * @throws RuntimeException On network error or invalid JSON.
 */
function makeApiRequest(string $url): array
{
    $ch = curl_init();

    try {
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $body = curl_exec($ch);

        if ($body === false) {
            throw new RuntimeException('cURL error: ' . curl_error($ch));
        }

        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($httpCode !== 200) {
            throw new RuntimeException("API request failed with status {$httpCode}: {$body}");
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Failed to parse API response as JSON');
        }

        return $decoded;
    } finally {
        curl_close($ch);
    }
}

/**
 * Fetch a URL with cURL, following redirects safely.
 * Used for CSV fetches from Google Sheets.
 *
 * @param string $url           URL to fetch.
 * @param int    $timeout       Timeout in seconds.
 * @param int    $maxRedirects  Maximum number of redirects to follow.
 * @return string Raw response body.
 * @throws RuntimeException On validation failure, timeout, or HTTP error.
 */
function fetchUrl(string $url, int $timeout = TEAM_FETCH_TIMEOUT, int $maxRedirects = TEAM_MAX_REDIRECTS): string
{
    // Validate trusted host
    validateTrustedCsvUrl($url);

    $ch = curl_init();

    try {
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => $maxRedirects,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $body = curl_exec($ch);

        if ($body === false) {
            throw new RuntimeException('CSV fetch error: ' . curl_error($ch));
        }

        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        // Verify final URL is also trusted (after redirects)
        $finalUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        if (is_string($finalUrl) && $finalUrl !== '') {
            validateTrustedCsvUrl($finalUrl);
        }

        if ($httpCode !== 200) {
            throw new RuntimeException("CSV fetch failed with status {$httpCode}");
        }

        return $body;
    } finally {
        curl_close($ch);
    }
}

/**
 * Validate that an outbound CSV URL is HTTPS and on an expected host.
 *
 * @param string $url Raw URL string.
 * @return void
 * @throws RuntimeException If URL is invalid, non-HTTPS, or untrusted host.
 */
function validateTrustedCsvUrl(string $url): void
{
    $parsed = parse_url($url);
    if ($parsed === false || !isset($parsed['scheme'], $parsed['host'])) {
        throw new RuntimeException('Invalid CSV URL');
    }

    if ($parsed['scheme'] !== 'https') {
        throw new RuntimeException('CSV URL must use HTTPS');
    }

    if (!isTrustedCsvHost($parsed['host'])) {
        throw new RuntimeException('CSV URL host is not allowed');
    }
}

/**
 * Check whether a CSV host is trusted.
 *
 * @param string $hostname URL hostname.
 * @return bool
 */
function isTrustedCsvHost(string $hostname): bool
{
    $host = strtolower($hostname);

    if (in_array($host, TRUSTED_CSV_HOSTS, true)) {
        return true;
    }

    // Also allow *.googleusercontent.com subdomains (used by redirects)
    return str_ends_with($host, '.googleusercontent.com');
}

// ──────────────────────────────────────────────────────────────────────
// Google Drive Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * List folders in a Google Drive directory.
 *
 * @param string $folderId Drive folder ID.
 * @param string $apiKey   Google API key.
 * @param string $fields   Drive API fields to return.
 * @return array Array of folder objects.
 * @throws RuntimeException On API error.
 */
function listFolders(string $folderId, string $apiKey, string $fields = 'files(id,name)'): array
{
    $query = urlencode("'{$folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false");
    $encodedFields = urlencode($fields);
    $url = "https://www.googleapis.com/drive/v3/files?q={$query}&fields={$encodedFields}&orderBy=name&key={$apiKey}";

    $response = makeApiRequest($url);
    return $response['files'] ?? [];
}

/**
 * List PDF files in a Google Drive folder.
 *
 * @param string $folderId Drive folder ID.
 * @param string $apiKey   Google API key.
 * @return array Array of file objects.
 * @throws RuntimeException On API error.
 */
function listFiles(string $folderId, string $apiKey): array
{
    $query = urlencode("'{$folderId}' in parents and mimeType='application/pdf' and trashed=false");
    $url = "https://www.googleapis.com/drive/v3/files?q={$query}&fields=files(id,name,modifiedTime,size,webViewLink,webContentLink)&orderBy=name&key={$apiKey}";

    $response = makeApiRequest($url);
    return $response['files'] ?? [];
}

/**
 * Find a folder by name within a parent folder.
 * Handles ~ as / substitution for folder names with slashes.
 *
 * @param string $parentId   Parent folder Drive ID.
 * @param string $folderName Name of folder to find (may contain ~ instead of /).
 * @param string $apiKey     Google API key.
 * @return array|null Folder object or null if not found.
 * @throws RuntimeException On API error.
 */
function findFolderByName(string $parentId, string $folderName, string $apiKey): ?array
{
    $folders = listFolders($parentId, $apiKey, 'files(id,name,modifiedTime)');

    // Normalize the target name — convert ~ back to / for matching
    $normalizedTarget = normalizeFolderName(str_replace('~', '/', $folderName));

    foreach ($folders as $folder) {
        if (normalizeFolderName($folder['name'] ?? '') === $normalizedTarget) {
            return $folder;
        }
    }

    return null;
}

// ──────────────────────────────────────────────────────────────────────
// File-Based Cache
// ──────────────────────────────────────────────────────────────────────

/**
 * Get cached data for a key. Returns null if expired or not found.
 *
 * @param string $key Cache key (will be hashed for filename safety).
 * @param int    $ttl TTL in seconds.
 * @return array|null Cached data or null.
 */
function cacheGet(string $key, int $ttl): ?array
{
    $file = CACHE_DIR . DIRECTORY_SEPARATOR . md5($key) . '.json';

    if (!is_file($file)) {
        return null;
    }

    $mtime = filemtime($file);
    if ($mtime === false || (time() - $mtime) >= $ttl) {
        // Expired
        @unlink($file);
        return null;
    }

    $contents = @file_get_contents($file);
    if ($contents === false) {
        return null;
    }

    $decoded = json_decode($contents, true);
    if (!is_array($decoded)) {
        @unlink($file);
        return null;
    }

    return $decoded;
}

/**
 * Set cache data for a key.
 *
 * @param string $key  Cache key.
 * @param array  $data Data to cache.
 * @return void
 */
function cacheSet(string $key, array $data): void
{
    $file = CACHE_DIR . DIRECTORY_SEPARATOR . md5($key) . '.json';
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($json !== false) {
        @file_put_contents($file, $json, LOCK_EX);
    }
}

// ──────────────────────────────────────────────────────────────────────
// CSV Parsing (port of team.js parser)
// ──────────────────────────────────────────────────────────────────────

/**
 * Parse a single CSV line, handling quoted values with escaped quotes.
 *
 * @param string $line A single CSV line.
 * @return list<string> Array of cell values.
 */
function parseCsvLine(string $line): array
{
    $values  = [];
    $current = '';
    $inQuotes = false;
    $len     = strlen($line);

    for ($i = 0; $i < $len; $i++) {
        $char = $line[$i];

        if ($char === '"') {
            if ($inQuotes && isset($line[$i + 1]) && $line[$i + 1] === '"') {
                // Escaped quote
                $current .= '"';
                $i++;
            } else {
                $inQuotes = !$inQuotes;
            }
        } elseif ($char === ',' && !$inQuotes) {
            $values[] = $current;
            $current  = '';
        } else {
            $current .= $char;
        }
    }

    $values[] = $current;
    return $values;
}

/**
 * Parse CSV text into an array of associative arrays.
 * First row is treated as headers (lowercased, trimmed).
 * Rows without a "name" column are skipped.
 *
 * @param string $csvText Raw CSV text.
 * @return list<array<string, string>>
 */
function parseCsv(string $csvText): array
{
    if ($csvText === '') {
        return [];
    }

    $lines = explode("\n", trim($csvText));
    if (count($lines) < 2) {
        return [];
    }

    $headers = array_map(function (string $h): string {
        return strtolower(trim($h));
    }, parseCsvLine($lines[0]));

    $data = [];

    for ($i = 1, $lineCount = count($lines); $i < $lineCount; $i++) {
        $values = parseCsvLine($lines[$i]);
        $row    = [];

        foreach ($headers as $index => $header) {
            $row[$header] = isset($values[$index]) ? trim($values[$index]) : '';
        }

        // Only include rows that have at least a name
        if (isset($row['name']) && $row['name'] !== '') {
            $data[] = $row;
        }
    }

    return $data;
}

/**
 * Get the first non-empty value from a row by trying multiple key variants.
 *
 * @param array         $row  Parsed CSV row.
 * @param list<string>  $keys Candidate key names in priority order.
 * @return string First non-empty value, otherwise empty string.
 */
function pickRowValue(array $row, array $keys): string
{
    foreach ($keys as $key) {
        if (isset($row[$key]) && is_string($row[$key]) && trim($row[$key]) !== '') {
            return $row[$key];
        }
    }
    return '';
}

// ──────────────────────────────────────────────────────────────────────
// Sanitization (XSS prevention — port of team.js)
// ──────────────────────────────────────────────────────────────────────

/**
 * HTML-encode special characters to prevent XSS.
 *
 * @param string $text Input text.
 * @return string Sanitized text.
 */
function sanitizeText(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// ──────────────────────────────────────────────────────────────────────
// Photo URL Formatting (port of team.js)
// ──────────────────────────────────────────────────────────────────────

/**
 * Extract a Google Drive file ID from a URL-like string.
 *
 * @param string $input URL or file ID.
 * @return string|null Drive file ID or null.
 */
function extractDriveFileId(string $input): ?string
{
    $trimmed = trim($input);
    if ($trimmed === '') {
        return null;
    }

    // Plain file ID
    if (preg_match('/^[a-zA-Z0-9_-]{10,}$/', $trimmed)) {
        return $trimmed;
    }

    // /d/<id> pattern
    if (preg_match('/\/d\/([a-zA-Z0-9_-]{10,})/', $trimmed, $m)) {
        return $m[1];
    }

    // ?id=<id> pattern
    if (preg_match('/[?&]id=([a-zA-Z0-9_-]{10,})/', $trimmed, $m)) {
        return $m[1];
    }

    return null;
}

/**
 * Convert a Google Drive share link into a direct image URL.
 * If the URL is not a recognized Drive link, return it as-is (if HTTPS).
 *
 * @param string $url The URL to format.
 * @return string Formatted URL or empty string.
 */
function formatPhotoUrl(string $url): string
{
    $str = trim($url);
    if ($str === '') {
        return '';
    }

    // If user already provided a Drive uc URL with a valid export mode, preserve it
    $parsed = parse_url($str);
    if (
        isset($parsed['host'], $parsed['path'])
        && $parsed['host'] === 'drive.google.com'
        && $parsed['path'] === '/uc'
    ) {
        parse_str($parsed['query'] ?? '', $queryParams);
        $exportMode = $queryParams['export'] ?? '';
        $id         = $queryParams['id'] ?? '';
        if ($id !== '' && in_array($exportMode, ['download', 'view'], true)) {
            return "https://drive.google.com/uc?export={$exportMode}&id={$id}";
        }
    }

    // Try to extract a Drive file ID
    $driveFileId = extractDriveFileId($str);
    if ($driveFileId !== null) {
        return "https://drive.google.com/thumbnail?id={$driveFileId}&sz=w1000";
    }

    // Accept only https URLs for direct image sources
    if (isset($parsed['scheme']) && $parsed['scheme'] === 'https') {
        return $str;
    }

    return '';
}
