// Network first: fresh schedules online, the last successful page offline.
const CACHE_PREFIX = `primetimenhl:${self.registration.scope}:`;
const CACHE = `${CACHE_PREFIX}__ASSET_VERSION__`;
const ASSETS = ['./', './styles.css?v=__ASSET_VERSION__', './filters.js?v=__ASSET_VERSION__', './theme.js?v=__ASSET_VERSION__', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const navigation = event.request.mode === 'navigate';
  // Filter query strings share a single cached page.
  const key = navigation ? new URL('./', self.registration.scope).href : event.request;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response.ok && response.type === 'basic') await cache.put(key, response.clone());
      return response;
    } catch (error) {
      const saved = await cache.match(key);
      if (saved) return saved;
      throw error;
    }
  })());
});
