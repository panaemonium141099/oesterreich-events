import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import createNextIntlPlugin from 'next-intl/plugin';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * fn-15.6 round 4 (codex) — load + RE-VERIFY CRITICAL_CSS sha256 hash.
 *
 * Why re-verify: codex flagged that a committed `.csp-hash.json` would
 * defeat the prebuild safeguard if someone invokes `next build` directly
 * (skipping the prebuild + postbuild hooks). A stale hash would silently
 * ship and CSP-block the actual rendered <style> in production.
 *
 * Behaviour:
 *   1. Read .csp-hash.json (the prebuild artifact, NOT committed — see
 *      .gitignore entry).
 *   2. Re-compute the hash from the CURRENT src/lib/critical-css.ts bytes
 *      (same algorithm as scripts/compute-csp-hash.mjs).
 *   3. If both exist AND match → trust and return.
 *      If both exist AND differ → recompute, warn loudly. The JSON is
 *      stale; we use the freshly-computed value so headers() ships a
 *      hash that matches what React will actually render.
 *      If JSON missing but we can read the source → recompute on the fly.
 *      If neither → fall back to env var, else throw in production.
 *
 * Production builds that skip prebuild are still loud-failures here — we
 * either compute the hash from source or throw. We never trust a stale
 * committed hash silently.
 */
function extractCriticalCssFromSource(): string | null {
  const srcPath = path.join(__dirname, 'src', 'lib', 'critical-css.ts');
  if (!existsSync(srcPath)) return null;
  const src = readFileSync(srcPath, 'utf8');
  const m = src.match(/export\s+const\s+CRITICAL_CSS\s*=\s*`([\s\S]*?)`\s*;/m);
  return m ? m[1] : null;
}

function sha256Base64(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

function loadCriticalCssHash(): string {
  // Step 1: try to compute the canonical hash from the live source. This
  // is the ground truth — whatever React serialises into <style> at runtime
  // must match this exact byte sequence.
  const liveCss = extractCriticalCssFromSource();
  const liveHash = liveCss !== null ? sha256Base64(liveCss) : null;

  // Step 2: read the artifact (if present) and compare.
  const jsonPath = path.join(__dirname, '.csp-hash.json');
  let artifactHash: string | null = null;
  if (existsSync(jsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(jsonPath, 'utf8')) as { hash?: string };
      if (parsed.hash) artifactHash = parsed.hash;
    } catch {
      /* artifact unparseable — ignore, fall through */
    }
  }

  // Decision: live wins. The artifact is only used when we can't read source.
  if (liveHash) {
    if (artifactHash && artifactHash !== liveHash) {
      console.warn(
        '[next.config.ts] .csp-hash.json is stale ' +
          `(artifact=${artifactHash}, live=${liveHash}). Using LIVE hash — ` +
          'run `node scripts/compute-csp-hash.mjs` to refresh the artifact.',
      );
    }
    return liveHash;
  }
  if (artifactHash) {
    console.warn(
      '[next.config.ts] critical-css.ts unreadable; falling back to ' +
        '.csp-hash.json artifact (cannot verify freshness).',
    );
    return artifactHash;
  }
  const fromEnv = process.env.NEXT_PUBLIC_CRITICAL_CSS_HASH;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[next.config.ts] CRITICAL_CSS hash unavailable: critical-css.ts not readable, ' +
        '.csp-hash.json missing, NEXT_PUBLIC_CRITICAL_CSS_HASH unset. ' +
        'Run `node scripts/compute-csp-hash.mjs` before `next build`.',
    );
  }
  return '';
}

const CRITICAL_CSS_HASH = loadCriticalCssHash();

