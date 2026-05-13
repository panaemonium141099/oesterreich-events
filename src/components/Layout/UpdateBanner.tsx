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

    // Multi-tab edge case (codex round 5-9): tab A clicked "Update" first;
    // SW activated + called clients.claim(). Tab B later sees its still-
    // visible banner from the earlier updateavailable event and clicks
    // "Neu laden".
    //
    // We need to reload immediately ONLY when this tab is provably under
    // the new controller already (no future controllerchange will fire).
    // worker.state === 'activated' alone is NOT sufficient: clients.claim()
    // has a small async window where the worker is activated but THIS tab
    // is still under the old controller. Reloading there would re-serve
    // the old controller AND skip the upgrade-intent signal, leaving the
    // tab on stale bytes when the later controllerchange suppresses
    // itself.
    //
    // The narrow safe condition: this tab is provably already controlled
    // by a worker matching the same scriptURL as our updateavailable
    // target. That can only be true after clients.claim() has finished
    // propagating to this tab — there really is nothing left to wait for.
    //
    // Codex round-13: use scriptURL equality instead of object reference
    // equality. Browsers may expose different ServiceWorker wrapper
    // objects for the same underlying worker across API surfaces
    // (registration.waiting vs navigator.serviceWorker.controller), so
    // === would falsely report "still waiting" in passive tabs and
    // never reload.
    //
    // worker.state === 'redundant' is a separate "give up" branch — the
    // banner's worker reference is dead, so the only way out is a plain
    // reload so the SW lifecycle can re-evaluate from scratch.
    const controller = navigator.serviceWorker.controller;
    const newWorkerIsAlreadyController =
      controller != null &&
      controller.scriptURL === worker.scriptURL &&
      controller.state === 'activated';
    const workerIsRedundant = worker.state === 'redundant';

    if (newWorkerIsAlreadyController || workerIsRedundant) {
      window.location.reload();
      return;
    }

    // Normal hybrid-banner path: signal intent, then skipWaiting.
    // ServiceWorkerProvider's controllerchange handler reloads ONCE the
    // new worker has actually taken control. We deliberately do NOT add
    // a setTimeout fallback (codex round-8 ruled it out): a blind reload
    // before the new worker controls the page would re-serve the old
    // controller, reset userTriggeredUpgrade=false on the fresh load,
    // and then suppress the LEGITIMATE later controllerchange — leaving
    // the user on stale assets exactly when they asked to update.
    window.dispatchEvent(new CustomEvent('lt-sw-skip-waiting'));
    worker.postMessage({ type: 'SKIP_WAITING' });

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
