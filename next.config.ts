import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

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
  // CSP is unchanged in fn-15.4 — AdSense sources were stripped, but
  // `'unsafe-inline'` for scripts and styles still exists. fn-15.6
  // (Critical-CSS-Inline) will replace `'unsafe-inline'` with sha256-hashes
  // for the inline GA4-init block plus the inlined critical CSS. See
  // .flow/specs/fn-15... §Pillar 6 for the hash-CSP design.
  async headers() {
    // Content-Security-Policy — Defense-in-Depth gegen XSS + 3rd-party-Inject.
    // Wir erlauben explizit:
    //   - Mapbox (api.mapbox.com / events.mapbox.com / *.tiles.mapbox.com) für die Karte
    //   - Supabase (auth, REST, Realtime via wss)
    //   - Google Analytics 4 (gtag.js + collect endpoints)
    //   - Spotify API für Artist-Search
    //   - 'unsafe-inline' für Scripts (Next.js RSC hydration + GA4-init) + Styles (Tailwind)
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
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://events.mapbox.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
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
        source: '/blog/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
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

export default withBundleAnalyzer(nextConfig);
