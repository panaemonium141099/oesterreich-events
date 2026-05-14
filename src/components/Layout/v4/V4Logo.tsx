/**
 * V4Logo — D7-Wordmark "lass·treffen·📍·at"
 *
 * Lifted from mockups/v4-shared.jsx (V4Logo + V4LogoPin). The pin is a
 * map-marker SVG (not a heart/balloon) baked inline so there's zero
 * extra network request. Renders without 'use client' so it stays a
 * Server Component when imported into RSC trees, but composes safely
 * inside Client-Components too (becomes part of the client bundle when
 * imported there).
 *
 * Two sizes: 'sm' (15 px) for compact contexts (mobile top-bar), 'md'
 * (17 px, default) for the desktop nav.
 *
 * Letter-spacing -0.05em comes straight from the design tokens so the
 * pin sits visually tight to the surrounding letters.
 */

const LT_PIN = '#c8553d';

interface V4LogoProps {
  size?: 'sm' | 'md';
  /** Light surfaces (rare) flip the dot inside the pin to white. */
  light?: boolean;
}

export function V4Logo({ size = 'md', light = false }: V4LogoProps) {
  const fontPx = size === 'sm' ? 15 : 17;
  const pinPx = fontPx * 0.55;
  const ink = light ? '#0a0a0c' : 'var(--v4-ink, #ffffff)';
  const dotColor = light ? '#ffffff' : 'var(--v4-surface, #0a0a0c)';

  return (
    <span
      style={{
        fontFamily: "var(--font-app, 'Inter'), system-ui, -apple-system, sans-serif",
        fontSize: fontPx,
        letterSpacing: '-0.05em',
        color: ink,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'baseline',
      }}
      data-v4-logo
    >
      <span style={{ fontWeight: 400 }}>lass</span>
      <span style={{ fontWeight: 800 }}>treffen</span>
      <svg
        data-v4-logo-pin
        width={pinPx}
        height={pinPx * 1.25}
        viewBox="0 0 24 30"
        style={{
          display: 'inline-block',
          verticalAlign: 'baseline',
          margin: '0 0.04em',
        }}
        aria-hidden="true"
      >
        <path
          d="M12 1 C 18.5 1 23 5.5 23 11.5 C 23 19 12 29 12 29 C 12 29 1 19 1 11.5 C 1 5.5 5.5 1 12 1 Z"
          fill={LT_PIN}
        />
        <circle cx="12" cy="11.5" r="4" fill={dotColor} />
      </svg>
      <span style={{ fontWeight: 400 }}>at</span>
    </span>
  );
}
