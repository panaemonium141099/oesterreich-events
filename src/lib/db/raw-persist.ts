/**
 * Rohdatensicherung im echten Importpfad (fn-25, Phase B1).
 *
 * Vor jeder Normalisierung wird der ScrapedEvent so gespeichert, wie der
 * Adapter ihn geliefert hat: `scrape_runs` (ein Lauf je Sync-Aufruf oder je
 * übergebener Lauf-ID) und `raw_events` (eine Zeile je Event UND Inhalt).
 * `events.raw_event_id` zeigt danach auf genau den Quellenstand, aus dem die
 * aktuelle Ortsentscheidung entstanden ist.
 *
 * Wachstum bleibt klein, weil unveränderte Events keine neue Zeile erzeugen:
 * der `content_hash` deckt Titel, Zeiten, alle Ortsfelder, Koordinaten,
 * Venue-Kennung, Preise, Links und den Beschreibungsanfang ab. Erst eine
 * Änderung dieser Felder legt einen neuen Quellenstand an; der alte bleibt
 * als Historie erhalten.
 *
 * Fehlerpolitik (Review §8 B): Scheitert die Rohsicherung, wird der
 * Kandidat trotzdem geschrieben, aber nicht veröffentlicht
 * (`needs_review`, Grund `raw_persist_failed`) — eine Ortsentscheidung
 * ohne erhaltenen Quellenstand ist nicht reproduzierbar.
 */
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';

export const RAW_PARSER_VERSION = `sync-v1@${(process.env.GITHUB_SHA ?? process.env.APP_COMMIT ?? 'local').slice(0, 12)}`;

/** Felder, deren Änderung einen neuen Quellenstand bedeutet. */
export function rawContentHash(event: ScrapedEvent): string {
  const payload = JSON.stringify({
    title: event.title ?? null,
    start: event.start_date ?? null,
    end: event.end_date ?? null,
    location_name: event.location_name ?? null,
    address: event.address ?? null,
    postal_code: event.postal_code ?? null,
    city: event.city ?? null,
    district: event.district ?? null,
    bundesland: event.bundesland ?? null,
    country: event.country ?? null,
    lat: event.latitude ?? null,
    lng: event.longitude ?? null,
    coords_precision: event.coords_precision ?? null,
    source_venue_id: event.source_venue_id ?? null,
    source_url: event.source_url ?? null,
    ticket_url: event.ticket_url ?? null,
    image_url: event.image_url ?? null,
    price_text: event.price_text ?? null,
    price_min: event.price_min ?? null,
    price_max: event.price_max ?? null,
    organizer: event.organizer ?? null,
    description: event.description?.slice(0, 500) ?? null,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export async function openScrapeRun(supabase: SupabaseClient, sourceName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_runs')
    .insert({ source_name: sourceName, status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[raw-persist] scrape_runs insert fehlgeschlagen:', error?.message);
    return null;
  }
  return data.id as string;
}

export interface ScrapeRunStats {
  items_found: number;
  raw_written: number;
  items_updated: number;
  needs_review_count: number;
  batch_errors: number;
  status: 'success' | 'error' | 'partial';
  error_message?: string | null;
}

export async function closeScrapeRun(
  supabase: SupabaseClient,
  runId: string,
  startedMs: number,
  stats: ScrapeRunStats,
): Promise<void> {
  const { error } = await supabase
    .from('scrape_runs')
    .update({
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedMs,
      items_found: stats.items_found,
      items_parsed: stats.items_found,
      raw_written: stats.raw_written,
      items_updated: stats.items_updated,
      needs_review_count: stats.needs_review_count,
      batch_errors: stats.batch_errors,
      status: stats.status,
      error_message: stats.error_message ?? null,
    })
    .eq('id', runId);
  if (error) console.error('[raw-persist] scrape_runs update fehlgeschlagen:', error.message);
}

export interface RawPersistResult {
  /** `source_name::source_id` → raw_events.id */
  ids: Map<string, string>;
  /** Anzahl neu geschriebener Rohzeilen (unveränderte Events zählen nicht). */
  written: number;
  /** Schlüssel, für die keine Rohzeile gesichert werden konnte. */
  failed: Set<string>;
}

const CHUNK = 200;

/**
 * Sichert die Rohzeilen eines Batches. Vorhandene Zeilen mit identischem
 * Inhalt (gleicher Hash) werden wiederverwendet.
 */
export async function persistRawEvents(
  supabase: SupabaseClient,
  runId: string,
  events: ScrapedEvent[],
): Promise<RawPersistResult> {
  const ids = new Map<string, string>();
  const failed = new Set<string>();
  let written = 0;
  if (events.length === 0) return { ids, written, failed };

  const keyOf = (e: ScrapedEvent) => `${e.source_name}::${e.source_id}`;
  const hashes = new Map<string, string>();
  for (const e of events) hashes.set(keyOf(e), rawContentHash(e));

  // 1. Bestehende Quellenstände mit gleichem Hash wiederverwenden.
  const sourceNames = [...new Set(events.map(e => e.source_name))];
  const sourceIds = [...new Set(events.map(e => e.source_id))];
  for (let i = 0; i < sourceIds.length; i += CHUNK) {
    const slice = sourceIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('raw_events')
      .select('id, source_name, source_event_id, content_hash')
      .in('source_name', sourceNames)
      .in('source_event_id', slice);
    if (error) {
      console.error('[raw-persist] Prefetch fehlgeschlagen:', error.message);
      continue;
    }
    for (const r of data ?? []) {
      const key = `${r.source_name}::${r.source_event_id}`;
      if (hashes.get(key) === r.content_hash && !ids.has(key)) ids.set(key, r.id as string);
    }
  }

  // 2. Neue Quellenstände schreiben.
  const pending = events.filter(e => !ids.has(keyOf(e)));
  for (let i = 0; i < pending.length; i += 500) {
    const slice = pending.slice(i, i + 500);
    const rows = slice.map(e => ({
      scrape_run_id: runId,
      source_name: e.source_name,
      source_event_id: e.source_id,
      source_url: e.source_url ?? null,
      raw_title: e.title ?? null,
      raw_description: e.description ?? null,
      raw_start_text: e.start_date ?? null,
      raw_end_text: e.end_date ?? null,
      raw_location_name: e.location_name ?? null,
      raw_address: e.address ?? null,
      raw_image_url: e.image_url ?? null,
      raw_ticket_url: e.ticket_url ?? null,
      raw_payload_json: e as unknown as Record<string, unknown>,
      content_hash: hashes.get(keyOf(e))!,
      parser_version: RAW_PARSER_VERSION,
      fetched_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase
      .from('raw_events')
      .insert(rows)
      .select('id, source_name, source_event_id');
    if (error) {
      console.error('[raw-persist] Insert fehlgeschlagen:', error.message);
      for (const e of slice) failed.add(keyOf(e));
      continue;
    }
    for (const r of data ?? []) {
      ids.set(`${r.source_name}::${r.source_event_id}`, r.id as string);
      written++;
    }
    for (const e of slice) if (!ids.has(keyOf(e))) failed.add(keyOf(e));
  }

  return { ids, written, failed };
}
