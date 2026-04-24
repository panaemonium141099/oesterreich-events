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

export type HubType = 'gemeinde' | 'thema' | 'bundesland';

const POOLS: Record<HubType, string[]> = {
  gemeinde: GEMEINDE_INTRO_POOL,
  thema: THEMA_INTRO_POOL,
  bundesland: BUNDESLAND_INTRO_POOL,
};

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
): string {
  const pool = POOLS[hubType];
  const safeIndex = ((variantIndex % pool.length) + pool.length) % pool.length;
  const template = pool[safeIndex];
  return renderTemplate(template, ctx);
}
