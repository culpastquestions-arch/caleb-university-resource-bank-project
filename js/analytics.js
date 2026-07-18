/**
 * @fileoverview Google Analytics 4 (GA4) integration for CURB.
 * Initializes the gtag data layer and provides helpers for tracking
 * login and download events.
 *
 * IMPORTANT: This file MUST be loaded BEFORE email-gate.js and app.js
 * so that the gtag() function is available when those modules fire events.
 *
 * @module js/analytics
 */

// ──────────────────────────────────────────────────────────────────────
// 1. GA4 Data Layer Initialization
// ──────────────────────────────────────────────────────────────────────

window.dataLayer = window.dataLayer || [];

/**
 * Push arguments to the GA4 data layer.
 * This is the standard gtag() function required by Google Analytics.
 * @param {...*} args - Arguments forwarded to the data layer.
 */
function gtag() {
  window.dataLayer.push(arguments);
}

gtag('js', new Date());
gtag('config', 'G-M0Q67L6761');

// ──────────────────────────────────────────────────────────────────────
// 2. Event Tracking Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Track a successful student login (email verification).
 * Logs the email domain only (e.g. "calebuniversity.edu.ng") — never the
 * full email address — to respect student privacy.
 *
 * @param {string} email - The verified student email address.
 */
function trackLogin(email) {
  try {
    if (typeof gtag !== 'function') return;

    const domain = (email && typeof email === 'string')
      ? email.trim().split('@')[1] || 'unknown'
      : 'unknown';

    gtag('event', 'login', {
      method: 'email_verification',
      email_domain: domain
    });
  } catch (e) {
    // Analytics must never break the app
    console.warn('Analytics login tracking failed:', e);
  }
}

/**
 * Track a file download click.
 * Captures the file name and the current navigation path for context.
 *
 * @param {string} fileName - Display name of the downloaded file.
 * @param {string} downloadUrl - The Google Drive download URL.
 */
function trackDownload(fileName, downloadUrl) {
  try {
    if (typeof gtag !== 'function') return;

    gtag('event', 'file_download', {
      file_name: fileName || 'Unknown File',
      link_url: downloadUrl || ''
    });
  } catch (e) {
    // Analytics must never break the app
    console.warn('Analytics download tracking failed:', e);
  }
}

// ──────────────────────────────────────────────────────────────────────
// 3. Download Click Listener (Event Delegation)
// ──────────────────────────────────────────────────────────────────────

/**
 * Listen for clicks on download buttons across the entire page.
 * Uses event delegation so it works for dynamically rendered file cards.
 */
document.addEventListener('click', (e) => {
  try {
    const downloadLink = e.target.closest('a.btn-primary');
    if (!downloadLink) return;

    const linkText = (downloadLink.textContent || '').trim();
    if (linkText !== 'Download') return;

    const fileCard = downloadLink.closest('.file-card');
    const fileNameEl = fileCard ? fileCard.querySelector('.file-name') : null;
    const fileName = fileNameEl ? fileNameEl.textContent.trim() : 'Unknown File';
    const downloadUrl = downloadLink.getAttribute('href') || '';

    trackDownload(fileName, downloadUrl);
  } catch (e) {
    // Never interfere with the actual download
  }
});
