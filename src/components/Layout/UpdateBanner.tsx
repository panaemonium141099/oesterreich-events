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

  const onReload = async () => {
    const worker = workerRef.current;
    if (!worker) {
      window.location.reload();
      return;
    }

    // Codex round-14: dropped scriptURL-equality fast-reload (both old
    // controller and new waiting worker share /sw.js so === always true).
    // Only redundant-worker is now a static fast-reload condition.
    const workerIsRedundant = worker.state === 'redundant';

    if (workerIsRedundant) {
      // The waiting worker reference died (replaced by yet another
      // waiting worker, or evicted). A plain reload is the only way
      // forward — SW lifecycle will re-evaluate from scratch.
      window.location.reload();
      return;
    }

    // Codex round-15: multi-tab edge case — another tab may have
    // already activated the new worker before this tab's user clicked.
    // In that case `registration.waiting` is null, a controller IS
    // active, and posting SKIP_WAITING to the (already-activated)
    // worker is a no-op (no future controllerchange will fire).
    // Re-query the live registration since workerRef can be stale.
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.waiting == null && navigator.serviceWorker.controller != null) {
        // No worker is waiting → the upgrade already happened
        // elsewhere; this tab is being served by the new controller
        // (or about to be). Reload directly to actually pick up the
        // new bytes — without this, the click would be a no-op.
        window.location.reload();
        return;
      }
    } catch {
      // getRegistration() failure is non-fatal — fall through to the
      // normal postMessage path.
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
