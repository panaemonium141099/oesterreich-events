/**
 * Planer-Flow typography stack.
 *
 * We keep the site default (Inter via globals.css `body{}`) untouched so the
 * rest of the app doesn't re-paint. Two CSS variables get mounted at the
 * <html> level and are applied only where a component opts-in via the
 * `.planer-scope` / `.serif-display` utilities (defined in globals.css).
 *
 *   Fraunces — variable serif, used for large editorial moments only.
 *              SOFT axis adds a subtle terminal-rounding for a less brittle
 *              feel; opsz auto-adjusts letterform for size.
 *   Geist    — variable sans, replaces Inter inside the planer scope for
 *              slightly sharper letterforms.
 *
 * Both fonts are self-hosted by next/font → no layout shift, no CLS, no
 * Google Fonts network call at runtime.
 */
import { Fraunces } from 'next/font/google';
import { Geist } from 'next/font/google';
import { Caveat } from 'next/font/google';

export const fraunces = Fraunces({
  subsets: ['latin'],
  // `variable` unlocks the full weight-range (100-900) AND lets us touch the
  // custom axes below. If we used discrete weights, Next rejects axes.
  weight: 'variable',
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
  // Variable axes we want to style via font-variation-settings later:
  //   SOFT (0-100) → slight terminal softness for a less brittle look
  //   opsz         → optical sizing auto-tuned per size
  axes: ['SOFT', 'opsz'],
});

export const geist = Geist({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-geist',
  display: 'swap',
});

// Handwritten font for pinboard post-its. Keeps things "analogue" on the
// stickies against the editorial serif + clean sans elsewhere.
export const caveat = Caveat({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-caveat',
  display: 'swap',
});
