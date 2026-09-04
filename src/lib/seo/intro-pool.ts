/**
 * Intro-paragraph pool for content refresh rotation.
 *
 * Hub pages (gemeinde / thema / bundesland) have a visible intro
 * paragraph below the H1 — the one AI agents cite and the one Google
 * snippets pick up as "content about this page". Refreshing this
 * paragraph monthly on high-traffic hubs signals "last modified" to
 * Google without requiring a full-scale content rewrite.
 *
 * Each pool is an ordered array of templates. The `seo_hub_refreshes`
 * table stores `intro_variant_index` per hub — the monthly cron
 * increments it (mod pool length), so every pool cycles through all
 * variants over (pool.length × refresh_interval) months.
 *
 * Variants differ in angle:
 *   - #0 is the neutral default (what the static-rendered version says)
 *   - #1-n are paraphrases + angle variations (seasonal, community-
 *     focused, practical-help-focused, etc.)
 *
 * All pool entries support the same `{name}`, `{count}`, `{plz}`,
 * `{bundesland}` placeholders used by the experiment framework, so
 * the interpolation lives in one helper.
 *
 * Keeping pools small (3-4 entries) per hub-type. Larger pools make
 * the content feel drifty; 3 paraphrases × 3 months gives each
 * variant enough time to get re-crawled before rotating.
 */

import { renderTemplate } from './experiments';

export interface IntroContext {
  name: string;
  count: number;
  plz?: string;
  bundesland?: string;
}

const GEMEINDE_INTRO_POOL: string[] = [
  // #0 — default, matches what the page renders today when no refresh has run.
  'Aktuell {count} Veranstaltungen im Umkreis von 10 km um {name} — von Konzerten und Festen bis zu Kulturevents. Alle Termine werden täglich aus offiziellen Quellen aktualisiert.',
  // #1 — community angle
  '{count} Events rund um {name} im {bundesland} — der gemeinsame Kalender für alles was in deiner Region passiert. Täglich aktualisiert aus über 140 offiziellen Quellen.',
  // #2 — practical angle
  'Was ist los in {name} und Umgebung? Aktuell {count} Termine im 10-km-Radius: Konzerte, Märkte, Vereinsabende, Kirchenveranstaltungen, Sport. Alles an einem Ort.',
  // #3 — seasonal / "fresh" framing
  'Die kommenden {count} Veranstaltungen in {name} ({plz}) — täglich aktualisiert. Hier findest du alle öffentlichen Events aus der Region, zusammengetragen aus offiziellen Kalendern von Gemeinde, Tourismus und Veranstaltern.',
];

const THEMA_INTRO_POOL: string[] = [
  '{count} Veranstaltungen bundesweit in dieser Kategorie. Tägliche Aktualisierung, direkt aus den Kalendern der Veranstalter.',
  'Alles zum Thema in Österreich — aktuell {count} Termine von Wien bis Vorarlberg. Alle aus offiziellen Quellen, alle verlinkt zurück zum Veranstalter.',
  'Der Österreich-weite Überblick — {count} Termine in dieser Kategorie, nach Bundesland gefiltert, täglich aktualisiert.',
];

const BUNDESLAND_INTRO_POOL: string[] = [
  'Alle öffentlichen Veranstaltungen in {name} — Konzerte, Feste, Kulturabende, Märkte, Sport. Aus über 140 offiziellen Quellen zusammengetragen.',
  'Der gemeinsame Veranstaltungskalender für {name} — vom Dorffest bis zum Open-Air-Festival. Tägliche Updates aus Gemeinde- und Tourismus-Kalendern.',
  'Was ist los in {name}? Aktuelle Events aus allen Städten und Gemeinden, nach Kategorie sortiert. Eingebunden aus offiziellen Quellen, nie manipulierte Daten.',
];

/**
 * Englische Pools (fn-17). Gleiche Laenge und gleiche Reihenfolge wie die
 * deutschen — der Rotations-Index aus `seo_hub_refreshes` gilt fuer beide
 * Sprachen, also muss Variante #2 in beiden Sprachen dieselbe Aussage
 * treffen. `poolSize()` prueft das zur Laufzeit nicht; die Gleichheit ist
 * durch den Test in src/__tests__ abgesichert.
 */
const GEMEINDE_INTRO_POOL_EN: string[] = [
  'Currently {count} events within 10 km of {name} — from concerts and festivals to cultural programmes. All dates are updated daily from official sources.',
  '{count} events around {name} in {bundesland} — the shared calendar for everything happening in your region. Updated daily from more than 140 official sources.',
  'What is on in {name} and nearby? Currently {count} dates within a 10 km radius: concerts, markets, club evenings, church events, sport. All in one place.',
  'The next {count} events in {name} ({plz}) — updated daily. Every public event in the region, collected from the official calendars of the municipality, tourism boards and organisers.',
];

const THEMA_INTRO_POOL_EN: string[] = [
  "{count} events nationwide in this category. Updated daily, straight from the organisers' calendars.",
  'Everything on this topic in Austria — currently {count} dates from Vienna to Vorarlberg. All from official sources, all linked back to the organiser.',
  'The Austria-wide overview — {count} dates in this category, filterable by state, updated daily.',
];

const BUNDESLAND_INTRO_POOL_EN: string[] = [
  'All public events in {name} — concerts, festivals, cultural evenings, markets, sport. Collected from more than 140 official sources.',
  'The shared event calendar for {name} — from the village fair to the open-air festival. Daily updates from municipal and tourism calendars.',
  'What is on in {name}? Current events from every city and municipality, sorted by category. Sourced from official calendars, never manipulated data.',
];

export type HubType = 'gemeinde' | 'thema' | 'bundesland';

const POOLS: Record<HubType, string[]> = {
  gemeinde: GEMEINDE_INTRO_POOL,
  thema: THEMA_INTRO_POOL,
  bundesland: BUNDESLAND_INTRO_POOL,
};

const POOLS_EN: Record<HubType, string[]> = {
  gemeinde: GEMEINDE_INTRO_POOL_EN,
  thema: THEMA_INTRO_POOL_EN,
  bundesland: BUNDESLAND_INTRO_POOL_EN,
};

function poolFor(hubType: HubType, locale: string): string[] {
  return locale === 'en' ? POOLS_EN[hubType] : POOLS[hubType];
}

export function poolSize(hubType: HubType): number {
  return POOLS[hubType].length;
}

/**
 * Returns the rendered intro paragraph for a given hub at the given
 * variant index. Index is clamped mod pool-length so callers don't
 * have to worry about overflow.
 */
export function renderIntro(
  hubType: HubType,
  variantIndex: number,
  ctx: IntroContext,
  locale = 'de',
): string {
  const pool = poolFor(hubType, locale);
  const safeIndex = ((variantIndex % pool.length) + pool.length) % pool.length;
  const template = pool[safeIndex];
  return renderTemplate(template, ctx);
}
