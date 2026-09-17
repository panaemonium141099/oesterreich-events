/**
 * Backfill von poi_activities.accessibility fuer den Deskline-Bestand
 * (Migration 20260917150000_poi_activities_accessibility.sql).
 *
 * Wendet dieselbe Ableitung wie der Ingest an (accessibility.ts:
 * holidayThemes vor Beschreibungstext) auf alle Deskline-Zeilen an und
 * schreibt nur die Zeilen, deren Befund sich aendert. themes_raw ist im
 * Bestand erst nach dem naechsten woechentlichen Ingest gefuellt — bis
 * dahin wirkt hier nur der Text; der Ingest ueberschreibt den Befund
 * danach ohnehin mit seiner eigenen (identischen) Ableitung.
 *
 *   npm run backfill:activity-accessibility            # schreibt
 *   npm run backfill:activity-accessibility -- --dry-run
 *
 * Liest in .range()-Seiten (PostgREST kappt jede Antwort bei 1000 Rows);
 * Updates einzeln per id (nur ~2 % der Zeilen aendern sich). supabase-js
 * wirft bei Schreibfehlern nicht — jede Antwort wird geprueft.
 */

import { createActivityStoreClient } from '@/lib/activities/activity-store';
import { buildDesklineAccessibility, suppressSharedTextEvidence } from '@/lib/activities/accessibility';
import { isDirectRun } from './lib/is-direct-run';

const PAGE = 1000;

interface Row {
  id: string;
  description: string | null;
  description_short: string | null;
  themes_raw: unknown;
  accessibility: unknown;
}

function themeNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => (t && typeof t === 'object' ? (t as { name?: unknown }).name : null))
    .filter((n): n is string => typeof n === 'string');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const supabase = createActivityStoreClient();

  // Alles lesen (11k Zeilen, ~12 Seiten) — der Bausteinvergleich braucht den
  // ganzen Bestand, nicht eine Seite.
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('poi_activities')
      .select('id, description, description_short, themes_raw, accessibility')
      .eq('source', 'deskline')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[backfill-accessibility] Lesen ab ${from} fehlgeschlagen: ${error.message}`);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const derivedRows = suppressSharedTextEvidence(
    rows.map((row) => ({
      row,
      description: row.description,
      description_short: row.description_short,
      accessibility: buildDesklineAccessibility(
        themeNames(row.themes_raw),
        [row.description ?? '', row.description_short ?? ''],
      ),
    })),
  );

  const scanned = rows.length;
  let changed = 0;
  let nowAccessible = 0;
  const failures: string[] = [];
  for (const { row, accessibility } of derivedRows) {
    if (accessibility) nowAccessible++;
    const before = JSON.stringify(row.accessibility ?? null);
    const after = JSON.stringify(accessibility);
    if (before === after) continue;
    changed++;
    if (dryRun) continue;
    const { error: updErr } = await supabase
      .from('poi_activities')
      .update({ accessibility })
      .eq('id', row.id);
    if (updErr) failures.push(`${row.id}: ${updErr.message}`);
  }

  console.log(
    `[backfill-accessibility] ${scanned} Deskline-Zeilen gelesen, ${nowAccessible} mit Befund, ` +
      `${changed} ${dryRun ? 'wuerden sich aendern (dry-run)' : 'geschrieben'}`,
  );
  if (failures.length > 0) {
    console.error(`[backfill-accessibility] ${failures.length} Fehler:\n${failures.slice(0, 20).join('\n')}`);
    process.exitCode = 1;
  }
}

if (isDirectRun(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
