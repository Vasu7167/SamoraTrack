// ── SamoraTrack Service Worker ──────────────────────────────────────
// BUMP THIS VERSION NUMBER every time you push an update.
// That's all you need to do. The rest is automatic.
const VERSION = 'v1.0.7';
const CACHE = `samoratrack-${VERSION}`;

// Files to cache for offline use
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── INSTALL: cache core files ────────────────────────────────────────
self.addEventListener('install', event => {
  // Skip waiting forces the new SW to activate immediately
  // instead of waiting for all tabs to close
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
});

// ── ACTIVATE: delete ALL old caches ─────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)   // keep only current version
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      // Take control of all open tabs immediately
      return self.clients.claim();
    }).then(() => {
      // Tell every open tab to reload so they get the fresh version
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: VERSION });
        });
      });
    })
  );
});

// ── FETCH: network-first for HTML, cache-first for assets ────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go network-first for the HTML document itself
  // This ensures the user always gets the latest app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh response
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Offline fallback: serve from cache
          return caches.match('/index.html');
        })
    );
    return;
  }

  // For Supabase API calls and external URLs: always network, never cache
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.protocol === 'chrome-extension:'
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // For everything else (fonts, icons, CSS from CDN):
  // cache-first with network fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
