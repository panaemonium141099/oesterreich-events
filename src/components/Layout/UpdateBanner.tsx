'use client';

/**
 * UpdateBanner — fn-15.10 Hybrid Banner (Pillar 10).
 *
 * Listens for the `lt-sw-update-available` custom event fired by
 * <ServiceWorkerProvider /> when a new Service Worker is installed but
 * waiting. Shows a small, dismissable toast at the bottom of the
 * viewport with two actions:
 *   - "Neu laden" → posts `SKIP_WAITING` to the waiting worker and
 *     relies on `controllerchange` (in ServiceWorkerProvider) to
 *     reload the page once the new SW takes over.
 *   - "Später" → dismisses the banner for the rest of the session
 *     (re-appears on next page-load if the worker is still waiting).
 *
 * Why a Custom Component instead of sonner toast:
 *   - The toast lives outside the route-transition root and must stay
 *     mounted across navigations (sonner toasts get torn down on hard
 *     nav and we don't want the banner to flicker).
 *   - The banner needs custom layout (two buttons side-by-side, fixed
 *     bottom-right, mobile-safe with safe-area padding). sonner can
 *     do this but it's simpler to write directly.
 *   - The banner must be SSR-safe (no use of `window`/`navigator` on
 *     first render) — easy to get right in this small file, harder to
 *     audit through a third-party library.
 *
 * Accessibility:
 *   - role="status" + aria-live="polite" so screen readers announce
 *     the offer without interrupting the user.
 *   - Buttons have explicit labels (no icon-only).
 *   - Keyboard-reachable via tab order (no z-index trap).
 */

import { useEffect, useRef, useState } from 'react';

interface UpdateAvailableEvent extends CustomEvent {
  detail: { worker: ServiceWorker };
}

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const workerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onUpdateAvailable = (e: Event) => {
      const ev = e as UpdateAvailableEvent;
      if (!ev.detail?.worker) return;
      workerRef.current = ev.detail.worker;
      setVisible(true);
    };

    window.addEventListener('lt-sw-update-available', onUpdateAvailable);
    return () => {
      window.removeEventListener('lt-sw-update-available', onUpdateAvailable);
    };
  }, []);

  if (!visible) return null;

  const onReload = () => {
    const worker = workerRef.current;
    if (!worker) {
      window.location.reload();
      return;
    }

    // Multi-tab edge case (codex round 5): tab A clicked "Update" first;
    // SW already activated and called clients.claim(). When tab B later
    // clicks the still-visible banner, the worker held in workerRef is
    // no longer in 'waiting' state (it's already the controller), so
    // posting SKIP_WAITING is a no-op and no controllerchange fires.
    // Without an immediate reload here, tab B's banner click would do
    // nothing.
    //
    // Logic:
    //   - If the worker is still 'waiting' or 'installing' → normal path
    //     (signal upgrade intent, postMessage, wait for controllerchange).
    //   - Otherwise (already active or redundant) → reload right now.
    const alreadyActivated =
      worker.state === 'activated' ||
      worker.state === 'redundant' ||
      (navigator.serviceWorker.controller != null &&
        navigator.serviceWorker.controller === worker);

    if (alreadyActivated) {
      // No future controllerchange will fire — reload directly so the
      // tab actually picks up the new bytes the user asked for.
      window.location.reload();
      return;
    }

    // Normal hybrid-banner path: signal intent, then skipWaiting.
    window.dispatchEvent(new CustomEvent('lt-sw-skip-waiting'));
    worker.postMessage({ type: 'SKIP_WAITING' });

    // Belt-and-suspenders: if controllerchange doesn't fire within 2s
    // (e.g. SW state transition issues, browser quirks), reload anyway.
    // The flag set above means ServiceWorkerProvider's handler will also
    // try to reload, but its `reloading` guard handles the race.
    window.setTimeout(() => {
      if (!document.hidden) window.location.reload();
    }, 2000);

    // Optimistically dismiss the banner — if controllerchange takes a
    // few hundred ms, the user shouldn't see the button bounce around.
    setVisible(false);
  };

  const onDismiss = () => {
    setVisible(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      // Bottom-right, above the Toaster (which is bottom-center). Inline
      // styles to keep the component completely independent of any CSS
      // build chunk — the banner has to work even if globals.css is
      // mid-update on the page that fired the event.
      style={{
        position: 'fixed',
        zIndex: 60,
        right: 'max(1rem, env(safe-area-inset-right))',
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        maxWidth: 'calc(100vw - 2rem)',
        background: '#141416',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '0.75rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        color: '#f1f5f9',
        padding: '0.75rem 0.875rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.875rem',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
        Update verfügbar — neu laden für die neuste Version.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          appearance: 'none',
          background: 'transparent',
          color: '#94a3b8',
          border: '1px solid transparent',
          padding: '0.375rem 0.5rem',
          borderRadius: '0.5rem',
          font: 'inherit',
          cursor: 'pointer',
          flex: '0 0 auto',
        }}
      >
        Später
      </button>
      <button
        type="button"
        onClick={onReload}
        style={{
          appearance: 'none',
          background: '#f1f5f9',
          color: '#0a0a0c',
          border: '1px solid transparent',
          padding: '0.375rem 0.75rem',
          borderRadius: '0.5rem',
          font: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
          flex: '0 0 auto',
        }}
      >
        Neu laden
      </button>
    </div>
  );
}
