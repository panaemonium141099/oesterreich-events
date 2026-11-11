/**
 * Integrationen der DE-Gemeinde-Registry (fn-29.4), Schlüssel wie Spalte
 * `integration` der Vollerhebung (docs/research/de-gemeinden/01-vollerhebung.md).
 * Stufe A: API oder Feed, B: Hersteller-HTML, C: eingebetteter Fremdkalender,
 * D: JSON-LD/Mikrodaten, E: allgemeiner Parser, F/G: kein Kalender bzw. nicht
 * erreichbar (Rest, ggf. über den Fallback). REIN.
 */
export type Stufe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export const INTEGRATIONS: Readonly<Record<string, Stufe>> = {
  ionas: 'A', heimatinfo: 'A', nolis: 'A', tribe: 'A', communice: 'A', cross7: 'A', komm1: 'A',
  mec: 'A', jevents: 'A', eventsmanager: 'A', dpcalendar: 'A', icagenda: 'A',
  verwaltungsportal: 'B', hwext: 'B', ikiss: 'B', txnews: 'B', contao_events: 'B', weblication: 'B',
  ceasy: 'B', geocms: 'B', digipublica: 'B', open2c: 'B', calendarize: 'B', activecity: 'B',
  cmcitymedia: 'B', sitepark: 'B', townhall: 'B', contentxxl: 'B', events2: 'B', eventon: 'B', sfeventmgt: 'B',
  destinationone: 'C', deskline: 'C', termineregional: 'C', embed_other: 'C', regiogate: 'C', rce: 'C',
  toubiz: 'C', outdooractive: 'C', stadtlandnews: 'C', lkrg: 'C', crossiety: 'C',
  jsonld: 'D',
  html_generic: 'E', js_oder_feed: 'E',
  leer: 'F', kein_link: 'F',
  fehler: 'G', robots: 'G',
};

export function stufeOf(integration: string): Stufe | null {
  return INTEGRATIONS[integration] ?? null;
}

/** Integrationen, deren Feed-URL der Builder aus der Kalenderseite liest. */
export const FEED_FROM_PAGE = new Set(['ionas', 'nolis', 'tribe', 'communice', 'cross7', 'komm1', 'mec', 'jevents', 'eventsmanager', 'dpcalendar', 'icagenda']);
