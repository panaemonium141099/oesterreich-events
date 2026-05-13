'use client';

/**
 * ServiceWorkerProvider — fn-15.10.
 *
 * Mounts in the root layout and is responsible for:
 *   1. Registering `/sw.js` (the merged Workbox + Web-Push worker).
 *   2. Observing the registration's `updatefound` lifecycle and exposing
 *      a `waitingWorker` ref so the in-page <UpdateBanner /> can offer
 *      the "Update verfügbar — neu laden" UX (Pillar 10 hybrid banner).
 *   3. Reloading once the new SW takes control (controllerchange) so the
 *      user actually sees the new bytes after they click the banner.
 *
 * Behavioural notes:
 *   - Dev: Next.js dev server serves `/sw.js` from /public verbatim, but
 *     a hard reload between code edits is needed because the SW caches
 *     `_next/static`. To avoid this rabbit hole, registration is skipped
 *     unless `process.env.NODE_ENV === 'production'`. fn-15.10 acceptance
 *     measures "registered on production".
 *   - First-visit registration is fire-and-forget — we don't await it on
 *     the render path; the page must not block on SW install.
 *   - We coexist with the pre-existing Web-Push subscription flow
 *     (src/lib/hooks/usePushNotifications.ts) by registering the SAME
 *     `/sw.js` with the SAME `{scope: '/'}`. Browsers de-dupe on
 *     scriptURL+scope so this is idempotent — first-call wins.
 *
 * Implementation notes:
 *   - This is a Client Component so the React lifecycle gives us a stable
 *     mount point on every route. Mounting in root-layout means the SW
 *     installs once per session, not once per route change.
 *   - We use a module-level "module loaded once per tab" guard to prevent
 *     duplicate event listeners if React StrictMode double-mounts in dev.
 */

import { useEffect } from 'react';
import { UpdateBanner } from './UpdateBanner';

// Module-level guard — a tab loads this component module at most once
// per page load, even under React 19 StrictMode double-mount.
let registered = false;

export function ServiceWorkerProvider() {
  useEffect(() => {
    // Dev opt-out — see the file-level comment.
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (registered) return;
    registered = true;

    let reloading = false;

    // When the active SW changes (after the user clicked "Update" in the
    // banner and the SW called `skipWaiting()`), reload the page so the
    // user immediately sees the new bytes. The `reloading` guard prevents
    // refresh loops if controllerchange fires more than once.
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Fire-and-forget registration. We don't `await` it on a Promise the
    // page is blocked on — SW install must not slow the first paint.
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // If a waiting worker is already present at registration time
        // (e.g. the user opened a fresh tab while a previous tab still
        // had the old SW active), surface it to the banner right away.
        if (registration.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(
            new CustomEvent('lt-sw-update-available', {
              detail: { worker: registration.waiting },
            }),
          );
        }

        // Standard update-found lifecycle:
        //   1. A new SW is discovered and starts installing.
        //   2. We watch its `statechange` for `installed`.
        //   3. If `navigator.serviceWorker.controller` exists at that
        //      point, this is an UPDATE (not a first install), so we
        //      tell the banner there's something for the user to do.
        //      Otherwise it's the first-ever install on this client —
        //      the SW auto-skipWaiting()s itself (see public/sw.js) and
        //      we don't show a banner.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              window.dispatchEvent(
                new CustomEvent('lt-sw-update-available', {
                  detail: { worker: newWorker },
                }),
              );
            }
          });
        });
      })
      .catch((err) => {
        // SW registration failures are non-fatal — the page works
        // without a SW. Log so it's diagnosable in DevTools.
        // eslint-disable-next-line no-console
        console.warn('[sw] registration failed', err);
      });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return <UpdateBanner />;
}
