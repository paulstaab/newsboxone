/**
 * Service Worker for NewsBoxOne.
 * Provides offline shell caching and network status awareness.
 */

const CACHE_NAME = 'newsboxone-v1';
const scopePath = self.registration ? new URL(self.registration.scope).pathname : '/';
const normalizedScope = scopePath.endsWith('/') ? scopePath.slice(0, -1) : scopePath;
const basePath = normalizedScope === '/' ? '' : normalizedScope;
const SHELL_ASSETS = [
  `${basePath}/`,
  `${basePath}/index.html`,
  // Add other critical assets as needed
];

// Install event - cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }),
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      );
    }),
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - network-first with cache fallback for navigation
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // For navigation requests, use network-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache for offline
          return caches.match(request).then((cached) => {
            return cached || caches.match(`${basePath}/`);
          });
        }),
    );
    return;
  }

  // For static assets, use cache-first strategy
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Return cached but also update cache in background
          fetch(request)
            .then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, response);
                });
              }
            })
            .catch(() => {});
          return cached;
        }
        // Not cached, fetch and cache
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        });
      }),
    );
    return;
  }

  // For API requests, always use network (no caching)
  // SWR handles API caching in-memory
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'getVersion') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
