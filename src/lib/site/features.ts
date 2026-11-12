/**
 * Feature-Matrix der Seite (fn-31): welche Säulen dieser Build ausspielt.
 *
 * lasstreffen.at hat alles an. lasstreffen.de startet mit Events, Karte,
 * Suche, Land- und Gemeinde-Hubs und den Rechtsseiten; die übrigen Säulen
 * führen nur österreichische Inhalte und wären dort leer oder falsch.
 *
 * Eine abgeschaltete Säule antwortet 404 (Seite und API, entschieden in
 * src/middleware.ts) und steht in keiner Navigation und keiner Sitemap.
 * Umschalten: eine Zeile in `features` der Seite (src/lib/site/sites.ts).
 */
import { getSite } from './index';
import type { SiteConfig, SiteFeature } from './sites';

/** Pfade je Säule: Seiten ohne Sprachpräfix und API-Routen. */
export const FEATURE_PATHS: Record<SiteFeature, readonly string[]> = {
  blog: ['/blog'],
  festivals: ['/festivals'],
  activities: ['/aktivitaeten', '/aktivitaet', '/api/activities', '/sitemap-activities.xml'],
  artists: ['/artists', '/kuenstler', '/spotify-matches', '/api/artists', '/api/spotify'],
  students: ['/studenten'],
  themes: ['/thema'],
  venues: ['/venues', '/api/venues'],
  heatmap: ['/wo-ist-was-los'],
  business: ['/fuer-firmen', '/event-inserieren', '/widget', '/api/business', '/api/checkout', '/api/widget'],
  account: [
    '/auth', '/profile', '/settings', '/saved', '/gemerkt', '/notifications', '/calendar', '/join',
    '/api/auth', '/api/me', '/api/saved-events', '/api/notifications', '/api/push',
  ],
  social: [
    '/feed', '/friends', '/groups', '/messages', '/memories', '/plan', '/plans',
    '/api/comments', '/api/plans',
  ],
  newsletter: ['/api/newsletter', '/api/event-reminder'],
  admin: ['/admin', '/api/admin'],
};

/** Pfad ohne Sprachpräfix und das Präfix, falls er eines trug. */
function splitLocale(pathname: string): { path: string; locale: string | null } {
  const m = pathname.match(/^\/(en|de)(\/.*|$)/);
  return m ? { path: m[2] || '/', locale: m[1] } : { path: pathname || '/', locale: null };
}

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Die Säule, zu der ein Pfad gehört; null für den Kern (immer an). */
export function featureOfPath(pathname: string): SiteFeature | null {
  const { path } = splitLocale(pathname);
  for (const [feature, prefixes] of Object.entries(FEATURE_PATHS) as [SiteFeature, readonly string[]][]) {
    if (prefixes.some(p => under(path, p))) return feature;
  }
  return null;
}

/** Spielt die Seite diesen Pfad aus? Prüft Säule und Sprache. */
export function isPathEnabled(pathname: string, site: SiteConfig = getSite()): boolean {
  const { locale } = splitLocale(pathname);
  if (locale && !(site.locales as readonly string[]).includes(locale)) return false;
  const feature = featureOfPath(pathname);
  return feature === null || site.features[feature];
}

export function hasFeature(feature: SiteFeature, site: SiteConfig = getSite()): boolean {
  return site.features[feature];
}

/** true, wenn die Seite alles ausspielt (lasstreffen.at): kein Pfad wird geprüft. */
export function everythingEnabled(site: SiteConfig = getSite()): boolean {
  return Object.values(site.features).every(Boolean) && site.locales.includes('en');
}
