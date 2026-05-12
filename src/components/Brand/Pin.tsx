/**
 * Pin — the map-marker glyph that is the heart of the lasstreffen.at brand.
 *
 * Comes from the design system's "Pin-Dot" direction (logos/pindot-refinements.jsx,
 * Variante A "Hero Pin"). Default colors: rust-red body (#c8553d) with a white
 * center dot. On dark surfaces, swap body to coral (#f87171) and dot to surface
 * color so the pin reads correctly without losing the marker semantic.
 *
 * SVG path is the *same* glyph used on the design canvas — do not re-draw
 * locally. If you need a different visual style, add a new prop, don't fork
 * the path.
 */
export interface PinProps {
  /**
   * Width of the pin in CSS px. Height is auto (1.25× width, matching the
   * 24×30 viewBox). Set this; don't set height — the aspect ratio is fixed.
   */
  size?: number;
  /** Body color. Default: rust-red (#c8553d). */
  color?: string;
  /** Center-dot color. Default: white. On dark surfaces pass surface color. */
  dotColor?: string;
  /** Tilt in degrees. Pivots around the bottom point. Used for "dropped pin" look. */
  tilt?: number;
  /** When true, adds the soft drop shadow that gives the pin material weight. */
  shadow?: boolean;
  /** Optional className for additional styling. */
  className?: string;
  /**
   * Verbal description for screen readers. Default null = decorative
   * (aria-hidden). Set to a string when the pin alone communicates meaning
   * (e.g. standalone favicon, no wordmark next to it).
   */
  ariaLabel?: string;
}

export function Pin({
  size = 24,
  color = '#c8553d',
  dotColor = '#fff',
  tilt = 0,
  shadow = false,
  className,
  ariaLabel,
}: PinProps) {
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 24 30"
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'baseline',
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        transformOrigin: '50% 95%',
        filter: shadow ? 'drop-shadow(0 4px 8px rgba(26,20,16,0.25))' : undefined,
      }}
    >
      <path
        d="M12 1 C 18.5 1 23 5.5 23 11.5 C 23 19 12 29 12 29 C 12 29 1 19 1 11.5 C 1 5.5 5.5 1 12 1 Z"
        fill={color}
      />
      <circle cx="12" cy="11.5" r="4" fill={dotColor} />
    </svg>
  );
}

/**
 * Brand color tokens. Single source of truth, also exported for use in
 * favicons (icon.tsx), open-graph images, and any inline style that needs
 * the brand colors. Mirrors design-system pindot-refinements.jsx constants.
 */
export const BRAND = {
  /** Rust-red pin body for light backgrounds. */
  accent: '#c8553d',
  /** Lighter coral for dark backgrounds (better contrast/readability). */
  accentOnDark: '#f87171',
  /** Warm off-white — ink color in Planer / dark-mode brand surfaces. */
  cream: '#f3ecdb',
  /** Lighter paper variant of cream. */
  paper: '#fbf7ec',
  /** Brand ink for light surfaces. */
  ink: '#1a1410',
  /** Default dark-surface background. */
  dark: '#0a0a0c',
} as const;
