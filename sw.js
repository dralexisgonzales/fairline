// Fairline service worker: precache the app shell, serve offline, update in the background.
const VERSION = 'fairline-v1.0.0';
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App shell navigation: always serve the cached index so the app opens offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((hit) => hit || fetch(req))
    );
    return;
  }

  // Everything else: cache first, fall back to network, and cache what we fetch.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
