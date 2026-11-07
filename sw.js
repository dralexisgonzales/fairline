// Fairline service worker: keep a copy of the app for instant, offline opens, and refresh it quietly.
//
// Rules this worker lives by:
//  1. A new version always takes over: it installs even if some file fails to precache, skips waiting,
//     and claims every open page as soon as it activates. Old caches are dropped only after that.
//  2. A page load is never blocked by the cache: any cache error falls through to the network.
//  3. If anything in here throws, the browser just loads the page from the network as if there were no worker.
//  4. The page is cached under its folder ('/' or '/fairline/') and never 'index.html': hosts redirect 'index.html' to the folder, and a redirected
//     response handed to a navigation is refused by the browser (that was the 'can't open the page' bug).
const VERSION = 'fairline-v2.3.0';
const PREFIX = 'fairline-';
// Where the app lives: '/' on a root host, '/fairline/' on github.io. Every path below is relative to it.
const BASE = new URL('./', self.location.href).pathname;
// The old host (pages.dev) is blocked on some networks: a worker there sends every page to the new address and removes itself.
const MOVED = /\.pages\.dev$/.test(self.location.hostname) ? 'https://dralexisgonzales.github.io/fairline/' : null;
const SHELL = [
  '',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/ui.js',
  'js/keypad.js',
  'js/math.js',
  'js/format.js',
  'js/store.js',
  'js/settings.js',
  'js/calcs/convert.js',
  'js/calcs/fairline.js',
  'js/calcs/parlay.js',
  'js/calcs/hedge.js',
  'js/calcs/payout.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
].map((p) => BASE + p);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    if (MOVED) { try { await self.skipWaiting(); } catch {} return; }
    // Precache what we can; a file that fails to cache is simply fetched from the network later.
    try {
      const cache = await caches.open(VERSION);
      await Promise.all(SHELL.map(async (path) => {
        try {
          const res = unredirect(await fetch(new Request(path, { cache: 'reload' })));
          if (res && res.ok) await cache.put(path, res);
        } catch {}
      }));
    } catch {}
    try { await self.skipWaiting(); } catch {}
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try { await self.clients.claim(); } catch {}
    if (MOVED) {
      try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k).catch(() => false))); } catch {}
      try { const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); for (const w of wins) { try { const u = new URL(w.url); await w.navigate(MOVED + u.search + u.hash); } catch {} } } catch {}
      try { await self.registration.unregister(); } catch {}
      return;
    }
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k).catch(() => false)));
    } catch {}
  })());
});

// The page asks "are you alive?" on every load; an old worker that cannot answer gets replaced.
self.addEventListener('message', (event) => {
  try {
    if (event.data && event.data.type === 'ping') event.source?.postMessage({ type: 'pong', version: VERSION });
  } catch {}
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname === BASE + 'sw.js') return;   // the browser fetches the worker itself; never serve it from the cache
  if (MOVED) { if (req.mode === 'navigate') event.respondWith(Response.redirect(MOVED + url.search + url.hash, 302)); return; }
  // Last resort on any failure inside respond(): a plain network fetch, exactly as if there were no worker.
  event.respondWith(respond(event, req, url).catch(() => fetch(req)));
});

// A response that came through a redirect may not be handed to a navigation request, so it is copied into a plain one.
function unredirect(res) {
  try {
    if (res && res.redirected) return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
  } catch {}
  return res;
}

async function respond(event, req, url) {
  const isNav = req.mode === 'navigate';
  const key = isNav ? BASE : url.pathname;
  let cache = null;
  try { cache = await caches.open(VERSION); } catch { cache = null; }
  let hit = null;
  try { hit = cache ? await cache.match(key) : null; } catch { hit = null; }

  // Fresh copy for next time. Never throws, never blocks the response below.
  const refresh = (async () => {
    try {
      const res = unredirect(await fetch(isNav ? new Request(BASE, { cache: 'no-cache' }) : req));
      if (res && res.ok && cache) { try { await cache.put(key, res.clone()); } catch {} }
      return res;
    } catch { return null; }
  })();
  try { event.waitUntil(refresh); } catch {}

  if (hit) return hit;
  const fresh = await refresh;
  if (fresh) return fresh;
  // Offline and not in this version's cache: any older cached copy beats an error page.
  try { const any = await caches.match(key); if (any) return any; } catch {}
  throw new Error('no response');   // the caller falls back to a plain network fetch
}
