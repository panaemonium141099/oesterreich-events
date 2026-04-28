'use client';

/**
 * EventSheet — animated drawer that wraps EventDetailV2 when rendered
 * via the @modal intercepting route (`app/@modal/(.)events/[...slug]/page.tsx`).
 *
 * Three behaviours that distinguish it from the full event page:
 *   1. Slides in from the right on desktop (60vw, full height) and from
 *      the bottom on mobile (90vh). Spring-based motion to feel snappy.
 *   2. Closes on backdrop click + Escape key + a top-right close button.
 *      `router.back()` is preferred — it pops the intercepted URL off
 *      the history and returns to /map (or wherever the sheet was
 *      opened from). Falls back to `router.push('/map')` when there's
 *      no history (e.g. user landed via a deep link with the sheet
 *      already open, which shouldn't happen but better safe).
 *   3. Locks body scroll while open — the underlying map keeps its
 *      camera state, but we don't want the page to scroll behind the
 *      drawer.
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
    // router.back() pops the intercepted URL from history → modal slot
    // resolves to default.tsx (null) → AnimatePresence runs the exit
    // animation. If the user landed deep without history, fall back
    // to a hard-nav to /map.
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

  // Body scroll-lock while sheet is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="event-sheet"
        className="fixed inset-0 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop — dark + blur. Click closes. */}
        <motion.div
          className="absolute inset-0 cursor-pointer"
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)',
          }}
          onClick={close}
          aria-hidden="true"
        />

        {/* Drawer — slides in from right on desktop, bottom on mobile. */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Event Details"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 280, mass: 0.9 }}
          // Mobile-first: slide from bottom. The lg:* override turns it
          // into a right-side drawer on desktop.
          className="
            absolute bottom-0 left-0 right-0
            h-[92vh] lg:h-full
            lg:top-0 lg:bottom-0 lg:left-auto lg:right-0
            lg:w-[min(720px,60vw)]
            overflow-y-auto overscroll-contain
            rounded-t-3xl lg:rounded-none lg:rounded-l-3xl
            shadow-[0_-8px_40px_rgba(0,0,0,0.5)]
            lg:shadow-[-12px_0_40px_rgba(0,0,0,0.5)]
          "
          style={{ background: '#0a0a0c' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag-handle (mobile) — pure visual hint, no actual drag yet. */}
          <div className="flex justify-center pt-3 lg:hidden">
            <div className="w-12 h-1.5 rounded-full bg-white/15" />
          </div>

          {/* Close button — pinned top-right above the hero. Always visible
              while content scrolls underneath. */}
          <button
            type="button"
            onClick={close}
            aria-label="Schließen"
            className="
              fixed lg:absolute top-4 right-4 z-[70]
              w-10 h-10 rounded-full
              flex items-center justify-center
              transition-colors
              hover:bg-black/80
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
      </motion.div>
    </AnimatePresence>
  );
}
