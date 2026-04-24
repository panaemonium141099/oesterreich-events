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
  // Security + cache headers
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
    ];
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
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
