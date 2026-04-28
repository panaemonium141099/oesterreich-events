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
  const closingRef = useRef(false);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
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

  return (
    <AnimatePresence>
      <motion.div
        key="event-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Event Details"
        className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain"
        style={{ background: '#0a0a0c' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Floating close button — pinned top-right, always reachable
            even while the user scrolls through the event content. The
            same exit is also bound to ESC and the browser back button. */}
        <button
          type="button"
          onClick={close}
          aria-label="Schließen — zurück zur Karte"
          className="
            fixed top-4 right-4 z-[70]
            w-10 h-10 rounded-full
            flex items-center justify-center
            transition-colors hover:bg-black/80
          "
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {children}
      </motion.div>
    </AnimatePresence>
  );
}
