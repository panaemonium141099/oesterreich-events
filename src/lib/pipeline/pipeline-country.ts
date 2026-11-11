/**
 * Land eines Nachbearbeitungslaufs. AT und DE laufen als getrennte Systeme
 * (`scrape-events.yml` und `scrape-events-de.yml`): gleicher Code, gleiche
 * Datenbank, aber jeder Lauf fasst nur die Zeilen seines Landes an. Ein
 * roter DE-Lauf hält AT nicht auf und umgekehrt.
 *
 * `scrape-pipeline.ts --country DE` setzt `PIPELINE_COUNTRY`, die Schritte
 * (eigene Prozesse) lesen es über `pipelineCountry()`. Ohne Angabe (lokale
 * Läufe) gilt wie bisher: alle Länder.
 *
 * Der AT-Lauf nimmt alles außer DE mit (auch die Eventim-Zeilen aus CH),
 * sonst bliebe ein Land ohne eigenen Lauf liegen. `events.country` ist
 * NOT NULL (Standard 'AT'), `neq` verliert also keine Zeile.
 */

export type PipelineCountry = 'AT' | 'DE';

const COUNTRIES: readonly PipelineCountry[] = ['AT', 'DE'];

/** `--country X`, sonst `PIPELINE_COUNTRY`, sonst null (alle Länder). */
export function pipelineCountry(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): PipelineCountry | null {
  const i = argv.indexOf('--country');
  const raw = (i >= 0 ? argv[i + 1] : env.PIPELINE_COUNTRY)?.trim().toUpperCase();
  if (!raw) return null;
  if (!(COUNTRIES as readonly string[]).includes(raw)) {
    throw new Error(`Unbekanntes Land für die Nachbearbeitung: ${raw} (erlaubt: ${COUNTRIES.join(', ')})`);
  }
  return raw as PipelineCountry;
}

/** Gehört eine Zeile mit diesem Land zum Lauf? */
export function inRunCountry(rowCountry: string | null | undefined, country: PipelineCountry | null): boolean {
  if (!country) return true;
  const c = rowCountry ?? 'AT';
  return country === 'DE' ? c === 'DE' : c !== 'DE';
}

/** Filter auf das Land des Laufs (AT: alles außer DE); ohne Land unverändert. */
export function forCountry<Q>(query: Q, country: PipelineCountry | null): Q {
  if (!country) return query;
  // Strukturell typisiert sprengt der PostgREST-Builder den Typprüfer (TS2589).
  const q = query as unknown as { eq(c: string, v: string): Q; neq(c: string, v: string): Q };
  return country === 'DE' ? q.eq('country', 'DE') : q.neq('country', 'DE');
}

/** DE-Gemeinde-Adapter heißen `de-…` (src/lib/scrapers/de/). */
export function sourceCountry(sourceName: string): PipelineCountry {
  return sourceName.startsWith('de-') ? 'DE' : 'AT';
}

/**
 * Schritte, die nicht je Land laufen: Website (Lineups, Bildmaße, Adress-
 * Geocoder, Indexing, Ortskennzahlen, AT-Bericht, alle nur für AT gebaut)
 * und Wächter über die ganze Datenbank (security_audit, artist_matching).
 * Sie laufen nur im AT-Lauf, damit nichts doppelt oder gar nicht läuft.
 */
export const AT_ONLY_STEPS = [
  'venues',
  'festival_lineups',
  'image_probe',
  'address_geocoding',
  'security_audit',
  'artist_matching',
  'indexing',
  'location_metrics',
  'report',
] as const;

/** Läuft der Schritt im Lauf dieses Landes? Ohne Land: jeder. */
export function stepRunsFor(step: string, country: PipelineCountry | null): boolean {
  if (!country || country === 'AT') return true;
  return !(AT_ONLY_STEPS as readonly string[]).includes(step);
}

/** Name des Laufs in Alarm-Mail (workflow_runs) und Zusammenfassung. */
export function pipelineWorkflowName(country: PipelineCountry | null): string {
  return country === 'DE' ? 'scrape-pipeline-de' : 'scrape-pipeline';
}
