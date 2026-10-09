/**
 * Das Land, dessen Events diese Seite ausspielt.
 *
 * lasstreffen.at ist rein österreichisch. Events aus Deutschland und der
 * Schweiz (Eventim-Feed) bleiben in der Datenbank, weil dafür eigene .de-
 * und .ch-Seiten geplant sind, erscheinen hier aber nirgends: nicht in
 * Listen, Karte, Suche, Detailseiten, Sitemaps, Mails oder Empfehlungen.
 *
 * Jede öffentliche Abfrage auf `events` filtert ausdrücklich mit
 * `.eq('country', SITE_COUNTRY)`. Bundesland-, Bezirks-, PLZ- oder
 * Umkreis-Filter reichen dafür nicht (Prod 2026-10-07: 1.007 DE-Events im
 * österreichischen Rechteck, etwa München und Lindau, und 36 CH-Events mit
 * österreichischem Bezirk). Wächter: src/__tests__/lib/site-country-guard.test.ts.
 */
export const SITE_COUNTRY = 'AT' as const;
