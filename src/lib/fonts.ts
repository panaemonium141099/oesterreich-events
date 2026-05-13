/**
 * Site typography stack — fn-15.8 (Self-host Fonts + Latin-1 Subsetting).
 *
 * Before fn-15.8: all three families were loaded from `next/font/google`
 * at the ROOT layout. That meant the landing page (anonymous, no Planer
 * scope) downloaded ~266 KB of fonts up-front, even though only Geist
 * has a non-system fallback there.
 *
 * After fn-15.8:
 *  - Geist Variable is self-hosted in /public/fonts/geist/, Latin-1
 *    subset (~28 KB woff2), and mounted at the root with
 *    `display: 'optional'` + `preload: true`. This means it never
 *    blocks first paint (FCP) — if the woff2 isn't in the cache and
 *    network is slow, the system fallback renders and Geist is used
 *    silently on the NEXT navigation.
 *  - The editorial serif (Fraunces) and the handwriting face for
 *    pinboard post-its move to `fonts-planer.ts`, which is imported
 *    ONLY by the layouts that actually need them (`/groups`,
 *    `/groups/[id]`, `/join`). Landing, blog, /map and other routes
 *    never pull those bytes.
 *
 * Why Geist still loads on every route:
 *  - <Logo> on the landing page hard-codes `font-family: 'Geist', …`
 *    (see src/components/Brand/Logo.tsx). Without the font preloaded,
 *    the wordmark would FOIT to system-ui until the user hits a
 *    secondary route that imports Geist. Mounting it at the root
 *    keeps the brand consistent and is cheap (~28 KB optional).
 *
 * Why `display: 'optional'`:
 *  - `swap` would still cause a CLS hit when Geist arrives and the
 *    fallback width shifts. `optional` tells the browser: if the font
 *    isn't ready in <=100 ms, just keep the fallback. Zero layout
 *    shift, no font-flash on cold cache. The font then warms the
 *    cache for the next navigation.
 *
 * Why `preload: true`:
 *  - Geist is used above-the-fold (logo, hero text via .planer-scope
 *    fallback). Next.js emits a <link rel="preload"> for it which
 *    pairs with `display: optional` to maximize the chance the font
 *    is ready before paint.
 */
import localFont from 'next/font/local';

export const geist = localFont({
  src: [
    {
      path: '../../public/fonts/geist/Geist-Variable.woff2',
      weight: '100 900',
      style: 'normal',
    },
  ],
  variable: '--font-geist',
  display: 'optional', // never block FCP; warm cache for next paint
  preload: true, // emit <link rel="preload"> in <head>
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  // Geist's x-height is very close to system-ui — no adjust needed.
});
