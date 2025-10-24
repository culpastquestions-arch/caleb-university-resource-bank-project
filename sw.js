// Service Worker for CURB
const CACHE_NAME = 'curb-v1.1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/styles.css',
  '/js/config.js',
  '/js/cache.js',
  '/js/drive-api.js',
  '/js/navigation.js',
  '/js/app.js',
  '/assets/caleb-university-logo-transparent.png',
  '/manifest.json',
  '/offline.html'
];

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
  
  // API calls - Network First
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful API responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(error => {
          // Fallback to cache for API calls
          return caches.match(event.request)
            .then(response => response || new Response('{"error": "Offline"}', {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }));
        })
    );
    return;
  }

  // Static assets - Cache First
  if (url.pathname.includes('/css/') || 
      url.pathname.includes('/js/') || 
      url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request)
            .then(fetchResponse => {
              if (fetchResponse.status === 200) {
                const responseToCache = fetchResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, responseToCache));
              }
              return fetchResponse;
            });
        })
    );
    return;
  }

  // HTML - Stale While Revalidate
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          const fetchPromise = fetch(event.request)
            .then(fetchResponse => {
              if (fetchResponse.status === 200) {
                const responseToCache = fetchResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, responseToCache));
              }
              return fetchResponse;
            })
            .catch(error => {
              console.error('Fetch failed:', error);
              // Return offline page for HTML requests
              return caches.match('/offline.html');
            });

          // Return cached version immediately, update in background
          return response || fetchPromise;
        })
    );
    return;
  }

  // Default strategy for other requests
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(fetchResponse => {
            if (fetchResponse.status === 200) {
              const responseToCache = fetchResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache));
            }
            return fetchResponse;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            throw error;
          });
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

