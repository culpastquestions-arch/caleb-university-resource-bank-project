<?php
/**
 * Centralized Configuration for CURB PHP API.
 * Loads environment variables and defines shared constants.
 *
 * @package CURB\API
 */

declare(strict_types=1);

// ──────────────────────────────────────────────────────────────────────
// Environment Variable Loading
// ──────────────────────────────────────────────────────────────────────

/**
 * Load environment variables from a .env file if it exists.
 * Skips lines that are comments or empty.
 * Does NOT override variables already set in the environment.
 *
 * @param string $path Absolute path to the .env file.
 * @return void
 */
function loadEnvFile(string $path): void
{
    if (!is_file($path) || !is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);

        // Skip comments and empty lines
        if ($trimmed === '' || $trimmed[0] === '#') {
            continue;
        }

        // Parse KEY=VALUE (with optional quotes around value)
        $eqPos = strpos($trimmed, '=');
        if ($eqPos === false) {
            continue;
        }

        $key   = trim(substr($trimmed, 0, $eqPos));
        $value = trim(substr($trimmed, $eqPos + 1));

        // Strip surrounding quotes
        if (
            strlen($value) >= 2
            && (($value[0] === '"' && $value[strlen($value) - 1] === '"')
                || ($value[0] === "'" && $value[strlen($value) - 1] === "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        // Only set if not already defined in the actual environment
        if (getenv($key) === false) {
            putenv("{$key}={$value}");
        }
    }
}

// Attempt to load .env from project root (one level up from api/)
loadEnvFile(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

// ──────────────────────────────────────────────────────────────────────
// Resolved Environment Values
// ──────────────────────────────────────────────────────────────────────

/** @var string Google Drive API key. */
define('GOOGLE_DRIVE_API_KEY', (string) getenv('GOOGLE_DRIVE_API_KEY'));

/** @var string Root Google Drive folder ID containing all departments. */
define('GOOGLE_DRIVE_ROOT_FOLDER_ID', (string) getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID'));

/** @var string Published Google Sheets CSV URL for executives. */
define('TEAM_SHEET_EXECUTIVES_URL', (string) getenv('TEAM_SHEET_EXECUTIVES_URL'));

/** @var string Published Google Sheets CSV URL for department reps. */
define('TEAM_SHEET_REPS_URL', (string) getenv('TEAM_SHEET_REPS_URL'));

/** @var string Allowed CORS origin (exact match). */
define('ALLOWED_ORIGIN', (string) getenv('ALLOWED_ORIGIN'));

// ──────────────────────────────────────────────────────────────────────
// Constants — Browse
// ──────────────────────────────────────────────────────────────────────

/** @var int Browse cache TTL in seconds (30 minutes). */
define('BROWSE_CACHE_TTL', 30 * 60);

/** @var int Maximum path string length. */
define('BROWSE_MAX_PATH_LENGTH', 512);

/** @var int Maximum number of path segments. */
define('BROWSE_MAX_SEGMENTS', 8);

/** @var int Maximum length of a single path segment. */
define('BROWSE_MAX_SEGMENT_LENGTH', 120);

// ──────────────────────────────────────────────────────────────────────
// Constants — Coverage
// ──────────────────────────────────────────────────────────────────────

/** @var int Coverage cache TTL in seconds (5 minutes). */
define('COVERAGE_CACHE_TTL', 5 * 60);

/** @var int Maximum parameter value length. */
define('COVERAGE_MAX_PARAM_LENGTH', 120);

/** @var int Maximum concurrent coverage scans (file-lock based). */
define('COVERAGE_MAX_CONCURRENT_SCANS', 5);

/** @var int Maximum BFS depth for deep file check. */
define('COVERAGE_MAX_DEPTH', 3);

/** @var int Maximum folders scanned in BFS. */
define('COVERAGE_MAX_FOLDERS_SCANNED', 50);

// ──────────────────────────────────────────────────────────────────────
// Constants — Team
// ──────────────────────────────────────────────────────────────────────

/** @var int Team cache TTL in seconds (24 hours). */
define('TEAM_CACHE_TTL', 24 * 60 * 60);

/** @var int HTTP fetch timeout in seconds. */
define('TEAM_FETCH_TIMEOUT', 10);

/** @var int Maximum redirects when fetching CSV. */
define('TEAM_MAX_REDIRECTS', 3);

// ──────────────────────────────────────────────────────────────────────
// Constants — Shared
// ──────────────────────────────────────────────────────────────────────

/**
 * Level exceptions for departments with non-standard level structures.
 * Keys must EXACTLY match Google Drive folder names.
 *
 * @var array<string, list<string>>
 */
define('LEVEL_EXCEPTIONS', [
    'Jupeb' => ['Art', 'Business', 'Science'],
]);

/**
 * Trusted hostnames for outbound CSV fetches.
 *
 * @var list<string>
 */
define('TRUSTED_CSV_HOSTS', [
    'docs.google.com',
    'docs.googleusercontent.com',
    'drive.google.com',
]);

// ──────────────────────────────────────────────────────────────────────
// File Cache Directory
// ──────────────────────────────────────────────────────────────────────

/** @var string Absolute path to the file-based cache directory. */
define('CACHE_DIR', __DIR__ . DIRECTORY_SEPARATOR . '_cache');

// Create cache directory if it doesn't exist
if (!is_dir(CACHE_DIR)) {
    @mkdir(CACHE_DIR, 0755, true);
}
