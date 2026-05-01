// Service Worker for CURB
// Versioned cache name; bump only when cache schema/behavior changes.
const SW_VERSION = '1.5.2';
const CACHE_PREFIX = 'curb-';
const APP_SHELL_CACHE = `${CACHE_PREFIX}app-shell-v${SW_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}api-v${SW_VERSION}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/styles.css',
  '/js/bootstrap.js',
  '/js/config.js',
  '/js/cache.js',
  '/js/drive-api.js',
  '/js/navigation.js',
  '/js/pwa.js',
  '/js/ui/notification-helper.js',
  '/js/ui/contact-modal-helper.js',
  '/js/renderers/team-renderer.js',
  '/js/renderers/coverage-renderer.js',
  '/js/renderer.js',
  '/js/app.js',
  '/assets/caleb-university-logo-transparent.png',
  '/manifest.json',
  '/offline.html'
];

/**
 * Try network first, fallback to cache/offline.
 * @param {Request} request - Fetch request.
 * @param {string} cacheName - Cache bucket name.
 * @param {string} [fallbackUrl] - Optional cache fallback URL.
 * @returns {Promise<Response>} Response.
 */
async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const shellCache = await caches.open(APP_SHELL_CACHE);
      const fallback = await shellCache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw error;
  }
}

/**
 * Return cached response immediately and revalidate in background.
 * @param {Request} request - Fetch request.
 * @param {string} cacheName - Cache bucket name.
 * @returns {Promise<Response>} Response.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cached) {
    // Keep cache warm without blocking current response.
    networkPromise.catch(() => null);
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;

  const shellCache = await caches.open(APP_SHELL_CACHE);
  const fallback = await shellCache.match('/offline.html');
  if (fallback) return fallback;
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Cache installation failed:', error);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const expectedCaches = new Set([APP_SHELL_CACHE, RUNTIME_CACHE, API_CACHE]);

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith(CACHE_PREFIX) && !expectedCaches.has(cacheName)) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip any non-http(s) or cross-origin requests (let the browser handle them).
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== self.location.origin) {
    return;
  }

  // API calls - Network First (fresh data preferred, offline fallback preserved)
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // App code/assets - Stale While Revalidate (fast first paint + quick update pickup)
  if (url.pathname.includes('/css/') ||
    url.pathname.includes('/js/') ||
    url.pathname.includes('/assets/')) {
    event.respondWith(staleWhileRevalidate(event.request, RUNTIME_CACHE));
    return;
  }

  // HTML shell - Network First so navigation picks latest deploys quickly
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirst(event.request, RUNTIME_CACHE, '/offline.html'));
    return;
  }

  // Default strategy for other requests
  event.respondWith(networkFirst(event.request, RUNTIME_CACHE));
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

