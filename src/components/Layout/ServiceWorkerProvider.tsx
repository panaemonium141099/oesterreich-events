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

// Module-level guards — codex round-3 (fn-15.10) split this into two
// flags so a failed registration doesn't lock out retries for the entire
// tab session. `registrationInFlight` short-circuits concurrent attempts
// (StrictMode double-mount), `registrationSucceeded` permanently latches
// only after a successful register().
let registrationInFlight = false;
let registrationSucceeded = false;

// True only when the user explicitly accepted an update via the banner.
// `controllerchange` fires twice on first install (skipWaiting + clients.
// claim in public/sw.js) — without this flag the SW would unsolicitedly
// reload a first-time visitor.
let userTriggeredUpgrade = false;

export function ServiceWorkerProvider() {
  useEffect(() => {
    // Dev opt-out — see the file-level comment.
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (registrationSucceeded || registrationInFlight) return;
    // Codex round-15 FIX: do NOT set registrationInFlight here. The
    // attemptRegistration() helper below owns that transition. Setting
    // it early caused attemptRegistration to self-block on its own
    // entry guard, leaving SW unregistered for the whole production
    // session. Bug introduced when the helper was extracted in round-14.

    // Reload-on-controllerchange policy (codex round 3 + 4 final):
    //   - First install (no previous controller anywhere) → SW does
    //     skipWaiting + clients.claim, fires controllerchange. DON'T reload.
    //   - Multi-tab update: tab A clicks "Update", SW calls skipWaiting +
    //     clients.claim. Other already-open tabs (B, C, …) get a
    //     controllerchange they did NOT initiate. DON'T reload them
    //     either — they might be mid-form-input and we'd discard the
    //     user's work. They pick up new bytes on next user navigation.
    //   - THIS tab clicked "Neu laden": userTriggeredUpgrade is true,
    //     reload happens.
    //
    // Net: reload requires explicit per-tab user intent. Anything else
    // is silently ignored — codex round-4 ruled out `hadControllerAt
    // Registration` because it punishes passive tabs in multi-tab sessions.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      if (!userTriggeredUpgrade) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Listen for the banner-triggered upgrade event so we know any
    // subsequent controllerchange is the user's intent, not first install.
    const onUserUpgrade = () => { userTriggeredUpgrade = true; };
    window.addEventListener('lt-sw-skip-waiting', onUserUpgrade);

    /**
     * Codex round-14 (Minor): extract setupRegistration so both the
     * initial register call AND the online-retry path run the same
     * post-success setup (waiting-worker dispatch + updatefound listener).
     * Previously the online-retry only called register() and skipped the
     * lifecycle wiring, so a transient first-load failure → online retry
     * would install the SW but never surface update banners again.
     */
    const setupRegistration = (registration: ServiceWorkerRegistration) => {
      registrationSucceeded = true;
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
    };

    const attemptRegistration = () => {
      if (registrationSucceeded || registrationInFlight) return;
      registrationInFlight = true;
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(setupRegistration)
        .catch((err) => {
          // SW registration failures are non-fatal — the page works
          // without a SW. Log so it's diagnosable in DevTools.
          // eslint-disable-next-line no-console
          console.warn('[sw] registration failed', err);
        })
        .finally(() => {
          registrationInFlight = false;
        });
    };

    // Initial fire-and-forget registration. We don't `await` it on a
    // Promise the page is blocked on — SW install must not slow first paint.
    attemptRegistration();

    // Codex round-13 (Minor): root-layout in App Router stays mounted
    // for the entire SPA session — without a retry path, a transient
    // first-load failure (offline blip, 5xx on /sw.js, flaky connection)
    // would lock out runtime caching for the whole session. Listen for
    // the next `online` event and retry, going through the SAME
    // setupRegistration() path so updatefound/waiting handlers wire up
    // (codex round-14 fix).
    const onOnline = () => attemptRegistration();
    window.addEventListener('online', onOnline);

    // Codex round-16 (Minor): long-lived SPA tabs don't trigger top-level
    // navigations, so the browser never re-fetches /sw.js to discover
    // updates. Call registration.update() on visibilitychange (tab
    // re-focus after a deploy) — that polls the server for a new SW
    // version. The browser de-dupes if /sw.js hasn't changed, so this
    // is cheap.
    let lastUpdateCheck = Date.now();
    const onVisibilityChange = async () => {
      if (document.hidden) return;
      // Throttle to 1× per 5 minutes so rapid tab-switching doesn't hammer.
      const now = Date.now();
      if (now - lastUpdateCheck < 5 * 60 * 1000) return;
      lastUpdateCheck = now;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch {
        /* update poll failure is non-fatal */
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('lt-sw-skip-waiting', onUserUpgrade);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return <UpdateBanner />;
}
