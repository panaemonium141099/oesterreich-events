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
import { useRouter } from 'next/navigation';

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
  // Tracks whether the exit-animation should be playing. Set to true on
  // close() so the data-state attribute switches and the CSS keyframe
  // runs the slide-out before back().
  const [exiting, setExiting] = useState(false);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setExiting(true);
    // Wait one paint for the CSS slide-out, then pop the URL. router.back()
    // is the only reliable way to dismiss an intercepting route; push('/map')
    // sometimes leaves the modal slot stuck on the intercepted URL.
    window.setTimeout(() => {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/map');
      }
    }, EXIT_DURATION_MS);
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

  // Intercept clicks on internal "back to map" links. EventDetailV2's
  // hero has a `<Link href="/map">` breadcrumb arrow + "Karte" label,
  // and the bundesland chip is `<Link href="/map?bundesland=...">`.
  // When clicked inside the intercepted-route overlay, those Links do a
  // soft nav that updates the URL but leaves the modal slot stuck on the
  // intercepted page (parallel-route quirk in Next.js — see
  // github.com/vercel/next.js/issues/53037 and friends).
  //
  // fn-15.5 round-3 (codex): the previous "always router.back()" treated
  // the bundesland chip (/map?bundesland=...) the same as the bare
  // breadcrumb (/map). That's wrong — the chip is a deep-link, not a
  // dismissal. Fix: discriminate by exact href. Bare `/map` is the
  // breadcrumb → close (back()). Anything with a query/hash is a real
  // deep link → close FIRST so the modal exit animation plays, then
  // push to that URL.
  useEffect(() => {
    const node = overlayRef.current;
    if (!node) return;
    const onClick = (e: MouseEvent) => {
      // Respect modifier-clicks → let browser open in new tab/window
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      const link = (e.target as HTMLElement | null)?.closest?.('a');
      if (!link) return;
      const href = link.getAttribute('href') ?? '';
      // Only handle /map links — other routes (/thema/, /events/...) bubble
      // through unchanged so Next.js handles them normally.
      const isMapLink =
        href === '/map' || href.startsWith('/map?') || href.startsWith('/map#');
      if (!isMapLink) return;
      e.preventDefault();
      e.stopPropagation();
      if (href === '/map') {
        // Bare breadcrumb — dismiss the sheet via back().
        close();
      } else {
        // Deep link (bundesland chip etc.) — navigate to the target so
        // the user lands on the filtered map. router.push leaves the
        // sheet showing for one frame; that's acceptable for a forward
        // navigation, and the parallel-route slot resolves to null on
        // the new URL because /map matches no intercepting segment.
        closingRef.current = true;
        setExiting(true);
        window.setTimeout(() => router.push(href), EXIT_DURATION_MS);
      }
    };
    node.addEventListener('click', onClick, true); // capture phase
    return () => node.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
