'use client';

import { useEffect, useState } from 'react';

interface DoubleTapHeartProps {
  show: boolean;
}

/**
 * DoubleTapHeart — fn-15.5: the motion-lib AnimatePresence pop was
 * replaced with the global `data-scale-pop` CSS keyframe (globals.css).
 * `mounted` keeps the heart in the DOM long enough for the close
 * keyframe to play before unmount.
 */
const EXIT_MS = 260;

export function DoubleTapHeart({ show }: DoubleTapHeartProps) {
  const [mounted, setMounted] = useState(show);
  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [show, mounted]);

  if (!mounted) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
      data-scale-pop={show ? 'open' : 'closed'}
    >
      <svg className="w-20 h-20 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </div>
  );
}
