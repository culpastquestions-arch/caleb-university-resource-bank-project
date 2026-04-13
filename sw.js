// Service Worker for CURB
// Versioned cache name; bump only when cache schema/behavior changes.
const CACHE_NAME = 'curb-v1.5';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/styles.css',
  '/js/config.js',
  '/js/cache.js',
  '/js/drive-api.js',
  '/js/navigation.js',
  '/js/pwa.js',
  '/js/renderer.js',
  '/js/app.js',
  '/assets/caleb-university-logo-transparent.png',
  '/manifest.json',
  '/offline.html'
];

/**
 * Try network first, fallback to cache/offline.
 * @param {Request} request - Fetch request.
 * @param {string} [fallbackUrl] - Optional cache fallback URL.
 * @returns {Promise<Response>} Response.
 */
async function networkFirst(request, fallbackUrl) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw error;
  }
}

/**
 * Return cached response immediately and revalidate in background.
 * @param {Request} request - Fetch request.
 * @returns {Promise<Response>} Response.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
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

  const fallback = await caches.match('/offline.html');
  if (fallback) return fallback;
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
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
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
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

  // Skip Google APIs and external CDNs
  if (event.request.url.includes('googleapis.com') ||
    event.request.url.includes('fontawesome.com') ||
    event.request.url.includes('cdnjs.cloudflare.com')) {
    return;
  }

  const url = new URL(event.request.url);

  // API calls - Network First (fresh data preferred, offline fallback preserved)
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // App code/assets - Stale While Revalidate (fast first paint + quick update pickup)
  if (url.pathname.includes('/css/') ||
    url.pathname.includes('/js/') ||
    url.pathname.includes('/assets/')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // HTML shell - Network First so navigation picks latest deploys quickly
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirst(event.request, '/offline.html'));
    return;
  }

  // Default strategy for other requests
  event.respondWith(networkFirst(event.request));
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

