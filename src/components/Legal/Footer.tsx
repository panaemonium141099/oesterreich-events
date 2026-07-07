import Link from 'next/link';

/**
 * Site footer with navigation links and data attribution.
 *
 * ODbL compliance: When venue data sourced from OpenStreetMap is displayed,
 * attribution to OSM contributors under the ODbL license is required.
 * See: https://www.openstreetmap.org/copyright
 */
export function Footer() {
  return (
    // pb-32 (= 8rem) prevents the fixed SocialNav pill at `bottom-0 mb-4`
    // from overlapping the footer links (Impressum / Datenschutz / AGB /
    // Quellen / Kontakt) when the user scrolls to the very bottom of the
    // landing page. The pill is ~60px tall + 16px bottom margin + breathing
    // room; 128px of padding guarantees the last row stays clearly above it
    // on both mobile and desktop.
    //
    // fn-15.2 — Footer-Fix:
    // Removed `mt-auto`. Previously the parent flex container used mt-auto
    // to push the footer to the viewport bottom on short pages. When the
    // four async landing sections mounted client-side, the container grew
    // and mt-auto's available-space allotment changed → footer translated
    // down by hundreds of pixels (CLS 0.535 root cause per PSI audit).
    // Now the footer just follows document flow. The landing-page wrapper
    // reserves the section boxes via Suspense fallbacks (see
    // SectionSkeletons.tsx) so the layout is stable at first paint.
    <footer className="w-full border-t border-white/[0.06] pb-32">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Main footer row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} LassTreffen.at. Alle Rechte vorbehalten.
          </p>
          <nav className="flex items-center gap-6">
            <Link href="/ueber-uns" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Über uns
            </Link>
            <Link href="/blog" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Blog
            </Link>
            <Link href="/fuer-firmen" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Für Firmen
            </Link>
            <Link href="/impressum" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Impressum
            </Link>
            <Link href="/datenschutz" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Datenschutz
            </Link>
            <Link href="/agb" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              AGB
            </Link>
            <Link href="/quellen" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Datenquellen
            </Link>
            <a href="mailto:dev@glatzdev.com" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Kontakt
            </a>
          </nav>
        </div>

        {/* Data attribution row */}
        <DataAttribution />
      </div>
    </footer>
  );
}

/**
 * Data attribution section displaying required license notices
 * for third-party data sources used in the platform.
 */
function DataAttribution() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-white/20"
      data-testid="data-attribution"
    >
      <span>Veranstaltungsdaten: Open Data (</span>
      <a
        href="https://creativecommons.org/licenses/by/4.0/deed.de"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-white/40 transition-colors"
      >
        CC BY 4.0
      </a>
      <span>), Austria Tourism, Wien OGD, Feratel</span>
      <span className="text-white/10">|</span>
      <span>Venues: &copy;{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40 transition-colors"
        >
          OpenStreetMap
        </a>,{' '}
        <a
          href="https://opendatacommons.org/licenses/odbl/1-0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40 transition-colors"
        >
          ODbL
        </a>
      </span>
      <span className="text-white/10">|</span>
      <span>Karte: &copy;{' '}
        <a
          href="https://www.mapbox.com/about/maps/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40 transition-colors"
        >
          Mapbox
        </a>
      </span>
      <span className="text-white/10">|</span>
      <Link
        href="/quellen"
        className="underline hover:text-white/40 transition-colors"
      >
        Alle Quellen
      </Link>
    </div>
  );
}
