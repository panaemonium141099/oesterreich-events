/**
 * Logo — the lasstreffen.at wordmark with embedded Pin-Dot.
 *
 * From the design system (logos/pindot-refinements.jsx, Variante A "Hero Pin"):
 *
 *   lasstreffen[PIN]at
 *
 * The pin replaces the "." in "lasstreffen.at" — semantic-rich (pin = location,
 * matches the map-first product) and visually distinctive at all sizes.
 *
 * Default proportions and weights are from PdA (the foundational variant). The
 * other 7 refinements (B-H) layer additional moves like pulse rings, sub-line,
 * coordinates — those are NOT implemented here. Add as separate variants if
 * needed; the base PdA is the universally-applicable lockup.
 *
 * Sizing: pass `size` (in px) as the font size of the wordmark text. The pin
 * auto-scales to half the font size (PdA spec). For very small header use
 * (~16-20px) the pin still reads as a marker; for hero use (>=48px) the
 * shadow becomes visible.
 *
 * Light vs dark: pass `variant="dark"` for use on dark surfaces — switches
 * the wordmark to cream/white, the pin to coral. Default is `light` variant
 * for use on white/cream surfaces.
 */
import { Pin, BRAND } from './Pin';

export interface LogoProps {
  /** Font size in CSS px. Default 24. Pin auto-scales to size/2. */
  size?: number;
  /**
   * Color variant. `light` (default) = dark text on light bg. `dark` = cream
   * text on dark bg. The pin color also adapts (rust → coral on dark).
   */
  variant?: 'light' | 'dark';
  /**
   * When true, adds drop-shadow to the pin for material weight. Default true
   * at size >= 48 (hero), false otherwise (avoids muddy shadow at small sizes).
   */
  shadow?: boolean;
  /**
   * Accessible label for the whole logo. Default: "lasstreffen.at — Startseite".
   * Use this if the logo is wrapped in a clickable element that needs a label.
   */
  ariaLabel?: string;
  /** Extra className applied to the root <span>. */
  className?: string;
}

export function Logo({
  size = 24,
  variant = 'light',
  shadow,
  ariaLabel = 'lasstreffen.at',
  className,
}: LogoProps) {
  // Auto-shadow heuristic per PdA spec: shadow only at hero sizes.
  const effectiveShadow = shadow ?? size >= 48;

  // Color choices per variant. Coral on dark is the design-system override
  // (#f87171) for readability — pure rust-red has too little contrast against
  // the very-dark surface tokens.
  const inkColor = variant === 'dark' ? '#ffffff' : BRAND.ink;
  const pinColor = variant === 'dark' ? BRAND.accentOnDark : BRAND.accent;
  // Dot color: on light bg the dot is white (carved out of red). On dark bg,
  // the dot inherits the surface color so the pin reads as "hole + ring".
  const dotColor = variant === 'dark' ? BRAND.dark : '#ffffff';

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{
        // Geist matches the design canvas. Falls back gracefully if Geist
        // isn't loaded (system-ui has decent sans for the wordmark shape).
        fontFamily: "'Geist', 'Inter', system-ui, -apple-system, sans-serif",
        fontSize: size,
        fontWeight: 800,
        letterSpacing: '-0.05em',
        color: inkColor,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0,
        // Prevent the pin from being broken across lines if the wordmark wraps.
        whiteSpace: 'nowrap',
      }}
    >
      lasstreffen
      <span
        style={{
          display: 'inline-block',
          transform: 'translateY(0.06em)',
          margin: '0 0.04em',
        }}
        aria-hidden
      >
        <Pin
          size={size * 0.5}
          color={pinColor}
          dotColor={dotColor}
          shadow={effectiveShadow}
        />
      </span>
      at
    </span>
  );
}

/**
 * LogoCompact — same wordmark but rendered in a smaller, denser layout
 * appropriate for tight header rows (current "ÖE" replacement). The pin is
 * scaled down further (40% of size, not 50%) so the lockup stays single-line
 * in viewports < 400px.
 */
export function LogoCompact({
  size = 16,
  variant = 'light',
  ariaLabel = 'lasstreffen.at',
  className,
}: Omit<LogoProps, 'shadow'>) {
  const inkColor = variant === 'dark' ? '#ffffff' : BRAND.ink;
  const pinColor = variant === 'dark' ? BRAND.accentOnDark : BRAND.accent;
  const dotColor = variant === 'dark' ? BRAND.dark : '#ffffff';

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{
        fontFamily: "'Geist', 'Inter', system-ui, -apple-system, sans-serif",
        fontSize: size,
        fontWeight: 800,
        letterSpacing: '-0.045em',
        color: inkColor,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'baseline',
        whiteSpace: 'nowrap',
      }}
    >
      lasstreffen
      <span
        style={{
          display: 'inline-block',
          transform: 'translateY(0.04em)',
          margin: '0 0.03em',
        }}
        aria-hidden
      >
        <Pin size={size * 0.4} color={pinColor} dotColor={dotColor} />
      </span>
      at
    </span>
  );
}
