#!/usr/bin/env node

/**
 * Build Version Stamper
 *
 * Stamps the current git commit hash into sw.js, config.js, and manifest.json.
 * This ensures every deploy has a unique version identifier, which triggers
 * service worker updates and cache invalidation automatically — no manual
 * version bumping required.
 *
 * Run via:  npm run build
 *
 * Hosting-agnostic: works on Vercel, Netlify, Cloudflare Pages, bare VPS,
 * GitHub Actions, or any platform that runs `npm run build`.
 *
 * @module scripts/stamp-version
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Get a unique build identifier from git, with timestamp fallback.
 * @returns {string} Build identifier string.
 */
function getBuildId() {
  try {
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      cwd: ROOT_DIR
    }).trim();

    if (hash && /^[a-f0-9]+$/i.test(hash)) {
      return hash;
    }
  } catch (e) {
    // git not available (e.g. Docker image without git) — use timestamp fallback
  }

  return Date.now().toString(36);
}

/**
 * Replace a pattern in a file and write back.
 * @param {string} filePath - Absolute path to the file.
 * @param {RegExp} pattern - Pattern to find.
 * @param {string} replacement - Replacement string.
 * @param {string} label - Human-readable label for logging.
 * @throws {Error} If the pattern is not found in the file.
 */
function stampFile(filePath, pattern, replacement, label) {
  const content = fs.readFileSync(filePath, 'utf8');

  if (!pattern.test(content)) {
    throw new Error(`Pattern not found in ${path.basename(filePath)}: ${pattern}`);
  }

  const stamped = content.replace(pattern, replacement);
  fs.writeFileSync(filePath, stamped, 'utf8');
  console.log(`  ✓ ${label}`);
}

// ──────────────────────────────────────────────────────────────────────

const buildId = getBuildId();

if (!process.env.CI && !process.env.VERCEL) {
  console.log(`\nSkipping version stamp: not in a CI environment (VERCEL or CI not set).\n`);
  process.exit(0);
}

console.log(`\nStamping build version: ${buildId}\n`);

try {
  // 1. sw.js — SW_VERSION drives cache names and SW update detection
  stampFile(
    path.join(ROOT_DIR, 'sw.js'),
    /const SW_VERSION = '[^']*'/,
    `const SW_VERSION = '${buildId}'`,
    `sw.js         → SW_VERSION = '${buildId}'`
  );

  // 2. js/config.js — CONFIG.version drives localStorage cache invalidation
  stampFile(
    path.join(ROOT_DIR, 'js', 'config.js'),
    /version: "[^"]*"/,
    `version: "${buildId}"`,
    `config.js     → version: "${buildId}"`
  );

  // 3. manifest.json — informational, keeps PWA metadata in sync
  stampFile(
    path.join(ROOT_DIR, 'manifest.json'),
    /"version": "[^"]*"/,
    `"version": "${buildId}"`,
    `manifest.json → version: "${buildId}"`
  );

  console.log('\nBuild version stamped successfully.\n');
} catch (error) {
  console.error(`\nVersion stamping failed: ${error.message}\n`);
  process.exit(1);
}
