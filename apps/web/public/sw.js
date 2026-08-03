// Liabl check-in PWA — service worker (P1a: installable shell + offline open).
// Scope is /participant (registered that way), so this only ever controls the
// check-in flow, never the operator console or marketing site.
//
// Strategy:
//   * navigations  -> network-first, fall back to the last cached page, then a
//                     branded offline page. (So the app OPENS offline.)
//   * static assets-> cache-first with background revalidate (fast, offline).
//   * API / Supabase / everything else -> straight to network, never cached
//     (auth + writes must never be served stale).
//
// P1b will add the IndexedDB outbox + background sync for signing offline.

const VERSION = 'liabl-pwa-v1';
const SHELL_CACHE = VERSION + '-shell';
const ASSET_CACHE = VERSION + '-assets';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll([OFFLINE_URL, '/icon-192.png']);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isCacheableAsset(url) {
  return url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icon') ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase/Stripe/etc.

  // Navigations: network-first with cache + offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(req)) || (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  // Static assets: cache-first, revalidate in the background.
  if (isCacheableAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(req);
      if (cached) {
        fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // Everything else (API routes, auth, writes): network, uncached.
});
