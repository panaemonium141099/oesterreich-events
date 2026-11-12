/**
 * Abdeckung der Gemeinden (fn-29.18, Report-Schritt der Pipeline): wie viele
 * Gemeinden haben mindestens einen kommenden Termin, je Land (AT, DE), je
 * Bundesland und für Deutschland je Integration der Gemeinde-Registry.
 *
 * Ein Termin gehört zu der Gemeinde, die der Ortsresolver ihm gegeben hat
 * (`location_resolution.gemeinde`); Zeilen ohne Gemeinde (Gebietsangabe,
 * Quarantäne) zählen nicht. Für die Integration zählen nur Termine des
 * Adapters, der die Gemeinde laut Registry liest: eine Gemeinde mit Termin
 * aus Eventim ist für ionas nicht abgedeckt.
 *
 * Rein und ohne I/O. Ausführung: `src/scripts/coverage-report.ts`.
 */

import { DE_LOCALE } from '@/lib/site/intl';

export interface CoverageGemeinde {
  /** Gemeindekennziffer (AT) bzw. AGS (DE). */
  id: string;
  country: string;
  /** Bundesland (AT) bzw. Land (DE), als ID. */
  region: string;
}

export interface CoverageEvent {
  country: string | null;
  source_name: string | null;
  /** Gemeinde laut Ortsentscheidung, schon auf eine Stammdaten-Gemeinde abgebildet. */
  gemeindeId: string | null;
}

export interface IntegrationAssignment {
  integration: string;
  /** Adapter, der die Integration liest (source_name seiner Termine). */
  adapter: string;
  /** Gemeinden, die die Registry dieser Integration zuordnet (eigener Kalender oder über Amt/VG). */
  gemeindeIds: string[];
}

export interface CoverageRow {
  key: string;
  gemeinden: number;
  mitTermin: number;
  /** Anteil in Prozent, eine Nachkommastelle. */
  anteil: number;
}

export interface CoverageReport {
  countries: CoverageRow[];
  regions: Record<string, CoverageRow[]>;
  integrations: CoverageRow[];
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

function row(key: string, ids: readonly string[], covered: (id: string) => boolean): CoverageRow {
  const mitTermin = ids.filter(covered).length;
  return { key, gemeinden: ids.length, mitTermin, anteil: pct(mitTermin, ids.length) };
}

export function buildCoverage(
  gemeinden: readonly CoverageGemeinde[],
  events: readonly CoverageEvent[],
  integrations: readonly IntegrationAssignment[],
): CoverageReport {
  const any = new Set<string>();
  const bySource = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.gemeindeId) continue;
    any.add(e.gemeindeId);
    if (!e.source_name) continue;
    let s = bySource.get(e.source_name);
    if (!s) bySource.set(e.source_name, (s = new Set()));
    s.add(e.gemeindeId);
  }

  const byCountry = new Map<string, CoverageGemeinde[]>();
  for (const g of gemeinden) byCountry.set(g.country, [...(byCountry.get(g.country) ?? []), g]);

  const countries: CoverageRow[] = [];
  const regions: Record<string, CoverageRow[]> = {};
  for (const [country, list] of [...byCountry].sort(([a], [b]) => a.localeCompare(b))) {
    countries.push(row(country, list.map(g => g.id), id => any.has(id)));
    const byRegion = new Map<string, string[]>();
    for (const g of list) byRegion.set(g.region, [...(byRegion.get(g.region) ?? []), g.id]);
    regions[country] = [...byRegion]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([region, ids]) => row(region, ids, id => any.has(id)));
  }

  const rows = integrations
    .map(i => row(`${i.integration} (${i.adapter})`, [...new Set(i.gemeindeIds)], id => bySource.get(i.adapter)?.has(id) ?? false))
    .sort((a, b) => b.gemeinden - a.gemeinden || a.key.localeCompare(b.key));
  return { countries, regions, integrations: rows };
}

/** Markdown-Tabelle für Konsole und GitHub-Zusammenfassung. */
export function coverageTable(title: string, rows: readonly CoverageRow[]): string {
  const lines = [`### ${title}`, '', '| | Gemeinden | mit Termin | Anteil |', '|---|---:|---:|---:|'];
  for (const r of rows) lines.push(`| ${r.key} | ${r.gemeinden} | ${r.mitTermin} | ${r.anteil.toLocaleString(DE_LOCALE)} % |`);
  return lines.join('\n');
}
