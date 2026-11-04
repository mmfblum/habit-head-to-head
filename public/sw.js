// Keep static branding available offline, but NEVER cache the app shell,
// routes, scripts, or styles. Cache-first HTML stranded beta testers on old
// bundles (including stale authentication configuration) across releases.
const CACHE_NAME = 'zrizin-static-v2';
const BRANDING_PATHS = ['/manifest.json', '/icon-192.svg', '/icon-512.svg'];
const BRANDING_SET = new Set(BRANDING_PATHS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(BRANDING_PATHS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const hadStaleAppCache = keys.some((key) => key.startsWith('zrizin-') && key !== CACHE_NAME);
      await Promise.all(
        keys
          .filter((key) => key.startsWith('zrizin-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();

      // Existing installations still have the OLD worker controlling the
      // current navigation. Refresh those tabs once after clearing its cache,
      // so the new network-served app loads without asking users to clear data.
      if (hadStaleAppCache) {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(
          clients.map((client) => client.navigate(client.url).catch(() => undefined))
        );
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations (/auth, /, deep links) and all JS/CSS must always use
  // the network and the browser's normal HTTP cache semantics.
  if (!BRANDING_SET.has(url.pathname)) return;

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      return cached || Response.error();
    })
  );
});
