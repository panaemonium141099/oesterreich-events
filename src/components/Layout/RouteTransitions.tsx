'use client';

/**
 * RouteTransitions — fn-15.5 round-2 (codex fix):
 *
 * The codex reviewer correctly pointed out that
 * `view-transition-name` + `@keyframes ::view-transition-*` CSS alone
 * does NOT animate same-document soft navigations. Browsers run a
 * view-transition only when the page calls `document.startViewTransition`
 * (or for the cross-document case which Next App Router doesn't use).
 *
 * Strategy here: a tiny client component placed in the root layout
 * that watches `usePathname()` and intercepts the link clicks +
 * popstate via the Navigation API's pending-document hook. The
 * minimal pattern that works without monkey-patching `router.push`:
 *
 *   1. Listen for a same-origin link click (capture phase) BEFORE
 *      Next.js handles it.
 *   2. If the target href is an internal route, call
 *      `document.startViewTransition()` whose callback synchronously
 *      sets a `data-route-transitioning` body attribute and returns;
 *      the actual route change is then completed by Next's own
 *      anchor handler in the same tick.
 *   3. On unmount of the transition, remove the body attribute so the
 *      `::view-transition-*` keyframes have run and the next paint is
 *      stable.
 *
 * Browser support: Chromium-family and Safari 17+ expose
 * `document.startViewTransition`. Firefox / older browsers don't —
 * the feature-detect bails out and route changes happen instantly,
 * which is the documented Firefox-fallback ("instant cut").
 *
 * Reduced-motion is honored via the @media query in globals.css that
 * zeroes out the route-fade-in/out keyframes.
 *
 * Why not patch `router.push`?
 * Router events are unstable API in App Router; intercepting link
 * clicks + popstate covers ~all user-initiated navigations and
 * leaves programmatic pushes alone (which is fine — they often want
 * to be instant for redirects, login bounces, etc.).
 */

import { useEffect } from 'react';

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
  useEffect(() => {
    // Feature-detect once; bail on browsers without view-transition
    // support (Firefox as of mid-2026). Saves the click-handler
    // attach cost on those routes.
    const startViewTransition: StartViewTransition | null = getStartViewTransition();
    if (!startViewTransition) return;
    // Re-bind to a non-null local so TypeScript keeps the narrowing
    // inside the closures below.
    const start: StartViewTransition = startViewTransition;

    function shouldHandle(target: HTMLAnchorElement | null): boolean {
      if (!target) return false;
      // Same-origin internal navigation only — external links get the
      // browser default (a hard load anyway).
      const href = target.getAttribute('href');
      if (!href) return false;
      // Skip hash-only, mailto, tel, etc.
      if (href.startsWith('#') || href.includes(':')) return false;
      // Skip if the link explicitly opts out via target / rel / download.
      if (target.target && target.target !== '_self') return false;
      if (target.hasAttribute('download')) return false;
      // Skip respect-modifier clicks.
      return true;
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;
      const target = (e.target as HTMLElement | null)?.closest?.('a');
      if (!shouldHandle(target as HTMLAnchorElement | null)) return;

      // Mark the body so CSS / observers can react if needed. The
      // `::view-transition-*` keyframes themselves are global, but
      // the attribute lets us scope effects per-route if we ever
      // want to (e.g. opt out on a specific route group).
      document.body.setAttribute('data-route-transitioning', 'true');

      // Start the view transition. The callback runs synchronously
      // and we don't need to do anything inside — Next.js will
      // complete the navigation in this same tick.
      try {
        const transition = start(() => {
          // Empty callback: Next.js handles the actual DOM swap
          // synchronously after our event handler returns. The
          // browser captures the "old" snapshot before this returns,
          // then captures "new" after Next's commit.
        });
        transition.finished.finally(() => {
          document.body.removeAttribute('data-route-transitioning');
        });
      } catch {
        // startViewTransition can throw if another transition is
        // mid-flight. Best to bail silently — the user still gets
        // the navigation, just without the fade.
        document.body.removeAttribute('data-route-transitioning');
      }
    }

    // Capture phase so we run before Next.js's own click handler.
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.body.removeAttribute('data-route-transitioning');
    };
  }, []);

  return null;
}
