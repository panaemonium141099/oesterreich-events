/**
 * Lasst Treffen Service Worker
 *
 * Combines two concerns:
 *   1. Workbox runtime caching (fn-15.10) — stale-while-revalidate for
 *      `/_next/image/*`, cache-first for `/_next/static/*` and `/static/*`,
 *      offline-fallback for top-level navigations.
 *   2. Web-Push delivery (pre-existing) — push + notificationclick handlers
 *      for desktop notifications.
 *
 * Workbox is loaded via importScripts from the official Google CDN. The CSP
 * on the page does not apply to importScripts — SW has its own fetch
 * boundary. We pin the major version (7) to lock the API surface; minor
 * upgrades are picked up automatically from the CDN.
 *
 * Update strategy (Pillar 10 — Hybrid Banner, NOT skipWaiting):
 *   - install() does NOT call self.skipWaiting() unconditionally any more.
 *   - The SW listens for a `{type: 'SKIP_WAITING'}` postMessage from the
 *     page; when the user clicks the in-page "Update verfügbar" banner,
 *     the page sends that message and the new SW activates.
 *   - First-ever install (no previous controller) calls skipWaiting() so
 *     the first visit picks up the SW without a full reload — there is
 *     nothing to disrupt at that point.
 *
 * Cache versioning:
 *   - Workbox caches carry the SW_VERSION suffix so a deploy that changes
 *     the SW invalidates old caches deterministically. Bump SW_VERSION
 *     whenever cache shape changes (routes, expiration, strategy).
 */

// fn-15.10 — bump on every cache-shape change so old caches expire on update.
const SW_VERSION = 'v1';

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

// `workbox` is now a global, courtesy of workbox-sw.js.
// eslint-disable-next-line no-undef
const wb = workbox;

wb.core.setCacheNameDetails({
  prefix: 'lasstreffen',
  suffix: SW_VERSION,
  precache: 'precache',
  runtime: 'runtime',
});

// Skip waiting only on FIRST install (no previous controller).
// On subsequent updates we wait for an explicit user-driven SKIP_WAITING
// message from the in-page update banner.
self.addEventListener('install', (event) => {
  if (!self.registration.active) {
    // First-ever install on this client — go live immediately so the
    // very first page-load can be intercepted by the SW.
    event.waitUntil(self.skipWaiting());
  }
  // Precache the offline fallback (also see registerRoute below).
  event.waitUntil(
    caches.open(`lasstreffen-offline-${SW_VERSION}`).then((cache) =>
      cache.addAll(['/offline.html']).catch(() => {
        // Offline page may not exist yet on the very first deploy that
        // lands the SW — degrade gracefully. The fallback handler below
        // simply returns a synthetic Response if /offline.html is absent.
      }),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Take control of any already-open tabs immediately so the new
    // caching rules apply without a reload (push-handler behaviour
    // preserved from the pre-fn-15.10 SW).
    await self.clients.claim();

    // Garbage-collect older Workbox caches from previous SW_VERSIONs.
    const expectedPrefixes = [
      `lasstreffen-runtime-${SW_VERSION}`,
      `lasstreffen-precache-${SW_VERSION}`,
      `lasstreffen-offline-${SW_VERSION}`,
    ];
    const allKeys = await caches.keys();
    await Promise.all(
      allKeys.map((key) => {
        if (!key.startsWith('lasstreffen-')) return null;
        if (expectedPrefixes.some((p) => key === p || key.startsWith(`${p}-`))) {
          return null;
        }
        return caches.delete(key);
      }),
    );
  })());
});

// Hybrid-Banner update path: the page sends `{type: 'SKIP_WAITING'}`
// when the user clicks the "Update verfügbar" banner. The SW then
// activates and `controllerchange` on the page side triggers reload.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ----------------------------------------------------------------------
// Workbox routing — fn-15.10 acceptance.
// ----------------------------------------------------------------------

// /_next/image/* — stale-while-revalidate, 30-day TTL.
// This is the headline win: Vercel's image-optimisation pipeline serves
// AVIF/WebP from `/_next/image?url=…&w=…&q=…`. Repeat visitors hit the
// SW cache instead of going through Vercel's CDN again. The SWR pattern
// also fetches a fresh copy in the background so the next visit gets the
// up-to-date version without forcing today's user to wait.
wb.routing.registerRoute(
  ({ url, request }) =>
    request.destination === 'image' && url.pathname.startsWith('/_next/image'),
  new wb.strategies.StaleWhileRevalidate({
    cacheName: `lasstreffen-runtime-${SW_VERSION}-images`,
    plugins: [
      new wb.expiration.ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        purgeOnQuotaError: true,
      }),
      new wb.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200], // 0 = opaque cross-origin (we don't expect any here, but safe)
      }),
    ],
  }),
);

// /_next/static/* — cache-first, 60-day TTL.
// These are hashed by Next.js (filename includes content hash) so the URL
// itself is the cache key — cache-first is correct and aggressive.
wb.routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/_next/static/'),
  new wb.strategies.CacheFirst({
    cacheName: `lasstreffen-runtime-${SW_VERSION}-next-static`,
    plugins: [
      new wb.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
        purgeOnQuotaError: true,
      }),
      new wb.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

// /static/* — site-owned static assets (icons, geojsons not used at runtime,
// etc.) — cache-first, 30-day TTL.
wb.routing.registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/category-images/'),
  new wb.strategies.CacheFirst({
    cacheName: `lasstreffen-runtime-${SW_VERSION}-static`,
    plugins: [
      new wb.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        purgeOnQuotaError: true,
      }),
      new wb.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

// Top-level navigations — network-first with offline fallback. Lets users
// see SOMETHING when their network drops mid-session. NOT enabled for the
// landing route on first visit because the SW only intercepts requests
// that go via the SW (post-registration), so the very first paint is
// unaffected.
wb.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    try {
      const networkResponse = await fetch(event.request);
      return networkResponse;
    } catch {
      const cache = await caches.open(`lasstreffen-offline-${SW_VERSION}`);
      const cached = await cache.match('/offline.html');
      if (cached) return cached;
      // Synthetic fallback if /offline.html isn't in the cache yet.
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
          '<style>body{font-family:system-ui;background:#0a0a0c;color:#f1f5f9;' +
          'min-height:100vh;display:flex;align-items:center;justify-content:center;' +
          'margin:0;padding:1rem;text-align:center}h1{font-size:1.5rem;margin:0 0 .5rem}' +
          'p{opacity:.7}</style><h1>Du bist offline</h1>' +
          '<p>Probier es noch einmal, sobald du wieder Netz hast.</p>',
        { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 200 },
      );
    }
  },
);

// ----------------------------------------------------------------------
// Web-Push handlers (preserved verbatim from pre-fn-15.10 SW).
// ----------------------------------------------------------------------

// Next.js app/icon.tsx generates these routes at build time. No PNG file in /public needed.
const FALLBACK_ICON  = '/icon';
const FALLBACK_BADGE = '/icon';

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
