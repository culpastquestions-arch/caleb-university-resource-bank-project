/**
 * Bootstrap Script for CURB
 * Runs before the main application scripts.
 * Handles: service worker registration and update pickup.
 *
 * NOTE: This file was extracted from inline <script> blocks in index.html
 * to allow removal of 'unsafe-inline' from the Content Security Policy.
 */

// ──────────────────────────────────────────────────────────────────────
// Service Worker Registration
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
