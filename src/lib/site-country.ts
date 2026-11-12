/**
 * Das Land, dessen Events diese Seite ausspielt.
 *
 * Der Wert kommt aus der Site-Konfiguration (`src/lib/site/`, Variable
 * `SITE_COUNTRY` zur Build-Zeit, Standard Österreich). lasstreffen.at zeigt
 * nur österreichische Events, lasstreffen.de nur deutsche. Events eines
 * anderen Landes (auch Eventim Schweiz) bleiben in der Datenbank, erscheinen
 * auf dieser Seite aber nirgends: nicht in Listen, Karte, Suche,
 * Detailseiten, Sitemaps, Mails oder Empfehlungen.
 *
 * Jede öffentliche Abfrage auf `events` filtert ausdrücklich mit
 * `.eq('country', SITE_COUNTRY)`. Bundesland-, Bezirks-, PLZ- oder
 * Umkreis-Filter reichen dafür nicht (Prod 2026-10-07: 1.007 DE-Events im
 * österreichischen Rechteck, etwa München und Lindau, und 36 CH-Events mit
 * österreichischem Bezirk). Wächter: src/__tests__/lib/site-country-guard.test.ts.
 */
import { getSite, type SiteCountry } from '@/lib/site';

export const SITE_COUNTRY: SiteCountry = getSite().country;
