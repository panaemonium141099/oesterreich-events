/**
 * Lasst Treffen · Service Worker
 *
 * Handles Web-Push events for desktop users. Payload shape:
 *   { title, body?, url?, icon?, badge?, tag?, data? }
 *
 * We don't precache or claim clients yet — this SW is purely for
 * push delivery + focused-tab deduplication.
 */

// Next.js app/icon.tsx generates these routes at build time. No PNG file in /public needed.
const FALLBACK_ICON  = '/icon';
const FALLBACK_BADGE = '/icon';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try { payload = { title: event.data ? event.data.text() : 'Lasst Treffen' }; }
    catch { payload = { title: 'Lasst Treffen' }; }
  }

  const title = payload.title || 'Lasst Treffen';
  const body  = payload.body  || '';

  const options = {
    body,
    icon:  payload.icon  || FALLBACK_ICON,
    badge: payload.badge || FALLBACK_BADGE,
    tag:   payload.tag   || 'lasstreffen-default',
    renotify: true,
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
    // Desktop OSs show notification until the user dismisses it.
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // If a tab is already open on lasstreffen, focus it and navigate.
    for (const client of allClients) {
      try {
        const clientUrl = new URL(client.url);
        const sameOrigin = clientUrl.origin === self.location.origin;
        if (sameOrigin) {
          await client.focus();
          if ('navigate' in client && clientUrl.pathname + clientUrl.search !== targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      } catch {
        /* ignore invalid URLs */
      }
    }
    // No tab open — open a new one.
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
