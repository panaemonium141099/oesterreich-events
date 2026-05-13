/**
 * Planer-scope typography — fn-15.8.
 *
 * Fraunces (variable serif) and Caveat (variable handwriting) are ONLY
 * imported by the layouts that render the `.planer-scope` atmosphere:
 *   - /groups (Planer hub)
 *   - /groups/[id] (Plan detail, includes the post-it Pinboard with
 *                   handwritten notes)
 *   - /join/[code] (invite redemption, shares the editorial chrome)
 *
 * Other routes (landing, blog, /map, /feed, …) do NOT import this
 * module, so Next.js does not emit @font-face declarations for these
 * faces on those routes — saving ~340 KB of WOFF2 bytes on the
 * critical path of the landing.
 *
 * Self-hosted Latin-1 subsets live in /public/fonts/fraunces/ and
 * /public/fonts/caveat/. Source: Google Fonts' pre-built `latin`
 * subset slice (unicode-range U+0000-00FF), which is already smaller
 * than what pyftsubset would produce because Google's tooling is
 * best-in-class for this.
 *
 * Display strategy: `display: 'optional'` here too — even inside
 * Planer, we never want a font-flash that shifts the editorial
 * hero. The grain + spotlight chrome carries the atmosphere while
 * the font warms in.
 */
import localFont from 'next/font/local';

export const fraunces = localFont({
  src: [
    {
      path: '../../public/fonts/fraunces/Fraunces-Variable.woff2',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: '../../public/fonts/fraunces/Fraunces-Variable-Italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-fraunces',
  display: 'optional',
  preload: false, // not above-the-fold on landing; lazy on Planer paint
  fallback: ['ui-serif', 'Georgia', 'serif'],
});

export const caveat = localFont({
  src: [
    {
      path: '../../public/fonts/caveat/Caveat-Variable.woff2',
      weight: '400 700',
      style: 'normal',
    },
  ],
  variable: '--font-caveat',
  display: 'optional',
  preload: false,
  // NB: next/font/local emits a string-templated fontFamily for the
  // synthesized fallback face, so values must NOT contain embedded
  // double-quotes (turbopack chokes on the nested escapes). The
  // PostitNote / Pinboard call-sites already supply the quoted
  // "Segoe Script" / Bradley Hand alternatives in their own style
  // strings, so keeping the global fallback to unquoted family
  // names is fine.
  fallback: ['Segoe Script', 'Bradley Hand', 'cursive'],
});
