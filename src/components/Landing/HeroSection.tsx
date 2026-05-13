import { HeroSearch } from '@/components/Landing/HeroSearch';

/**
 * HeroSection — fn-15.9: pure RSC shell.
 *
 * Pre-refactor this was a `'use client'` component containing the whole
 * search-input UI, the keyboard nav, the suggestions-dropdown state and
 * the curtain-down navigation animation. That meant the surrounding
 * fade-in-up wrapper AND the static "Konzerte · Nightlife · …" hint
 * were both shipped as JS — even though they never re-render and have
 * zero interactivity.
 *
 * Post-refactor:
 *   - This file is a Server Component (no `'use client'` directive).
 *   - The wrapper div + the category-hint paragraph render as plain
 *     HTML in the prerendered ISR response.
 *   - Only the interactive search-box (`HeroSearch`) is a Client
 *     boundary — that's the SINGLE above-fold Client-Island after
 *     fn-15.5, fn-15.7 and now fn-15.9.
 *
 * Animation note: the `animate-fade-in-up` class + inline animationDelay
 * are pure CSS keyframes (defined in globals.css). They run on the
 * server-rendered DOM without needing JS, so keeping them on a server
 * node is fine — no hydration mismatch, no animation-skip on slow
 * networks.
 */
export function HeroSection() {
  return (
    <div
      className="w-full max-w-xl animate-fade-in-up opacity-0"
      style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}
    >
      {/* Search + Button — the ONLY interactive island in the hero. */}
      <HeroSearch />

      {/* Category hints — pure static text, rendered server-side. */}
      <p className="text-white/25 text-sm mt-5 tracking-wide">
        Konzerte · Nightlife · Märkte · Kultur · Sport · Feste & Brauchtum
      </p>
    </div>
  );
}
