// ================================================================
//  NYC Transit Planner — Service Worker  (sw.js)
//  Strategy: cache-first for the app shell, network-only for APIs.
// ================================================================

const CACHE_NAME = 'nyc-transit-v1';

// Files that make up the "app shell" — cached on install for offline use.
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon.svg',
  'https://cdn.jsdelivr.net/npm/protobufjs@7/dist/protobuf.min.js',
];

// ─── Install: pre-cache the app shell ───────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  // Activate immediately without waiting for old tabs to close.
  self.skipWaiting();
});

// ─── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: routing strategy ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to the network for API calls — we must not cache live data.
  if (
    url.hostname === 'maps.googleapis.com'       ||
    url.hostname === 'api-endpoint.mta.info'
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For everything else (app shell): try the cache first, fall back to network.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Only cache successful, same-origin responses.
        if (
          response.ok &&
          (url.origin === self.location.origin ||
           url.hostname === 'cdn.jsdelivr.net')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
