import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';
import type { EventimArtist } from '@/lib/eventim/types';
import type { EventimArtistsByEvent } from '@/lib/eventim/parse';
import { fetchAllRows } from './fetch-all';

/**
 * Künstler je Event (fn-30, Startseite als Tagesausgabe).
 *
 * Der Eventim-Import ruft diesen Schritt NACH dem Event-Upsert auf: Er löst
 * die Event-IDs der importierten Zeilen auf, schreibt die Serien-Künstler des
 * Feeds nach `event_artists` und löscht je importiertem Event die Zeilen, die
 * der Feed nicht mehr nennt. Events werden nie gelöscht, der FK-Cascade der
 * Tabelle greift deshalb praktisch nie; der Abgleich hier ersetzt ihn.
 *
 * Regeln (CLAUDE.md): `.in()` steht im Query-String, Listen höchstens 200
 * Elemente; Schreib-Batches höchstens 500 Zeilen; ein Upsert darf dieselbe
 * (event_id, artist_id) nicht zweimal im selben Batch führen („cannot affect
 * row a second time“). Mehr als 1000 Zeilen nur über fetchAllRows.
 */

/** Ergebnis des Künstler-Schritts, für Log und Bericht. */
export interface EventArtistsSyncResult {
  /** Importierte Events, für die der Feed Künstler nennt. */
  eventsWithArtists: number;
  /** Importierte Events, die in der Datenbank gefunden wurden. */
  resolved: number;
  /** Importierte Events ohne Zeile in der Datenbank (verworfen oder in Quarantäne). */
  unresolved: number;
  /** Geschriebene Zeilen (Upsert). */
  written: number;
  /** Gelöschte Zeilen (vom Feed nicht mehr genannt). */
  deleted: number;
  /** Zahl der Upsert-Batches. */
  batches: number;
}

export interface EventArtistsSyncOptions {
  sourceName?: string;
  /** Wert der Spalte `source` (Standard 'eventim'). */
  source?: string;
  /** Für deterministische Tests. */
  now?: () => string;
  log?: (msg: string) => void;
}

// .in() steht im Query-String: Listen klein halten (CLAUDE.md).
const CHUNK = 200;
const BATCH = 500;

interface EventIdRow { id: string; source_id: string }
interface ArtistKeyRow { event_id: string; artist_id: string }

export interface EventArtistRow {
  event_id: string;
  artist_id: string;
  artist_name: string;
  artist_image: string | null;
  evo_link: string | null;
  source: string;
  updated_at: string;
}

/** Zeilen je Chunk nach (event_id, artist_id) entdoppeln. */
export function dedupeArtistRows<T extends ArtistKeyRow>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const key = `${r.event_id}\u0000${r.artist_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Sollzustand je Event in Zeilen der Tabelle. */
export function toEventArtistRows(
  eventId: string,
  artists: readonly EventimArtist[],
  source: string,
  updatedAt: string,
): EventArtistRow[] {
  return artists.map((a) => ({
    event_id: eventId,
    artist_id: a.artistId,
    artist_name: a.artistName,
    artist_image: a.artistImage ?? null,
    evo_link: a.evoLink ?? null,
    source,
    updated_at: updatedAt,
  }));
}

async function resolveEventIds(
  supabase: SupabaseClient,
  sourceName: string,
  sourceIds: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(sourceIds)];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('events')
      .select('id, source_id')
      .eq('source_name', sourceName)
      .in('source_id', unique.slice(i, i + CHUNK));
    if (error) throw new Error(`event_artists: Event-IDs auflösen: ${error.message}`);
    for (const r of (data ?? []) as EventIdRow[]) out.set(r.source_id, r.id);
  }
  return out;
}

async function loadExistingRows(
  supabase: SupabaseClient,
  eventIds: readonly string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (let i = 0; i < eventIds.length; i += CHUNK) {
    const chunk = eventIds.slice(i, i + CHUNK);
    const rows = await fetchAllRows<ArtistKeyRow>(
      (from, to) => supabase
        .from('event_artists')
        .select('event_id, artist_id')
        .in('event_id', chunk)
        .order('event_id')
        .order('artist_id')
        .range(from, to),
      { label: 'event_artists: Bestand lesen' },
    );
    for (const r of rows) {
      const set = out.get(r.event_id) ?? new Set<string>();
      set.add(r.artist_id);
      out.set(r.event_id, set);
    }
  }
  return out;
}

/**
 * Ersetzt je importiertem Event die Künstler-Zeilen durch die des Feeds.
 * Wirft bei Datenbankfehlern; der Aufrufer meldet den Schritt rot, der
 * Event-Upsert davor bleibt gültig.
 */
export async function syncEventArtists(
  supabase: SupabaseClient,
  events: readonly ScrapedEvent[],
  artists: EventimArtistsByEvent,
  opts: EventArtistsSyncOptions = {},
): Promise<EventArtistsSyncResult> {
  const sourceName = opts.sourceName ?? 'Eventim';
  const source = opts.source ?? 'eventim';
  const log = opts.log ?? (() => {});
  const updatedAt = (opts.now ?? (() => new Date().toISOString()))();

  const sourceIds = [...new Set(events.filter((e) => e.source_name === sourceName).map((e) => e.source_id))];
  const result: EventArtistsSyncResult = {
    eventsWithArtists: sourceIds.filter((id) => (artists.get(id)?.length ?? 0) > 0).length,
    resolved: 0,
    unresolved: 0,
    written: 0,
    deleted: 0,
    batches: 0,
  };
  if (sourceIds.length === 0) return result;

  const idBySource = await resolveEventIds(supabase, sourceName, sourceIds);
  result.resolved = idBySource.size;
  result.unresolved = sourceIds.length - idBySource.size;

  // Sollzustand: je aufgelöstem Event die Künstler des Feeds.
  const desired = new Map<string, EventimArtist[]>();
  for (const sourceId of sourceIds) {
    const eventId = idBySource.get(sourceId);
    if (!eventId) continue;
    desired.set(eventId, artists.get(sourceId) ?? []);
  }
  const eventIds = [...desired.keys()];

  const existing = await loadExistingRows(supabase, eventIds);

  // Schreiben: alle gewünschten Zeilen (Name, Bild, Link können sich ändern).
  const rows = dedupeArtistRows(
    eventIds.flatMap((eventId) => toEventArtistRows(eventId, desired.get(eventId) ?? [], source, updatedAt)),
  );
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('event_artists')
      .upsert(batch, { onConflict: 'event_id,artist_id' });
    if (error) throw new Error(`event_artists: Upsert Batch ${result.batches + 1}: ${error.message}`);
    result.written += batch.length;
    result.batches += 1;
  }

  // Löschen: Zeilen importierter Events, die der Feed nicht mehr nennt.
  for (const [eventId, have] of existing) {
    const want = new Set((desired.get(eventId) ?? []).map((a) => a.artistId));
    const stale = [...have].filter((id) => !want.has(id));
    if (stale.length === 0) continue;
    for (let i = 0; i < stale.length; i += CHUNK) {
      const chunk = stale.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('event_artists')
        .delete()
        .eq('event_id', eventId)
        .in('artist_id', chunk);
      if (error) throw new Error(`event_artists: Löschen für Event ${eventId}: ${error.message}`);
      result.deleted += chunk.length;
    }
  }

  log(`Künstler: ${result.eventsWithArtists} Events mit Künstlern, ${result.resolved} Events aufgelöst (${result.unresolved} nicht in der DB), ${result.written} Zeilen geschrieben in ${result.batches} Batches, ${result.deleted} gelöscht`);
  return result;
}
