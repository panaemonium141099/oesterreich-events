/**
 * Prüfstand-Bericht als Markdown (fn-29.3): Metriken gegen die AT-Referenz,
 * Diff nach `source_id` und eine abhakbare Stichprobe gegen die Quellseite.
 * Der Bericht gehört in den PR jedes Adapters. REIN, kein I/O.
 */
import type { PruefMetrics, PruefRow, RunDiff } from './metrics';
import { isPublished, sampleRows } from './metrics';
import { evaluate, SAMPLE_SIZE, type AtReferenz } from './schwellen';
import { hasTimeOfDay, viennaCalendarDay } from '@/lib/quality/admission';

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

/** Berliner Ortszeit wie auf der Seite; ohne echte Uhrzeit nur der Tag. */
export function localStart(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  if (!hasTimeOfDay(iso)) return `${viennaCalendarDay(d).split('-').reverse().join('.')} (ohne Uhrzeit)`;
  return d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
}

export interface ReportInput {
  adapter: string;
  generatedAt: string;
  scraped: number;
  rejected: number;
  rejectionReasons: Record<string, number>;
  metrics: PruefMetrics;
  rows: PruefRow[];
  ref: AtReferenz;
  diff?: RunDiff | null;
  cache?: { hits: number; recorded: number; misses: number };
  sampleSize?: number;
}

export function buildReport(i: ReportInput): { markdown: string; passed: boolean } {
  const verdicts = evaluate(i.metrics, i.ref);
  const passed = verdicts.every(v => v.ok);
  const L: string[] = [];
  L.push(`# Prüfstand ${i.adapter}`, '');
  L.push(`Stand ${i.generatedAt}. Automatische Schwellen: **${passed ? 'bestanden' : 'NICHT bestanden'}**. Die Stichprobe unten prüft der Mensch; erst beide zusammen geben den Nachtlauf frei.`, '');
  L.push(`Geliefert ${i.scraped}, vom Sync verworfen ${i.rejected}, geschrieben ${i.metrics.n}, davon öffentlich ${i.metrics.published}, Quarantäne ${i.metrics.quarantined}.`);
  if (i.cache) L.push(`Cache: ${i.cache.hits} aus dem Cache, ${i.cache.recorded} neu geladen, ${i.cache.misses} fehlend.`);
  L.push('');
  L.push('## Schwellen', '', '| Prüfung | Wert | Grenze | Ergebnis |', '|---|---|---|---|');
  for (const v of verdicts) L.push(`| ${v.check} | ${v.value} | ${v.limit} | ${v.ok ? 'ok' : 'gerissen'} |`);
  L.push('', '## Kennzahlen', '', '| Kennzahl | Adapter | AT gepoolt |', '|---|---|---|');
  for (const [k, v] of Object.entries(i.metrics.rates)) {
    L.push(`| ${k} | ${pct(v)} | ${pct(i.ref.pooled.rates[k as keyof PruefMetrics['rates']])} |`);
  }
  const reasons = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || 'keine';
  L.push('', `Verwerfungsgründe: ${reasons(i.rejectionReasons)}.`, `Quarantänegründe: ${reasons(i.metrics.quarantineReasons)}.`);
  if (i.diff) {
    L.push('', '## Vorher/nachher nach source_id', '');
    L.push(`unverändert ${i.diff.unchanged}, geändert ${i.diff.changed.length}, übernommen ${i.diff.carried.length}, weg ${i.diff.gone.length}, neu ${i.diff.added.length}`);
    if (i.diff.gone.length) L.push('', `Weg (erste 20): ${i.diff.gone.slice(0, 20).join(', ')}`);
  }
  const size = i.sampleSize ?? SAMPLE_SIZE;
  const sample = sampleRows(i.rows.filter(isPublished), size);
  L.push('', `## Stichprobe (${sample.length} öffentliche Zeilen)`, '');
  L.push('Je Zeile gegen die Quellseite prüfen und abhaken: Titel, Datum, Uhrzeit, Ort. Schwelle: 30 von 30 korrekt.', '');
  L.push('| ok | Titel | Beginn (Ortszeit) | Ort | Quelle |', '|---|---|---|---|---|');
  for (const r of sample) {
    const esc = (s: string | null | undefined) => (s ?? '').replace(/\|/g, '/').slice(0, 80);
    L.push(`| [ ] | ${esc(r.title)} | ${localStart(r.start_date)} | ${esc(r.location_name)} | ${r.source_url ?? ''} |`);
  }
  return { markdown: L.join('\n') + '\n', passed };
}
