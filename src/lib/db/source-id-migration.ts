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
  source_url?: string | null;
  title?: string | null;
}

export interface SourceIdMove {
  id: string;
  source_name: string;
  from: string;
  to: string;
}

type MigrationInput = Pick<ScrapedEvent, 'source_name' | 'source_id' | 'previous_source_id' | 'start_date'> &
  Partial<Pick<ScrapedEvent, 'source_url' | 'title'>>;

const key = (sourceName: string, sourceId: string) => `${sourceName}::${sourceId}`;
const viennaDay = (iso: string) => toViennaDate(new Date(iso));
const normTitle = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
/** Beide Titel bekannt und gleich. */
const sameTitle = (row: LegacyRow, e: MigrationInput) => !!row.title && !!e.title && normTitle(row.title) === normTitle(e.title);
/** Kein Widerspruch im Titel (einer unbekannt oder beide gleich). */
const titleFits = (row: LegacyRow, e: MigrationInput) => !row.title || !e.title || sameTitle(row, e);

/** Host ohne www, sonst null (fehlende oder kaputte URL). */
function site(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

const withPrevious = <T extends MigrationInput>(events: readonly T[]) =>
  events.filter((e) => e.previous_source_id && e.previous_source_id !== e.source_id);

/**
 * Rein: welche alte Zeile bekommt welche neue ID. `existingKeys` sind die
 * neuen IDs (`source_name::source_id`), die schon eine Zeile haben.
 *
 * Erst bekommt jede Zeile den Termin an ihrem Tag, bei mehreren zuerst den
 * mit ihrem Titel, dann den mit ihrer Uhrzeit. Danach geht eine Zeile ab
 * morgen ohne solchen Termin an den nächstgelegenen freien Termin derselben
 * alten ID mit gleichem Titel: der alte Parser las das Datum teils aus
 * Kurztext oder Titel (Trockenlauf 2026-10-07: 7 von 553 Zeilen), die Zeile
 * bliebe sonst mit falschem Datum neben dem richtigen Termin stehen.
 * Vergangene und heutige Zeilen bleiben, was sie sind: fehlt der heutige
 * Termin, hat er meist schon begonnen.
 *
 * Eine Zeile wechselt nie die Website und auf einen anderen Tag nie den
 * Titel: gekürzte gemeinde-registry-IDs teilten sich Gemeinden (Prod
 * 2026-10-11: 538 von 13.099 alten IDs unter mehreren Websites) und
 * verschiedene Events einer Seite mit gleichem Anfang („Pensionistenverband
 * - …"). Die Zeile gehört dem Termin, auf dem sie steht.
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
  const free = (row: LegacyRow) => {
    const rowSite = site(row.source_url);
    return (byPrevious.get(key(row.source_name, row.source_id)) ?? []).filter((e) => {
      if (claimed.has(key(e.source_name, e.source_id))) return false;
      const eventSite = site(e.source_url);
      return !rowSite || !eventSite || rowSite === eventSite;
    });
  };
  const take = (row: LegacyRow, target: MigrationInput) => {
    claimed.add(key(target.source_name, target.source_id));
    moves.push({ id: row.id, source_name: row.source_name, from: row.source_id, to: target.source_id });
  };

  const unmatched: LegacyRow[] = [];
  for (const row of legacyRows) {
    const day = viennaDay(row.start_date);
    const at = new Date(row.start_date).getTime();
    // 0 Titel und Uhrzeit, 1 Titel, 2 Uhrzeit, 3 nur der Tag (stabil sortiert).
    const rank = (e: MigrationInput) => (sameTitle(row, e) ? 0 : 2) + (new Date(e.start_date).getTime() === at ? 0 : 1);
    const target = free(row)
      .filter((e) => viennaDay(e.start_date) === day)
      .sort((a, b) => rank(a) - rank(b))[0];
    if (target) take(row, target);
    else unmatched.push(row);
  }

  const today = viennaToday(now);
  for (const row of unmatched) {
    const day = viennaDay(row.start_date);
    if (day <= today) continue;
    const distance = (e: MigrationInput) => Math.abs(viennaDayDiff(day, viennaDay(e.start_date)));
    const target = free(row)
      .filter((e) => titleFits(row, e))
      .sort((a, b) => distance(a) - distance(b) || a.start_date.localeCompare(b.start_date))[0];
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
      .select('id, source_name, source_id, start_date, source_url, title')
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
