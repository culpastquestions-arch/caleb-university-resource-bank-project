/**
 * Bootstrap Script for CURB
 * Runs before the main application scripts.
 * Handles: environment config, Font Awesome fallback, service worker registration.
 *
 * NOTE: This file was extracted from inline <script> blocks in index.html
 * to allow removal of 'unsafe-inline' from the Content Security Policy.
 */

// ──────────────────────────────────────────────────────────────────────
// 1. Environment Configuration
// ──────────────────────────────────────────────────────────────────────

// API credentials are secured on the server.
// The backend proxy handles all Google Drive API calls.
window.ENV = {
  API_ENDPOINT: '/api/browse'
};

// ──────────────────────────────────────────────────────────────────────
// 2. Font Awesome Fallback Detection
// ──────────────────────────────────────────────────────────────────────

/**
 * Check if Font Awesome loaded after a short delay.
 * If not, try the jsDelivr fallback CDN.
 */
(function checkFontAwesome() {
  setTimeout(function () {
    try {
      const testIcon = document.createElement('i');
      testIcon.className = 'fas fa-check';
      testIcon.style.cssText = 'position:absolute;left:-9999px;';
      document.body.appendChild(testIcon);
      const fontFamily = window.getComputedStyle(testIcon).fontFamily;
      document.body.removeChild(testIcon);

      if (!fontFamily.includes('Font Awesome')) {
        const fallback = document.createElement('link');
        fallback.rel = 'stylesheet';
        fallback.href = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css';
        fallback.integrity = 'sha384-t1nt8BQoYMLFN5p42tRAtuAAFQaCQODekUVeKKZrEnEyp4H2R0RHFz0KWpmj7i8g';
        fallback.crossOrigin = 'anonymous';
        document.head.appendChild(fallback);
      }
    } catch (e) {
      // Swallow — icon cosmetics should never crash the app
    }
  }, 1000);
})();

// ──────────────────────────────────────────────────────────────────────
// 3. Service Worker Registration
// ──────────────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let isRefreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isRefreshing) return;
      isRefreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        const showUpdateToast = () => {
          try {
            if (window.notificationHelper && typeof window.notificationHelper.showToast === 'function') {
              window.notificationHelper.showToast('Updating CURB to the latest version...', 'info');
            }
          } catch (e) {
            // Ignore toast failures
          }
        };

        const triggerUpdate = (worker) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast();
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        };

        const checkForUpdate = () => {
          try {
            registration.update();
            triggerUpdate(registration.waiting);
          } catch (e) {
            // Ignore update failures
          }
        };

        checkForUpdate();

        registration.addEventListener('updatefound', () => {
          triggerUpdate(registration.installing);
        });

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            checkForUpdate();
          }
        });
      })
      .catch(error => {
        console.error('Service worker registration failed:', error);
      });
  });
}