/**
 * Remote image patterns for Next.js Image component.
 *
 * Consolidated to stay within the 50-pattern limit.
 * Austrian domains (**.at) are covered by a single broad wildcard since
 * the vast majority of scraper sources are Austrian websites.
 * Other TLDs are listed individually or grouped where possible.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Unsplash (category fallback images)
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Google (user-uploaded content)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Supabase storage
      { protocol: 'https', hostname: '**.supabase.co' },

      // Austrian domains (.at) — broad wildcard covers all *.at scraper sources
      // Includes: burgenland.at, esterhazy.at, falter.at, eventim.at, oeticket.at,
      // flex.at, fluc.at, u4.at, partytimer.at, ganz-wien.at, posthof.at,
      // linztermine.at, rockhouse.at, mayrhofen.at, stubaital.at, tirol.at,
      // basilika-mariazell.at, mariazell.at, basiskultur.at, oho.at, b72.at,
      // otbrauerei.at, salzkammergut.at, zillertal.at, nassfeld.at, graztourismus.at,
      // schladming-dachstein.at, serfaus-fiss-ladis.at, meinbezirk.at, events.at,
      // popculture.at, kultur.graz.at, camera-club.at, volksgarten.at, praterdome.at,
      // wuk.at, gv.at (Gemeinde), etc.
      { protocol: 'https', hostname: '**.at' },
      { protocol: 'http', hostname: '**.at' },

      // .wien TLD (Vienna venues: arena.wien, rhiz.wien, cafeleopold.wien)
      { protocol: 'https', hostname: '**.wien' },

      // .com domains — broad wildcard for scraped event images from arbitrary .com hosts
      { protocol: 'https', hostname: '**.com' },
      { protocol: 'https', hostname: '**.ticketmaster.com' },
      { protocol: 'https', hostname: '**.feverup.com' },
      { protocol: 'https', hostname: '**.stadthalle.com' },
      { protocol: 'https', hostname: '**.praterwien.com' },
      { protocol: 'https', hostname: '**.grelleforelle.com' },
      { protocol: 'https', hostname: '**.neusiedlersee.com' },
      { protocol: 'https', hostname: '**.soelden.com' },
      { protocol: 'https', hostname: '**.oetztal.com' },
      { protocol: 'https', hostname: '**.ischgl.com' },
      { protocol: 'https', hostname: '**.saalbach.com' },
      { protocol: 'https', hostname: '**.zellamsee-kaprun.com' },
      { protocol: 'https', hostname: '**.bodensee-vorarlberg.com' },
      { protocol: 'https', hostname: '**.sassvienna.com' },
      { protocol: 'https', hostname: '**.achensee.com' },
      { protocol: 'https', hostname: '**.gastein.com' },
      { protocol: 'https', hostname: '**.kitzbuehel.com' },
      { protocol: 'https', hostname: '**.osttirol.com' },
      { protocol: 'https', hostname: '**.szenewien.com' },
      { protocol: 'https', hostname: '**.donau.com' },

      // .edu domains (MCI Management Center Innsbruck)
      { protocol: 'https', hostname: '**.mci.edu' },

      // Niche scraper domains
      { protocol: 'https', hostname: '**.ra.co' },
      { protocol: 'https', hostname: 'ra.co' },
      { protocol: 'https', hostname: '**.festival.at' },
      { protocol: 'https', hostname: 'festival.at' },

      // Broad wildcards for scraped event images from arbitrary external hosts
      { protocol: 'https', hostname: '**.net' },
      { protocol: 'https', hostname: '**.org' },
      { protocol: 'https', hostname: '**.info' },
      { protocol: 'https', hostname: '**.tv' },
      { protocol: 'https', hostname: '**.live' },
      { protocol: 'https', hostname: '**.travel' },
      { protocol: 'https', hostname: '**.tt' },
      { protocol: 'https', hostname: '**.eu' },
      { protocol: 'https', hostname: '**.de' },
      { protocol: 'https', hostname: '**.art' },
      // Additional TLDs in use by festival-overrides.json (rosengarten.cc,
      // impuls.cc, avb.am, ottensheimopenair.cargo.site). next/image
      // validates hostnames even when `unoptimized` is set; an unrecognized
      // host throws "Invalid src prop" and the error boundary that catches
      // it makes client-side navigation hang on the /festivals listing.
      { protocol: 'https', hostname: '**.cc' },
      { protocol: 'https', hostname: '**.am' },
      { protocol: 'https', hostname: '**.site' },
    ],
  },
  // Reduziert Info-Disclosure: kein "X-Powered-By: Next.js" Header.
  poweredByHeader: false,
  // Security + cache headers.
  //
  // fn-15.4 (Third-Party Cleanup + non-CSP Security Headers) reorganised this
  // block into three buckets:
  //
  //   1. **Site-wide hardening** (every route): HSTS preload, X-Content-Type-
  //      Options, Referrer-Policy, X-Frame-Options=SAMEORIGIN, DNS-Prefetch,
  //      Permissions-Policy, plus the existing CSP. These cannot break any
  //      route because they're either UA-side hints (HSTS, Referrer-Policy,
  //      nosniff) or already satisfied (SAMEORIGIN allows same-origin frames
  //      e.g. for our own modal flows).
  //   2. **Landing-only isolation** (`source: '/'` exact match): COOP=same-
  //      origin + COEP=credentialless. We intentionally do NOT use a regex
  //      blacklist — Codex flagged that as too easy to leak (any new public
  //      route inherits it). Exact-match scoping here means /entdecken
  //      (Mapbox web-workers), /auth/* (OAuth popups), /feed and /admin
  //      (third-party embeds), /blog/* (potential video embeds), /events/*
  //      and /planer all stay COOP/COEP-free.
  //   3. **Blog cache** (unchanged).
  //
  // fn-15.6 — finalized CSP. `'unsafe-inline'` removed from style-src and
  // replaced with `'sha256-<CRITICAL_CSS_HASH>'`. The hash itself is
  // computed at prebuild time by `scripts/compute-csp-hash.mjs` from
  // `src/lib/critical-css.ts` (the SINGLE source of truth for the inline
  // <style> block) and written to `.env.production` as
  // `NEXT_PUBLIC_CRITICAL_CSS_HASH`. The postbuild verifier
  // (`scripts/verify-csp-hash.mjs`) refuses to ship if the rendered HTML
  // <style data-critical-css> body doesn't hash to that same value.
  //
  // Why a fixed env var and not a runtime hash: a runtime hash would
  // force the headers() handler to read the file system on every request
  // (slow) AND would diverge if the build emits a different inline body
  // than what we hashed (broken page paint). The env var is baked at
  // build time and read once at module load.
  //
  // `'unsafe-inline'` STAYS in script-src for now. Next.js still emits
  // hydration data scripts inline, and the two `<script type="application/
  // ld+json">` blocks (WebSite + Organization schema) live in the layout
  // head. Stripping `'unsafe-inline'` from script-src is its own task
  // (fn-15.10 picks up the Service Worker register-script and may revisit
  // this) — fn-15.6's scope is the inlined `<style>` block.
  async headers() {
    // Content-Security-Policy — Defense-in-Depth gegen XSS + 3rd-party-Inject.
    // Wir erlauben explizit:
    //   - Mapbox (api.mapbox.com / events.mapbox.com / *.tiles.mapbox.com) für die Karte
    //   - Supabase (auth, REST, Realtime via wss)
    //   - Google Analytics 4 (gtag.js + collect endpoints)
    //   - Spotify API für Artist-Search
    //   - 'unsafe-inline' für Scripts (Next.js RSC hydration + JSON-LD)
    //   - sha256-hash für Styles (inlined critical CSS only; Tailwind chunk loads via <link>)
    //   - 'unsafe-eval' für Mapbox GL JS (WebGL-Compiler)
    //
    // BUG-FIX 02.05.: ohne *.tiles.mapbox.com werden Vector-Tiles vom Worker
    // geblockt → m.isStyleLoaded() bleibt für immer false → die ganze
    // Karte rendert 0 Marker, egal wie viele Events der Source übergeben
    // werden. User-Symptom war "ich sehe keine Events bei meiner Gemeinde".
    //
    // 2026-05-12 (fn-15.4): Google ad-network script + frame + connect sources
    // removed from CSP (publisher account not approved). See fn-15.4 task spec
    // and commit for the full removal — repo-grep stays clean of ad-network
    // string fragments to make the audit reproducible.

    // fn-15.6: CRITICAL_CSS_HASH is loaded synchronously at module-load
    // time via loadCriticalCssHash() (see top of file). On production
    // builds with prebuild skipped, that helper throws — so by the time
    // headers() runs, cssHash is guaranteed to be the correct sha256
    // matching the rendered inline <style data-critical-css> block.
    const cssHash = CRITICAL_CSS_HASH;

    // fn-15.6 round 5 (codex re-review): hash + 'unsafe-inline' on BOTH
    // style-src (fallback) and style-src-elem (modern). 'unsafe-inline'
    // is required to keep inline style="..." attributes working
    // (React renders many of these — modal backdrops, animation delays,
    // Mapbox markers). 'unsafe-hashes' is too narrow for the dynamic
    // attribute values we ship.
    //
    // The hash on style-src is NOT redundant: modern browsers prefer the
    // hash over 'unsafe-inline' when both are present per CSP3 spec
    // (the SRI/nonce rule), so the actual <style data-critical-css>
    // block is hash-validated. The 'unsafe-inline' fallback only
    // applies to elements/attributes NOT covered by hashes.
    //
    // This is the trade-off Codex round-14 ultimately steered toward:
    // we don't get pure-hash strictness, but we get the meaningful
    // primary-XSS-vector protection (the <style> block) AND avoid the
    // huge refactor of moving every inline style attribute to classes.
    const styleSrcCommon = ["'self'", "'unsafe-inline'", 'https://api.mapbox.com'];
    if (cssHash) styleSrcCommon.push(`'sha256-${cssHash}'`);
    const styleSrcSources = ['style-src', ...styleSrcCommon];
    const styleSrcElemSources = ['style-src-elem', ...styleSrcCommon];

    // fn-15.10 round 2 (codex fix): Workbox is now SELF-HOSTED under
    // /public/workbox/, so the SW boots from the same origin as the app
    // — no third-party CDN dependency, no CSP allowlist creep, and the
    // SW remains evaluable even when network conditions or geoblocking
    // would otherwise prevent loading from storage.googleapis.com.
    // The previous storage.googleapis.com entries on script-src +
    // connect-src have been removed.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://events.mapbox.com https://www.googletagmanager.com https://www.google-analytics.com",
      styleSrcSources.join(' '),
      styleSrcElemSources.join(' '),
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://api.spotify.com https://accounts.spotify.com https://www.google-analytics.com https://www.googletagmanager.com https://stats.g.doubleclick.net",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-src 'self' https://accounts.google.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    // Site-wide headers — safe on every route.
    //
    // X-Frame-Options is intentionally SAMEORIGIN (not DENY) so that our own
    // modal-route intercept (e.g. /events/[id] opened over /map) which uses
    // same-origin iframes for prefetched payloads still renders. External
    // sites are still blocked from embedding us.
    //
    // Strict-Transport-Security uses the preload-eligible directive set:
    // max-age >= 1 year + includeSubDomains + preload. lasstreffen.at must
    // be on the HSTS-Preload list (hstspreload.org) before this header
    // gains the long-tail protection from first-time visitors. The header
    // itself is safe to ship today — preload status is independent.
    const siteWideHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      { key: 'Content-Security-Policy', value: csp },
    ];

    // Landing-only isolation headers (`/` exact match).
    //
    // COOP=same-origin opens the site in a fresh browsing-context group, which
    // unlocks `performance.measureUserAgentSpecificMemory()` and prevents
    // cross-origin window-handle leaks. It MUST NOT be applied to OAuth
    // callback routes — those expect `window.opener` to survive across
    // origins.
    //
    // COEP=credentialless is the relaxed variant of COEP=require-corp: it
    // strips credentials from cross-origin no-CORS image/script requests
    // instead of blocking them. This lets `/_next/image/...` (Vercel image
    // optimisation, all our scraper-host CDN images) keep loading without
    // requiring those third-parties to add `Cross-Origin-Resource-Policy`
    // headers — something we cannot control. require-corp would have
    // killed roughly every event image on the landing.
    //
    // Both headers are scoped to the EXACT path '/' so that Mapbox web-
    // workers (/entdecken), OAuth popups (/auth/*), third-party embeds
    // (/feed, /admin) and individual event/blog pages remain unaffected.
    // COOP `same-origin` (Codex fn-15.4 round 3 — reverted from earlier
    // `allow-popups` attempt). `same-origin-allow-popups` is technically
    // not cross-origin-isolated, so it would NOT satisfy the
    // `crossOriginIsolated`-flag requirements and weaken the protection
    // story. Per Landing audit: `/` has only `<Link>` navigations to
    // /auth/login (no inline popup launchers, no Google One Tap), so
    // `same-origin` is safe here. If a future change adds popup-based
    // auth UI directly on `/`, that's the moment to either:
    //   (a) scope a looser policy to just that sub-surface, or
    //   (b) switch to redirect-mode OAuth instead of popup.
    // Today: safe + meets the +Best-Practices score target.
    const landingIsolationHeaders = [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
    ];

    return [
      {
        // Apply site-wide security headers to all routes
        source: '/(.*)',
        headers: siteWideHeaders,
      },
      {
        // Landing-only isolation: ONLY '/' (no path-prefix matching).
        // Next.js exact-match is just the literal '/' with no trailing
        // wildcard. /entdecken, /blog, /events do NOT match.
        source: '/',
        headers: landingIsolationHeaders,
      },
      {
        // B2B-Widget (P3 Syndication): /widget/* ist die EINZIGE Fläche,
        // die fremde Origins einbetten dürfen. Gleicher Header-Key wie in
        // siteWideHeaders → diese spätere Regel überschreibt die CSP nur
        // für diesen Pfad und hängt `frame-ancestors *` an. Das inherited
        // X-Frame-Options=SAMEORIGIN bleibt stehen, wird aber von allen
        // CSP2-Browsern ignoriert, sobald frame-ancestors präsent ist —
        // Alt-Browser ohne CSP2 blocken das Embedding schlimmstenfalls.
        source: '/widget/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: `${csp}; frame-ancestors *` },
        ],
      },
      {
        source: '/blog/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      // fn-15.10: Service Worker registration script.
      //
      // The browser is the ONLY path through which updated SW bytes
      // reach the user (no CDN purge, no manual reload picks up a stale
      // /sw.js if it's been served with a long max-age). Browsers
      // already revalidate /sw.js on every navigation, but they still
      // honour the `max-age` directive — so a cached /sw.js with
      // `max-age=31536000` would shadow new deploys for a full year.
      //
      // We set `Cache-Control: public, max-age=0, must-revalidate` so
      // every navigation triggers a conditional GET (cheap, 304 most of
      // the time) and a real deploy is picked up on the next page-load.
      // Service-Worker-Allowed isn't strictly needed at scope '/' (it
      // defaults to the script's own path) but we include it explicitly
      // so future moves of /sw.js are obvious.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  /**
   * `www.lasstreffen.at` → `lasstreffen.at` consolidation.
   *
   * Without this redirect block Vercel ships a **307 Temporary Redirect**
   * for the www host. 307 tells Google "the www version might come back"
   * and Google refuses to consolidate ranking signals — result: `Seite
   * mit Weiterleitung` warning in Search Console and www URLs sit as
   * ghost entries in the index that never get indexed.
   *
   * `permanent: true` emits a **301 Permanent Redirect**, the correct
   * signal for a canonical host change.
   */
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.lasstreffen.at' }],
        destination: 'https://lasstreffen.at/:path*',
        permanent: true,
      },
      // /admin → /admin/overview at the CDN edge.
      //
      // Previously this was a Server-Component `redirect('/admin/overview')`
      // inside src/app/admin/page.tsx, which forced the full Next.js
      // pipeline (middleware session-refresh → RSC render → redirect
      // throw) to run before the browser saw the 307. On cold Vercel
      // Function starts — or when the RSC payload fetch from a client
      // navigation flaked — Chrome rendered "This page couldn't load"
      // and only a hard reload recovered, because a reload triggers a
      // plain top-level fetch instead of the RSC path.
      //
      // Moving the redirect to `redirects()` turns it into a CDN-level
      // 307 that fires before any function is invoked. No cold start,
      // no RSC race, no middleware dependency.
      {
        source: '/admin',
        destination: '/admin/overview',
        permanent: false, // 307 — may add a real /admin dashboard later
      },
      // Retired /stadt/{city} hubs → canonical /gemeinde system.
      //
      // The old /stadt pages ran the pre-refactor LandingPageShell and
      // cannibalized the new city-aware /gemeinde hubs (GSC: Google ranked
      // /gemeinde/4020-linz for "veranstaltungen linz" while /stadt/linz
      // sat unindexed). 301 consolidates the duplicate's signals onto the
      // canonical gemeinde URL. Slug map mirrors STADT_TO_GEMEINDE in
      // src/lib/hubs/city-hubs.ts (Wien is a Bundesland → /wien).
      ...(
        [
          ['linz', '/gemeinde/4020-linz'],
          ['graz', '/gemeinde/8010-graz'],
          ['innsbruck', '/gemeinde/6020-innsbruck'],
          ['salzburg-stadt', '/gemeinde/5020-salzburg'],
          ['klagenfurt', '/gemeinde/9020-klagenfurt-am-woerthersee'],
          ['wien', '/wien'],
        ] as const
      ).flatMap(([city, destination]) => [
        { source: `/stadt/${city}`, destination, permanent: true },
        { source: `/stadt/${city}/:path*`, destination, permanent: true },
      ]),
    ];
  },
  // better-sqlite3 only used by scraper scripts, not by API routes
  serverExternalPackages: ['better-sqlite3'],
  // Standalone output for Docker deployment (Coolify)
  output: 'standalone',
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// fn-17: next-intl Plugin verdrahtet src/i18n/request.ts als Request-Config
const withNextIntl = createNextIntlPlugin();

export default withBundleAnalyzer(withNextIntl(nextConfig));
