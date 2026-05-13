/**
 * Critical above-the-fold CSS — fn-15.6 (Critical CSS Inline).
 *
 * Single Source of Truth for the inlined `<style>` block in
 * `src/app/layout.tsx`. The prebuild hook `scripts/compute-csp-hash.mjs`
 * reads this constant, computes its SHA-256, and writes
 * `NEXT_PUBLIC_CRITICAL_CSS_HASH` into `.env.production`. The postbuild
 * hook `scripts/verify-csp-hash.mjs` then scans the rendered `.next/server/app/`
 * HTML to confirm the inline block matches the published hash — any drift
 * fails the build instead of shipping a broken CSP.
 *
 * **Scope**: only the rules needed to paint the landing hero (above-fold).
 * Anything below the fold — map markers, popups, planer-scope, blog
 * cache surfaces — stays in `src/app/globals.css` where Tailwind can
 * still tree-shake it via @layer/@apply.
 *
 * **Why a TS const and not a `.css` file imported via raw-loader**:
 *  1. Determinism. Webpack/Turbopack can re-order or post-process CSS
 *     files between dev and prod; a TS string is byte-stable.
 *  2. Hash reproducibility. Both `compute-csp-hash.mjs` (Node-side,
 *     `import('./src/lib/critical-css.ts')` via tsx) and the React
 *     server-render emit the EXACT same bytes from this file.
 *  3. Tree-shake safety. We re-export only `CRITICAL_CSS` and a
 *     `computeCriticalCssHash()` helper, so the layout pulls just the
 *     string into its server bundle.
 *
 * **Source-of-truth ordering inside the constant**:
 *  1. Box-sizing reset (`*`)
 *  2. Body reset (`body`) — margin/font/background. MUST set the
 *     dark backdrop so the page never flashes white before
 *     globals.css arrives.
 *  3. Above-fold layout primitives — landing gradient mesh and its
 *     animated pseudo-element.
 *  4. Hero text animations — fadeInUp / fadeIn keyframes used by the
 *     headline, stats, tagline, search bar. These have a 0.3-0.8s
 *     delay; if the corresponding CSS isn't applied at first paint
 *     the elements stay invisible.
 *  5. `prefers-reduced-motion` overrides for everything above.
 *
 * Below-fold and feature-keyed styles (skeleton shimmer, popups, map
 * markers, planer-scope etc.) stay in globals.css and load via the
 * normal CSSOM path — render-blocking but no longer first-paint-blocking
 * because the inline block already painted the hero.
 *
 * **Size target**: <= 3 KB minified-ish (we keep it readable; the byte
 * count is dominated by the meshShift / fadeInUp rules anyway). Verified
 * via `CRITICAL_CSS.length` at startup.
 *
 * **Update protocol** when adding/removing rules:
 *   1. Edit this file.
 *   2. Run `node scripts/compute-csp-hash.mjs` locally to regenerate
 *      `.env.production` (CI runs this as prebuild).
 *   3. Commit both files. The verify hook will refuse to build if the
 *      committed hash drifts from what HTML actually serves.
 */

export const CRITICAL_CSS = `*{box-sizing:border-box}body{margin:0;font-family:'Inter',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#000;color:#fff}html{color-scheme:dark}.gradient-mesh{position:relative;background-color:#000;background-image:radial-gradient(at 20% 80%,rgba(99,102,241,.08) 0,transparent 50%),radial-gradient(at 80% 20%,rgba(168,85,247,.06) 0,transparent 50%),radial-gradient(at 50% 50%,rgba(59,130,246,.04) 0,transparent 50%)}.gradient-mesh-animated{isolation:isolate;overflow:clip}.gradient-mesh-animated::before{content:'';position:absolute;inset:-25%;z-index:-1;pointer-events:none;background-image:radial-gradient(at 20% 80%,rgba(99,102,241,.08) 0,transparent 50%),radial-gradient(at 80% 20%,rgba(168,85,247,.06) 0,transparent 50%),radial-gradient(at 50% 50%,rgba(59,130,246,.04) 0,transparent 50%);will-change:transform;transform:translate3d(0,0,0);animation:meshShift 15s ease-in-out infinite alternate}.gradient-mesh-animated.gradient-mesh,.gradient-mesh.gradient-mesh-animated{background-image:none}@keyframes meshShift{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-12%,-10%,0)}}@keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}.animate-fade-in-up{animation:fadeInUp .4s ease-out both}.animate-fade-in{animation:fadeIn .3s ease-out both}*:focus{outline:none!important;box-shadow:none!important}*:focus-visible{outline:1.5px solid rgba(100,116,139,.3)!important;outline-offset:1px}@media (prefers-reduced-motion:reduce){.gradient-mesh-animated::before{animation:none;transform:translate3d(0,0,0)}.animate-fade-in-up,.animate-fade-in{animation:none;opacity:1;transform:none}}`;

/**
 * Compute the SHA-256 hash of the inline CSS exactly the way the browser
 * does for CSP's `'sha256-<base64>'` syntax: hash the byte stream of the
 * `<style>` text content, then base64 the digest.
 *
 * Returns the base64-encoded digest WITHOUT the `sha256-` prefix or the
 * surrounding single quotes — callers add those where needed (the CSP
 * builder in `next.config.ts` does this so the prefix isn't double-emitted).
 *
 * Web Crypto in Node 20+ exposes `crypto.subtle.digest`, which is the same
 * API the browser uses. We deliberately don't use Node's `createHash` so
 * the helper can be re-used in any runtime the project might run in
 * (Edge, browser, Node).
 */
export async function computeCriticalCssHash(css: string = CRITICAL_CSS): Promise<string> {
  const { subtle } = globalThis.crypto;
  const bytes = new TextEncoder().encode(css);
  const digest = await subtle.digest('SHA-256', bytes);
  // base64-encode the 32-byte digest. Node 20+ has Buffer; we feature-
  // detect so this also works in the browser if ever called there.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(new Uint8Array(digest)).toString('base64');
  }
  // Browser-safe fallback (e.g. middleware on the Edge runtime).
  let binary = '';
  const u8 = new Uint8Array(digest);
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}
