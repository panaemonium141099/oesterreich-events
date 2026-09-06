import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Site footer with navigation links and data attribution.
 *
 * ODbL compliance: When venue data sourced from OpenStreetMap is displayed,
 * attribution to OSM contributors under the ODbL license is required.
 * See: https://www.openstreetmap.org/copyright
 */

/** Einheitlicher Look der Navigationslinks — elfmal derselbe String war
 *  nicht zu pflegen, ohne dass ein Eintrag aus der Reihe fällt. */
const NAV_LINK = 'text-xs text-white/30 hover:text-white/60 transition-colors';

/** Link im Attributions-Kleingedruckten. */
const ATTR_LINK = 'underline hover:text-white/40 transition-colors';

/** Externe Quelle im Kleingedruckten. Bündelt target/rel, damit kein
 *  Eintrag das `noopener` vergisst. */
function AttrLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ATTR_LINK}>
      {children}
    </a>
  );
}

export function Footer() {
  const t = useTranslations('Footer');
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
      {/* max-w-6xl statt 5xl: die Navigation trägt 11 Einträge und braucht
          die volle Breite, um auf dem Desktop in EINER Zeile zu stehen. */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Navigation in eigener, zentrierter Zeile.
            Vorher teilte sie sich eine `justify-between`-Zeile mit dem
            Copyright. Für 11 Einträge blieb dort zu wenig Platz: die Liste
            brach um und liess zwei versprengte Links auf einer zweiten
            Zeile stehen, während links daneben auch das Copyright umbrach.
            Eine eigene Zeile löst beides und bricht auf schmalen Viewports
            sauber mittig um. */}
        <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          <Link href="/ueber-uns" className={NAV_LINK}>
            {t('about')}
          </Link>
          <Link href="/blog" className={NAV_LINK}>
            {t('blog')}
          </Link>
          {/* fn-18 Task 8: zweiter Einstieg in den Freizeit-Bestand. */}
          <Link href="/aktivitaeten" className={NAV_LINK}>
            {t('activities')}
          </Link>
          <Link href="/wo-ist-was-los" className={NAV_LINK}>
            Heatmap
          </Link>
          {/* Öffentliches Inserat-Formular, Freigabe unter /admin/inserate. */}
          <Link href="/event-inserieren" className={NAV_LINK}>
            {t('submitEvent')}
          </Link>
          <Link href="/fuer-firmen" className={NAV_LINK}>
            {t('forCompanies')}
          </Link>
          <Link href="/impressum" className={NAV_LINK}>
            {t('imprint')}
          </Link>
          <Link href="/datenschutz" className={NAV_LINK}>
            {t('privacy')}
          </Link>
          <Link href="/agb" className={NAV_LINK}>
            {t('terms')}
          </Link>
          <Link href="/quellen" className={NAV_LINK}>
            {t('sources')}
          </Link>
          <a href="mailto:dev@glatzdev.com" className={NAV_LINK}>
            {t('contact')}
          </a>
        </nav>

        {/* Kleingedrucktes, durch eine Haarlinie von der Navigation
            abgesetzt: Lizenzhinweise und Copyright bilden einen eigenen
            Block und konkurrieren nicht mehr mit den Links um die Breite. */}
        <div className="mt-8 pt-6 border-t border-white/[0.04] flex flex-col items-center gap-3">
          <DataAttribution />
          <p className="text-xs text-white/25 text-center">
            &copy; {new Date().getFullYear()} LassTreffen.at. {t('rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Data attribution section displaying required license notices
 * for third-party data sources used in the platform.
 *
 * Jeder Quellenhinweis ist EIN `<span>`. Der Container ist ein Flex-Layout
 * mit `gap-x-3`; stünden Klammern und Link als getrennte Kinder darin,
 * legte der Gap eine Lücke dazwischen und es erschien "Open Data ( CC BY
 * 4.0 ), …" mit Löchern rund um die Klammern. Deshalb bleiben Klammer und
 * `<a>` innerhalb desselben Spans und auf derselben Quellzeile — ein
 * Umbruch dort fügte über die JSX-Whitespace-Regel wieder ein Leerzeichen
 * ein.
 */
function DataAttribution() {
  const t = useTranslations('Footer');
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-white/20"
      data-testid="data-attribution"
    >
      <span>
        {t('attrEvents')}: Open Data (<AttrLink href="https://creativecommons.org/licenses/by/4.0/deed.de">CC BY 4.0</AttrLink>), Austria Tourism, Wien OGD, Feratel
      </span>
      <span className="text-white/10">|</span>
      <span>
        {t('attrVenues')}: &copy; <AttrLink href="https://www.openstreetmap.org/copyright">OpenStreetMap</AttrLink>, <AttrLink href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</AttrLink>
      </span>
      <span className="text-white/10">|</span>
      <span>
        {t('attrMap')}: &copy; <AttrLink href="https://www.mapbox.com/about/maps/">Mapbox</AttrLink>
      </span>
      <span className="text-white/10">|</span>
      <Link href="/quellen" className={ATTR_LINK}>
        {t('allSources')}
      </Link>
    </div>
  );
}
