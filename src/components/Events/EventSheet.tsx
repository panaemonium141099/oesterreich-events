'use client';

/**
 * EventSheet — full-screen overlay that wraps EventDetailV2 when rendered
 * via the @modal intercepting route (`app/@modal/(.)events/[...slug]/page.tsx`).
 *
 * The user explicitly wanted "full screen like before", just without
 * unmounting the underlying map. So this is intentionally NOT a side-
 * drawer or bottom-sheet — it's a 100vw × 100vh overlay that completely
 * covers the map. The map keeps all its state (camera, 13k markers,
 * loaded tiles) ready for the moment the user presses Back / Escape /
 * the close button.
 *
 * Three exit gestures:
 *   - Browser-back button (the normal way: pops the intercepted URL)
 *   - Escape key
 *   - Floating close button top-right
 *
 * router.back() pops the intercepted URL → modal slot resolves to
 * default.tsx (null) → AnimatePresence runs the exit animation → the
 * map underneath becomes visible again instantly.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface EventSheetProps {
  children: React.ReactNode;
}

/**
 * fn-15.5: motion-lib AnimatePresence replaced with a CSS-driven
 * mount/unmount. The overlay enters with `animate-fade-in-up` and
 * receives a `data-sheet-state="closed"` swap right before
 * `router.back()` so it runs the matching slide-out keyframe before
 * Next.js dismisses the parallel route.
 *
 * Background: framer's <AnimatePresence> here kept the modal alive for
 * its exit transition; without it Next.js would dismiss instantly. To
 * keep that polish, we manually orchestrate a 220ms exit + back() pair
 * — same duration as the previous transition prop.
 */
const EXIT_DURATION_MS = 220;

export function EventSheet({ children }: EventSheetProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  // fn-15.5 round-6 (codex): track the exit-timer id so we can clear it
  // on unmount. Without this, a fast user who closes the sheet and then
  // navigates again before 220ms elapses gets a stray router.back() /
  // router.push() after the new page has mounted — popping them one
  // history entry too far back or redirecting away from the page they
  // just chose. mountedRef gives the timer callback a way to bail
  // even if the timer fires during the React unmount window.
  const exitTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  // Tracks whether the exit-animation should be playing. Set to true on
  // close() so the data-state attribute switches and the CSS keyframe
  // runs the slide-out before back().
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (exitTimerRef.current != null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, []);

  const scheduleExit = (fn: () => void) => {
    // Replace any previous pending timer so we never have two in
    // flight. The exit animation duration is fixed; if the user
    // triggers a second close (rare), the latest target wins.
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      if (!mountedRef.current) return;
      fn();
    }, EXIT_DURATION_MS);
  };

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setExiting(true);
    // Wait one paint for the CSS slide-out, then pop the URL. router.back()
    // is the only reliable way to dismiss an intercepting route; push('/map')
    // sometimes leaves the modal slot stuck on the intercepted URL.
    scheduleExit(() => {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/map');
      }
    });
  };

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Body scroll-lock while overlay is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // Intercept clicks on internal links inside the sheet. Without this
  // interception, a soft nav to a route that has no page in the
  // parallel `@modal` slot (alles außer `(.)events/...`) updates the
  // URL but leaves the modal slot stuck on the intercepted page —
  // `@modal/default.tsx` greift nur bei Hard-Navigation
  // (parallel-route quirk: github.com/vercel/next.js/issues/53037).
  //
  // fn-15.5 round-4 (codex) handled only /map ("Karte" chrome links);
  // seit V4RelatedEvents im Sheet rendert, gibt es hier auch Hub-Links
  // (/gemeinde/…, /{bundesland}, /entdecken) — gleiche Behandlung für
  // alle internen Nicht-Event-Links. The reliable pattern: run the
  // exit keyframe first, then `router.push(href)`. The push triggers
  // a fresh URL resolution which clears the intercepted slot.
  //
  // Ausnahmen, die normal durchbubblen:
  //   - '/events/…' — hat eine (.)-Route im Slot und re-intercepted
  //     sauber in dieses Sheet (Event → ähnliches Event).
  //   - '#…'-Hash-Links (share/similar-Anker) und externe URLs.
  //   - target="_blank" (Quelle, Tickets) und Modifier-Klicks.
  //
  // Using push (not back) drops one nice property — when the user
  // came from /map, the carousel state on the map page isn't
  // preserved through a fresh push. That's the documented trade-off:
  // correct destination beats preserved scroll for a non-trivial
  // minority of users.
  useEffect(() => {
    const node = overlayRef.current;
    if (!node) return;
    const onClick = (e: MouseEvent) => {
      // Respect modifier-clicks → let browser open in new tab/window
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      const link = (e.target as HTMLElement | null)?.closest?.('a');
      if (!link || link.target === '_blank') return;
      const href = link.getAttribute('href') ?? '';
      if (!href.startsWith('/') || href.startsWith('/events/')) return;
      e.preventDefault();
      e.stopPropagation();
      // Always run the exit keyframe then push to the requested href.
      closingRef.current = true;
      setExiting(true);
      scheduleExit(() => router.push(href));
    };
    node.addEventListener('click', onClick, true); // capture phase
    return () => node.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Event → ähnliches Event bleibt im Sheet (Soft-Nav innerhalb des
  // Slots): die Overlay-Div persistiert dabei samt Scroll-Position —
  // ohne Reset öffnet das neue Event am unteren Ende (dort, wo die
  // Related-Karte geklickt wurde) statt oben beim Hero.
  const pathname = usePathname();
  useEffect(() => {
    overlayRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div
      ref={overlayRef}
      key="event-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Event Details"
      // z-[1100] sits above the mobile bottom-sheet sidebar (z-[1000]
      // in src/app/map/page.tsx). Without this the sidebar list would
      // stay rendered ON TOP of the event detail on mobile because
      // map page's parallel `children` slot keeps mounting it. The
      // user reported "anzeige der verschiedenen events bleibt im
      // vordergrund" exactly because of this z-index inversion.
      className="fixed inset-0 z-[1100] overflow-y-auto overscroll-contain"
      style={{ background: '#0a0a0c' }}
      data-sheet-state={exiting ? 'closed' : 'open'}
      // fn-15.5 round-9 (codex): tell RouteTransitions to ignore link
      // clicks inside this overlay. Our own capture-phase handler
      // below special-cases /map navigation (modal-safe dismissal),
      // and we don't want the global view-transition handler to win
      // the race against it.
      data-route-transition-skip="true"
    >
      {/* No floating close button — it would collide with the
          EventDetailActions panel (save/share/AfterSavePanel) that
          already lives top-right on the hero. The user has three
          unambiguous ways to dismiss the overlay:
            1. Breadcrumb back-arrow / "Karte" link top-left
            2. Escape key
            3. Browser back button (incl. mobile gesture)
          All three end up in close() → router.back(). */}
      {children}
    </div>
  );
}
