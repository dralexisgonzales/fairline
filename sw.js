// Fairline service worker: precache the app shell, serve it offline, refresh it in the background.
// Strategy: cache first for instant opens, then revalidate so the next open has the latest files.
const VERSION = 'fairline-v1.2.0';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/app.css',
  '/js/app.js',
  '/js/ui.js',
  '/js/math.js',
  '/js/format.js',
  '/js/store.js',
  '/js/settings.js',
  '/js/calcs/convert.js',
  '/js/calcs/fairline.js',
  '/js/calcs/parlay.js',
  '/js/calcs/hedge.js',
  '/js/calcs/payout.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function revalidate(req, cacheKey) {
  return fetch(req).then(async (res) => {
    if (res && res.ok) {
      const cache = await caches.open(VERSION);
      await cache.put(cacheKey, res.clone());
    }
    return res;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App shell navigation: serve the cached page at once, refresh it quietly for next time.
  if (req.mode === 'navigate') {
    const fresh = revalidate(new Request('/index.html', { cache: 'no-cache' }), '/index.html').catch(() => null);
    event.waitUntil(fresh);
    event.respondWith(
      caches.match('/index.html').then((hit) => hit || fresh.then((r) => r || Response.error()))
    );
    return;
  }

  // Everything else: cached copy first, network refresh in the background.
  const fresh = revalidate(req, req).catch(() => null);
  event.waitUntil(fresh);
  event.respondWith(
    caches.match(req).then((hit) => hit || fresh.then((r) => r || Response.error()))
  );
});
