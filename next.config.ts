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

      // .com domains (international & tourism portals)
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

      // .net / .org / .tv / .info / .live / .travel
      { protocol: 'https', hostname: '**.veranstaltungskalender.net' },
      { protocol: 'https', hostname: '**.deskline.net' },
      { protocol: 'https', hostname: '**.daswerk.org' },
      { protocol: 'https', hostname: '**.pratersauna.tv' },
      { protocol: 'https', hostname: '**.burgenland.info' },
      { protocol: 'https', hostname: '**.kaernten.live' },
      { protocol: 'https', hostname: '**.vorarlberg.travel' },
      { protocol: 'https', hostname: '**.events.tt' },
    ],
  },
  // better-sqlite3 only used by scraper scripts, not by API routes
  serverExternalPackages: ['better-sqlite3'],
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer(nextConfig);
