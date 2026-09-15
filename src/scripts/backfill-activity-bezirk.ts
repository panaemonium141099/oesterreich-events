/**
 * Einmaliger Backfill von poi_activities.bezirk (Migration
 * 20260915120000_poi_activities_bezirk.sql).
 *
 * Rechnet den Bezirk fuer JEDE Gemeinde der Registry mit derselben
 * TS-Ableitung wie der Import (src/lib/activities/bezirk.ts) und schreibt
 * ihn per gemeinde_slug in den Bestand — ein UPDATE je Bezirk, die
 * Slug-Liste in .in()-Slices von <=200 (PostgREST traegt .in() im
 * Query-String; groessere Listen brechen mit "TypeError: fetch failed").
 * Gemeinden ohne ableitbaren Bezirk (Wien) bleiben NULL.
 *
 *   npm run backfill:activity-bezirk            # schreibt
 *   npm run backfill:activity-bezirk -- --dry-run
 *
 * Idempotent: jeder Lauf schreibt dieselben Werte (die Tabelle hat keinen
 * updated_at-Trigger, ein Wiederholen ist harmlos). Der Erfolg wird am
 * Ende per Zaehlung (visible AND bezirk IS NULL) ausgewiesen — supabase-js
 * wirft bei Schreibfehlern nicht, deshalb wird jede Antwort geprueft.
 */

import { createActivityStoreClient } from '@/lib/activities/activity-store';
import { activityBezirk } from '@/lib/activities/bezirk';
import { ALL_GEMEINDEN } from '@/lib/gemeinden/data';
import { bundeslandToId } from '@/lib/bundeslaender';
import { isDirectRun } from './lib/is-direct-run';

const IN_BATCH = 200;

/** gemeinde_slug -> Bezirk-Gruppen, deterministisch sortiert. */
export function buildBezirkSlugGroups(): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const g of ALL_GEMEINDEN) {
    const bezirk = activityBezirk(g, bundeslandToId(g.bundesland));
    if (!bezirk) continue;
    const list = groups.get(bezirk) ?? [];
    list.push(g.slug);
    groups.set(bezirk, list);
  }
  for (const list of groups.values()) list.sort();
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const groups = buildBezirkSlugGroups();
  const slugTotal = [...groups.values()].reduce((n, l) => n + l.length, 0);
  console.log(`[backfill-bezirk] ${groups.size} Bezirke, ${slugTotal} Gemeinde-Slugs${dryRun ? ' (dry-run)' : ''}`);

  const supabase = createActivityStoreClient();
  let requests = 0;

  for (const [bezirk, slugs] of groups) {
    for (let i = 0; i < slugs.length; i += IN_BATCH) {
      const slice = slugs.slice(i, i + IN_BATCH);
      if (dryRun) {
        requests++;
        continue;
      }
      const { error } = await supabase
        .from('poi_activities')
        .update({ bezirk })
        .in('gemeinde_slug', slice);
      requests++;
      if (error) {
        throw new Error(`[backfill-bezirk] UPDATE ${bezirk} (Slice ${i / IN_BATCH + 1}) fehlgeschlagen: ${error.message}`);
      }
    }
  }
  console.log(`[backfill-bezirk] ${requests} UPDATE-Requests${dryRun ? ' geplant' : ' ausgefuehrt'}`);

  if (dryRun) return;

  // Kontrolle: sichtbare Rows ohne Bezirk (erwartet: nur Wien, 1 POI).
  const { count, error } = await supabase
    .from('poi_activities')
    .select('id', { count: 'exact', head: true })
    .eq('visible', true)
    .is('bezirk', null);
  if (error) throw new Error(`[backfill-bezirk] Kontrollzaehlung fehlgeschlagen: ${error.message}`);
  console.log(`[backfill-bezirk] sichtbare POIs ohne Bezirk: ${count ?? '?'}`);
}

if (isDirectRun(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
