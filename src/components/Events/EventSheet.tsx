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

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface EventSheetProps {
  children: React.ReactNode;
}

export function EventSheet({ children }: EventSheetProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    // router.back() is the only reliable way to dismiss an intercepting
    // route. router.push('/map') changes the URL bar but Next.js doesn't
    // always re-resolve the parallel `modal` slot to default.tsx — the
    // modal stays visible. back() pops the URL off history, which the
    // router treats as a proper modal-close event.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/map');
    }
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
  // Fix: catch all map-bound link clicks on the overlay's capture phase
  // and route them through close() → router.back(). Browser-back is the
  // navigation gesture Next.js handles cleanly for parallel-route
  // dismissal. Other links (/thema/, /events/other, etc.) bubble
  // through unchanged.
  useEffect(() => {
    const node = overlayRef.current;
    if (!node) return;
    const onClick = (e: MouseEvent) => {
      // Respect modifier-clicks → let browser open in new tab/window
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      const link = (e.target as HTMLElement | null)?.closest?.('a');
      if (!link) return;
      const href = link.getAttribute('href') ?? '';
      // Strict prefix check — must be the literal /map path so a future
      // /map-something route doesn't get accidentally swallowed.
      if (href === '/map' || href.startsWith('/map?') || href.startsWith('/map#')) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    node.addEventListener('click', onClick, true); // capture phase
    return () => node.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      <motion.div
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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
      </motion.div>
    </AnimatePresence>
  );
}
