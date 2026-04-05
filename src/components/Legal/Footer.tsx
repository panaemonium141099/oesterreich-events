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
    <footer className="w-full border-t border-white/[0.06] mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Main footer row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Österreich Events. Alle Rechte vorbehalten.
          </p>
          <nav className="flex items-center gap-6">
            <Link href="/blog" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Blog
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
 *
 * Currently attributes:
 * - OpenStreetMap (ODbL 1.0) - venue location data
 */
function DataAttribution() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-white/20"
      data-testid="data-attribution"
    >
      <span>Venue data:</span>
      <span>
        &copy;{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40 transition-colors"
        >
          OpenStreetMap
        </a>{' '}
        contributors,{' '}
        <a
          href="https://opendatacommons.org/licenses/odbl/1-0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40 transition-colors"
        >
          ODbL
        </a>
      </span>
    </div>
  );
}
