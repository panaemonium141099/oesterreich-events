/**
 * Raw Layer — ingests ScrapedEvent[] into scrape_runs + raw_events tables.
 */

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';
import type { ScrapeRunRow, RawEventRow } from './types';

// ---------------------------------------------------------------------------
// Supabase admin client (service-role)
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// Content hash
// ---------------------------------------------------------------------------

/**
 * Deterministic SHA-256 hash of the event's core identity fields.
 * Used for change-detection between scrape runs.
 */
export function computeContentHash(event: ScrapedEvent): string {
  const payload = JSON.stringify({
    title: event.title,
    start_date: event.start_date,
    location_name: event.location_name,
    description: event.description?.slice(0, 500),
  });
  return createHash('sha256').update(payload).digest('hex');
}

// ---------------------------------------------------------------------------
// Scrape runs
// ---------------------------------------------------------------------------

/**
 * Opens a new scrape run with status='running'.
 * Returns the auto-generated UUID.
 */
export async function createScrapeRun(sourceName: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('scrape_runs')
    .insert({
      source_name: sourceName,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create scrape run for ${sourceName}: ${error?.message ?? 'no data returned'}`,
    );
  }

  return data.id as string;
}

/**
 * Finalises a scrape run with the given metrics and status.
 */
export async function finalizeScrapeRun(
  runId: string,
  updates: Partial<ScrapeRunRow> & { status: string },
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('scrape_runs')
    .update({
      ...updates,
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) {
    throw new Error(
      `Failed to finalise scrape run ${runId}: ${error.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Raw events
// ---------------------------------------------------------------------------

/**
 * Maps ScrapedEvent[] to raw_events columns and upserts them.
 * On conflict (source_name, source_event_id, scrape_run_id) the row is updated.
 * Returns the written rows.
 */
export async function writeRawEvents(
  runId: string,
  events: ScrapedEvent[],
): Promise<RawEventRow[]> {
  if (events.length === 0) return [];

  const supabase = getSupabaseAdmin();

  const rows = events.map((e) => ({
    scrape_run_id: runId,
    source_name: e.source_name,
    source_event_id: e.source_id || null,
    source_url: e.source_url || null,
    raw_title: e.title || null,
    raw_description: e.description || null,
    raw_start_text: e.start_date || null,
    raw_end_text: e.end_date || null,
    raw_location_name: e.location_name || null,
    raw_address: e.address || null,
    raw_image_url: e.image_url || null,
    raw_ticket_url: e.ticket_url || null,
    raw_payload_json: e as unknown as Record<string, unknown>,
    content_hash: computeContentHash(e),
  }));

  const { data, error } = await supabase
    .from('raw_events')
    .upsert(rows, {
      onConflict: 'source_name,source_event_id,scrape_run_id',
    })
    .select();

  if (error) {
    throw new Error(`Failed to write raw events: ${error.message}`);
  }

  return (data ?? []) as RawEventRow[];
}
