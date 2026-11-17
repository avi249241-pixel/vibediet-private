/**
 * VibeDiet Progressive Web App Service Worker
 * Network-First Strategy for static UI assets with strict /v1/* & /admin API air-gap
 */

const CACHE_NAME = 'vibediet-static-v3.1.0';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

// Install: Pre-cache core shell assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Purge obsolete cache generations and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Network-first for static UI with strict bypass for sensitive APIs
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // STRICT PRIVACY & AIR-GAP POLICY:
  // Never cache backend API calls, health telemetry, draft processor, or admin engine
  const isApiRoute = url.pathname.startsWith('/v1/');
  const isAdminRoute = url.pathname.startsWith('/admin') || url.searchParams.has('admin');
  const isHealthCheck = url.pathname === '/health' || url.pathname === '/ready';

  if (isApiRoute || isAdminRoute || isHealthCheck) {
    // Explicit bypass: pass through directly to live network
    return;
  }

  // Network-First strategy with Cache Fallback for static UI assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for same-origin static assets
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback to cached version if offline
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // SPA Navigation fallback to cached index.html
        if (event.request.mode === 'navigate') {
          const shellFallback =
            (await caches.match('/index.html')) ||
            (await caches.match('./index.html')) ||
            (await caches.match('/'));
          if (shellFallback) {
            return shellFallback;
          }
        }

        return new Response('VibeDiet offline — resource unavailable.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});
