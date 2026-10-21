// ── SamoraOS Service Worker ──────────────────────────────────────
// BUMP THIS VERSION NUMBER every time you push an update.
const VERSION = 'v1.0.19';   // 1.0.19 (Drop P): research first, write like a person. 1.0.18 (Drop O2): SAM Power and SAM Full Power. 1.0.17 (Drop O): one replies inbox, email and LinkedIn. 1.0.16 (Drop M): replies SAM answers. 1.0.15 (Drop L): new release number on the app files. 1.0.14 (Drop K): the app is five versioned files; each is kept until the next release.
// 1.0.13 note:   // 1.0.13: new icons. Same filenames as the old ones, so without a bump the cache keeps serving the placeholder S.
const CACHE = `samoratrack-${VERSION}`;

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.svg',
];
// The app's JavaScript is not precached: index.html asks for /js/app-1.js?v=<release>
// and the handler below keeps each versioned file the first time it is fetched.

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      return self.clients.claim();
    }).then(() => {
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: VERSION });
        });
      });
    })
  );
});

// ── Web Push ─────────────────────────────────────────────────────────
// Show a notification when the server pushes one (even if the app is closed).
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'SamoraOS', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'SamoraOS';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: data.tag || undefined,          // same tag replaces an existing notification
    renotify: !!data.tag,
    data: { url: data.url || '/' },
    requireInteraction: !!data.requireInteraction
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab (or open one) and navigate to the notification's URL.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client && target !== '/') { client.navigate(target).catch(() => {}); }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

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

  // ── App JS: network-first, cache as fallback ────────────────────────────
  // The generic handler below is cache-first with no revalidation, which was
  // safe while all the JS lived inline in index.html: navigations are
  // network-first, so a deploy shipped fresh code immediately whether or not
  // VERSION was bumped.
  //
  // Now that the app is /js/app.js, cache-first would pin a returning user to
  // whatever JS they downloaded first — new HTML running against old code —
  // until someone remembered to bump VERSION. That failure is silent and
  // would look like "the feature I just shipped doesn't exist for some
  // users". Network-first removes the dependency on remembering; the cache
  // still answers when the network doesn't, so offline is unaffected.
  // Drop K: a versioned file (?v=<release>) never changes, so it is served
  // from the cache with no network round trip. A new release has a new ?v=,
  // which is a different request, so it is fetched fresh.
  if (url.origin === self.location.origin && url.pathname.startsWith('/js/') && url.searchParams.has('v')) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      }))
    );
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/js/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

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
