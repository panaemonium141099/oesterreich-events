'use client';

/**
 * RouteTransitions — fn-15.5 round-5 (codex fix):
 *
 * Page-transition trigger for the CSS View Transition API. Replaces
 * the old framer-motion AnimatedLayout. Browsers without
 * `document.startViewTransition` (Firefox as of mid-2026) bail out
 * via feature-detect and route changes happen instantly — the
 * documented "instant cut" fallback.
 *
 * Correct interaction with the View Transition API: the navigation
 * MUST happen INSIDE the `startViewTransition()` callback (round-2
 * attempted an empty callback and let Next.js commit afterwards,
 * which only snapshots the old page twice — round-4 codex finding).
 *
 * Working flow:
 *   1. Capture-phase click handler intercepts a same-origin link
 *      click before Next.js handles it.
 *   2. `e.preventDefault()` stops the default + Next's handler.
 *   3. `startViewTransition(callback)` records the OLD snapshot, then
 *      runs `callback` which calls `router.push(href)`. The promise
 *      returned by startViewTransition resolves once the DOM is
 *      updated, at which point the NEW snapshot is captured and the
 *      `::view-transition-*` keyframes animate the cross-fade.
 *   4. router.push is synchronous (re-renders happen in microtasks).
 *      We resolve the callback right after the push call so the
 *      transition lifecycle doesn't stall.
 *
 * Reduced-motion is honored via the @media query in globals.css that
 * zeroes out the route-fade-in/out keyframes — startViewTransition
 * still runs but the animation duration becomes 0.
 *
 * Why not patch router.push directly?
 * App Router router events are unstable API. Intercepting link
 * clicks (+ popstate as a future addition) covers ~all user-
 * initiated navigations and leaves programmatic pushes alone (which
 * often want to be instant for redirects, auth bounces, etc.).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// `Document.startViewTransition` lives on TypeScript's lib.dom.d.ts in
// newer versions but isn't necessarily present in this project's
// tsconfig target. The interface signature varies across browser
// implementations (callback may return void | Promise<void>; some
// browsers expose a second-arg `types` parameter, others don't), so
// we treat it as an optional unknown function on Document at runtime
// rather than re-declaring the type globally (which conflicts with
// Next.js's own ambient typings: "All declarations of
// 'startViewTransition' must have identical modifiers").
type StartViewTransition = (callback: () => void | Promise<void>) => {
  finished: Promise<void>;
};

function getStartViewTransition(): StartViewTransition | null {
  if (typeof document === 'undefined') return null;
  const fn = (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  return typeof fn === 'function' ? (fn.bind(document) as StartViewTransition) : null;
}

export function RouteTransitions() {
  const router = useRouter();

  useEffect(() => {
    // Feature-detect once; bail on browsers without view-transition
    // support (Firefox as of mid-2026). Saves the click-handler
    // attach cost on those routes.
    const startViewTransition: StartViewTransition | null = getStartViewTransition();
    if (!startViewTransition) return;
    // Re-bind to a non-null local so TypeScript keeps the narrowing
    // inside the closures below.
    const start: StartViewTransition = startViewTransition;

    function getInternalHref(el: HTMLAnchorElement | null): string | null {
      if (!el) return null;
      const href = el.getAttribute('href');
      if (!href) return null;
      // Skip hash-only and non-http schemes (mailto, tel, etc.).
      if (href.startsWith('#') || href.includes(':')) return null;
      // Skip target=_blank / download / explicit opt-outs.
      if (el.target && el.target !== '_self') return null;
      if (el.hasAttribute('download')) return null;
      // External absolute URLs (different origin) — let the browser
      // handle them as hard nav. Note: relative paths starting with
      // `/` pass through here unchanged.
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return null;
        return url.pathname + url.search + url.hash;
      } catch {
        return null;
      }
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;
      const target = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null;
      const href = getInternalHref(target);
      if (!href) return;

      // Take over the navigation. preventDefault stops both the
      // browser default AND Next.js's own click handler.
      e.preventDefault();
      e.stopPropagation();

      // Mark the body so consumers (CSS overrides, observers) can
      // react during the transition. Cleared on `finished`.
      document.body.setAttribute('data-route-transitioning', 'true');

      try {
        const transition = start(() => {
          // CRITICAL: this is where the DOM update must happen for the
          // View Transition API to capture old/new snapshots correctly.
          // router.push triggers Next's commit synchronously; the
          // re-render happens in the next microtask, which is still
          // inside the transition's "update" phase.
          router.push(href);
        });
        transition.finished.finally(() => {
          document.body.removeAttribute('data-route-transitioning');
        });
      } catch {
        // startViewTransition can throw if another transition is mid-
        // flight. Fall back to a plain push so the user still navigates.
        document.body.removeAttribute('data-route-transitioning');
        router.push(href);
      }
    }

    // Capture phase so we run before Next.js's own click handler.
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.body.removeAttribute('data-route-transitioning');
    };
  }, [router]);

  return null;
}
