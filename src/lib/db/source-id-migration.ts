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
 * Der Scraper meldet zur neuen ID die alte (`previous_source_id`, auch
 * mehrere, wenn noch Zeilen mehrerer Fassungen stehen können). Eine
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
  publish_status?: string | null;
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

/** Frühere IDs eines Events (ohne die eigene). */
export function previousSourceIds(e: Pick<ScrapedEvent, 'source_id' | 'previous_source_id'>): string[] {
  const ids = Array.isArray(e.previous_source_id) ? e.previous_source_id : [e.previous_source_id];
  return [...new Set(ids)].filter((id): id is string => !!id && id !== e.source_id);
}

const withPrevious = <T extends MigrationInput>(events: readonly T[]) =>
  events.filter((e) => previousSourceIds(e).length > 0);

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
    for (const previous of previousSourceIds(e)) {
      const k = key(e.source_name, previous);
      byPrevious.set(k, [...(byPrevious.get(k) ?? []), e]);
    }
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

  // 0 Titel und Uhrzeit, 1 Titel, 2 Uhrzeit, 3 nur der Tag (stabil sortiert).
  const rank = (row: LegacyRow, e: MigrationInput) =>
    (sameTitle(row, e) ? 0 : 2) + (new Date(e.start_date).getTime() === new Date(row.start_date).getTime() ? 0 : 1);
  const bestSameDay = (row: LegacyRow) =>
    free(row)
      .filter((e) => viennaDay(e.start_date) === viennaDay(row.start_date))
      .sort((a, b) => rank(row, a) - rank(row, b))[0];

  // Erst die genauen Treffer: melden zwei Lesarten desselben Termins beide
  // alten IDs (withoutStartTime im Registry-Scraper), bleibt die Zeile der
  // aktuellen Lesart, die der anderen ist abgelöst (planSupersededRows).
  const rest: LegacyRow[] = [];
  for (const row of legacyRows) {
    const target = bestSameDay(row);
    if (target && rank(row, target) === 0) take(row, target);
    else rest.push(row);
  }
  const unmatched: LegacyRow[] = [];
  for (const row of rest) {
    const target = bestSameDay(row);
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

/**
 * Rein: alte Zeilen, die abgelöst sind. Ein Termin meldet die alte ID, hat
 * aber schon eine Zeile (oder bekam eine andere alte Zeile), am selben
 * Wiener Tag, auf derselben Website und mit demselben Titel: die alte Zeile
 * ist dann eine zweite Lesart desselben Termins. Ihre ID liefert die Quelle
 * nie wieder, ohne Rückzug bliebe sie bis zum Termin sichtbar (Prod
 * 2026-11-03: innsbrucktermine.at, 27 Seiten-Tage mit zwei Lesarten, der
 * Dedup ließ deshalb die Feratel-Zeile mit keiner zusammen).
 *
 * Nur künftige Zeilen; heutige und vergangene bleiben, wie bei der Übernahme.
 * `events` sind alle Termine des Laufs: eine Zeile, deren ID ein Termin
 * selbst trägt, ist nie abgelöst.
 */
export function planSupersededRows(
  events: readonly MigrationInput[],
  legacyRows: readonly LegacyRow[],
  moves: readonly SourceIdMove[],
  now: Date = new Date(),
): LegacyRow[] {
  const moved = new Set(moves.map((m) => m.id));
  const delivered = new Set(events.map((e) => key(e.source_name, e.source_id)));
  const today = viennaToday(now);
  return legacyRows.filter((row) => {
    const day = viennaDay(row.start_date);
    if (moved.has(row.id) || delivered.has(key(row.source_name, row.source_id)) || day <= today) return false;
    const rowSite = site(row.source_url);
    return withPrevious(events).some((e) =>
      e.source_name === row.source_name &&
      previousSourceIds(e).includes(row.source_id) &&
      viennaDay(e.start_date) === day &&
      sameTitle(row, e) &&
      (!rowSite || !site(e.source_url) || rowSite === site(e.source_url)));
  });
}

// .in() steht im Query-String: Listen klein halten (CLAUDE.md).
const CHUNK = 200;

async function loadRows(supabase: SupabaseClient, sourceName: string, ids: string[]): Promise<LegacyRow[]> {
  const rows: LegacyRow[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('events')
      .select('id, source_name, source_id, start_date, source_url, title, publish_status')
      .eq('source_name', sourceName)
      .in('source_id', unique.slice(i, i + CHUNK));
    if (error) throw new Error(`source-id-migration: ${error.message}`);
    rows.push(...((data ?? []) as LegacyRow[]));
  }
  return rows;
}

/** Zeilen, die Primary eines verborgenen Duplikats sind. */
async function primariesOfDuplicates(supabase: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('events')
      .select('duplicate_of')
      .eq('publish_status', 'duplicate')
      .in('duplicate_of', ids.slice(i, i + CHUNK));
    if (error) throw new Error(`source-id-migration: ${error.message}`);
    for (const r of (data ?? []) as Array<{ duplicate_of: string | null }>) if (r.duplicate_of) out.add(r.duplicate_of);
  }
  return out;
}

/**
 * Schlüsselt alte Zeilen der übergebenen Events um und zieht abgelöste
 * zurück (planSupersededRows), wie der Rückzug: `suppressed` + `withdrawn_at`.
 * Ein Primary mit verborgenem Duplikat bleibt stehen, sonst wäre das Event
 * bis zum nächsten Dedup ganz weg (withdrawal.ts). Muss vor dem Upsert
 * laufen, damit der Upsert die umgeschlüsselte Zeile aktualisiert.
 */
export async function migrateSourceIds(
  supabase: SupabaseClient,
  events: readonly ScrapedEvent[],
  now: Date = new Date(),
): Promise<{ moved: number; withdrawn: number; failed: number; errors: string[] }> {
  const result = { moved: 0, withdrawn: 0, failed: 0, errors: [] as string[] };
  const fail = (message: string) => {
    result.failed++;
    if (!result.errors.includes(message)) result.errors.push(message);
  };
  const candidates = withPrevious(events);
  for (const sourceName of new Set(candidates.map((e) => e.source_name))) {
    const own = candidates.filter((e) => e.source_name === sourceName);
    const legacy = await loadRows(supabase, sourceName, own.flatMap(previousSourceIds));
    if (legacy.length === 0) continue;
    const existing = await loadRows(supabase, sourceName, own.map((e) => e.source_id));
    const existingKeys = new Set(existing.map((r) => key(r.source_name, r.source_id)));
    const moves = planSourceIdMigrations(own, legacy, existingKeys, now);
    for (const move of moves) {
      // supabase-js wirft bei Schreibfehlern nicht: error selbst prüfen.
      const { error } = await supabase
        .from('events')
        .update({ source_id: move.to })
        .eq('id', move.id)
        .eq('source_name', move.source_name)
        .eq('source_id', move.from);
      if (error) fail(error.message);
      else result.moved++;
    }

    const all = events.filter((e) => e.source_name === sourceName);
    const superseded = planSupersededRows(all, legacy, moves, now).filter((r) => r.publish_status !== 'suppressed');
    if (superseded.length === 0) continue;
    const kept = await primariesOfDuplicates(supabase, superseded.map((r) => r.id));
    const ids = superseded.map((r) => r.id).filter((id) => !kept.has(id));
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('events')
        .update({ publish_status: 'suppressed', withdrawn_at: now.toISOString() })
        .eq('source_name', sourceName)
        .in('id', chunk);
      if (error) fail(error.message);
      else result.withdrawn += chunk.length;
    }
  }
  return result;
}
