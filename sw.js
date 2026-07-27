// ── SamoraTrack Service Worker ──────────────────────────────────────
// BUMP THIS VERSION NUMBER every time you push an update.
const VERSION = 'v1.0.11';
const CACHE = `samoratrack-${VERSION}`;

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

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
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'SamoraTrack', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'SamoraTrack';
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
