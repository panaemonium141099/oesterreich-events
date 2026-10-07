/**
 * Übernahme bei geänderter source_id: die alte Zeile wird umgeschlüsselt,
 * statt neben einer neuen stehen zu bleiben.
 *
 * Warum: Ändert ein Scraper seine ID-Bildung, legt der Upsert neue Zeilen
 * an. Die alten verschwinden nicht von selbst: der Rückzug
 * (src/lib/quality/withdrawal.ts) prüft nur Events mit eigener Detail-URL,
 * und der Dedup hält zwei IDs derselben Quelle mit abweichendem Titel
 * getrennt. Befund 2026-10-07 (gem2go Card-Layout): die alte ID hatte kein
 * Datum, Serientermine teilten sie, `source_url` war die Listenseite.
 *
 * Der Scraper meldet zur neuen ID die alte (`previous_source_id`). Eine
 * alte Zeile geht an den Termin, der am selben Wiener Kalendertag liegt;
 * Zeilen-ID und Slug bleiben so erhalten. Regeln im Detail:
 * `planSourceIdMigrations`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';
import { toViennaDate, viennaDayDiff, viennaToday } from '@/lib/utils/event-time';

export interface LegacyRow {
  id: string;
  source_name: string;
  source_id: string;
  start_date: string;
}

export interface SourceIdMove {
  id: string;
  source_name: string;
  from: string;
  to: string;
}

type MigrationInput = Pick<ScrapedEvent, 'source_name' | 'source_id' | 'previous_source_id' | 'start_date'>;

const key = (sourceName: string, sourceId: string) => `${sourceName}::${sourceId}`;
const viennaDay = (iso: string) => toViennaDate(new Date(iso));

const withPrevious = <T extends MigrationInput>(events: readonly T[]) =>
  events.filter((e) => e.previous_source_id && e.previous_source_id !== e.source_id);

/**
 * Rein: welche alte Zeile bekommt welche neue ID. `existingKeys` sind die
 * neuen IDs (`source_name::source_id`), die schon eine Zeile haben.
 *
 * Erst bekommt jede Zeile den Termin an ihrem Tag. Danach geht eine
 * künftige Zeile ohne solchen Termin an den nächstgelegenen freien Termin
 * derselben alten ID: der alte Parser las das Datum teils aus Kurztext oder
 * Titel (Trockenlauf 2026-10-07: 7 von 553 Zeilen), die Zeile bliebe sonst
 * mit falschem Datum neben dem richtigen Termin stehen. Vergangene Zeilen
 * bleiben, was sie sind.
 */
export function planSourceIdMigrations(
  events: readonly MigrationInput[],
  legacyRows: readonly LegacyRow[],
  existingKeys: ReadonlySet<string>,
  now: Date = new Date(),
): SourceIdMove[] {
  const byPrevious = new Map<string, MigrationInput[]>();
  for (const e of withPrevious(events)) {
    const k = key(e.source_name, e.previous_source_id!);
    byPrevious.set(k, [...(byPrevious.get(k) ?? []), e]);
  }
  const claimed = new Set(existingKeys);
  const moves: SourceIdMove[] = [];
  const free = (row: LegacyRow) =>
    (byPrevious.get(key(row.source_name, row.source_id)) ?? []).filter((e) => !claimed.has(key(e.source_name, e.source_id)));
  const take = (row: LegacyRow, target: MigrationInput) => {
    claimed.add(key(target.source_name, target.source_id));
    moves.push({ id: row.id, source_name: row.source_name, from: row.source_id, to: target.source_id });
  };

  const unmatched: LegacyRow[] = [];
  for (const row of legacyRows) {
    const day = viennaDay(row.start_date);
    const target = free(row).find((e) => viennaDay(e.start_date) === day);
    if (target) take(row, target);
    else unmatched.push(row);
  }

  const today = viennaToday(now);
  for (const row of unmatched) {
    const day = viennaDay(row.start_date);
    if (day < today) continue;
    const distance = (e: MigrationInput) => Math.abs(viennaDayDiff(day, viennaDay(e.start_date)));
    const target = free(row).sort((a, b) => distance(a) - distance(b) || a.start_date.localeCompare(b.start_date))[0];
    if (target) take(row, target);
  }
  return moves;
}

// .in() steht im Query-String: Listen klein halten (CLAUDE.md).
const CHUNK = 200;

async function loadRows(supabase: SupabaseClient, sourceName: string, ids: string[]): Promise<LegacyRow[]> {
  const rows: LegacyRow[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('events')
      .select('id, source_name, source_id, start_date')
      .eq('source_name', sourceName)
      .in('source_id', unique.slice(i, i + CHUNK));
    if (error) throw new Error(`source-id-migration: ${error.message}`);
    rows.push(...((data ?? []) as LegacyRow[]));
  }
  return rows;
}

/**
 * Schlüsselt alte Zeilen der übergebenen Events um. Muss vor dem Upsert
 * laufen, damit der Upsert die umgeschlüsselte Zeile aktualisiert.
 */
export async function migrateSourceIds(
  supabase: SupabaseClient,
  events: readonly ScrapedEvent[],
): Promise<{ moved: number; failed: number; errors: string[] }> {
  const result = { moved: 0, failed: 0, errors: [] as string[] };
  const candidates = withPrevious(events);
  for (const sourceName of new Set(candidates.map((e) => e.source_name))) {
    const own = candidates.filter((e) => e.source_name === sourceName);
    const legacy = await loadRows(supabase, sourceName, own.map((e) => e.previous_source_id!));
    if (legacy.length === 0) continue;
    const existing = await loadRows(supabase, sourceName, own.map((e) => e.source_id));
    const existingKeys = new Set(existing.map((r) => key(r.source_name, r.source_id)));
    for (const move of planSourceIdMigrations(own, legacy, existingKeys)) {
      // supabase-js wirft bei Schreibfehlern nicht: error selbst prüfen.
      const { error } = await supabase
        .from('events')
        .update({ source_id: move.to })
        .eq('id', move.id)
        .eq('source_name', move.source_name)
        .eq('source_id', move.from);
      if (error) {
        result.failed++;
        if (!result.errors.includes(error.message)) result.errors.push(error.message);
      } else {
        result.moved++;
      }
    }
  }
  return result;
}
