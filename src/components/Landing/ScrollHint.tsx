'use client';

import { useEffect, useState } from 'react';

/**
 * Animated chevron under the hero — nudges users to scroll for the
 * sections below (WeeklyHighlights, FestivalBlogSection, …). Fades out
 * once the user has scrolled past the first ~80 px so it doesn't follow
 * them down the page.
 */
export function ScrollHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY < 80);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none flex justify-center mt-6 mb-2 transition-opacity duration-300 ${
        visible ? 'opacity-70' : 'opacity-0'
      }`}
    >
      <svg
        className="w-6 h-6 text-white/60 animate-bounce motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
