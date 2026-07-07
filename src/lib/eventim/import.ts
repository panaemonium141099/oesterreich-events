import type { ScrapedEvent } from '@/types/events';
import { downloadEventimFeed } from './feed-client';
import { parseEventimFeed } from './parse';

/**
 * Shared Eventim import logic, used by both the CLI script
 * (`src/scripts/import-eventim.ts`) and the daily cron route
 * (`src/app/api/cron/eventim/route.ts`). Keeping it here means there is one
 * implementation of the download → parse → upsert pipeline.
 */

/** Download the Eventim PFT feed and parse it into future, non-cancelled, AT/DE/CH ScrapedEvents. */
export async function fetchAndParseEventim(nowIso: string): Promise<ScrapedEvent[]> {
  const series = await downloadEventimFeed();
  return parseEventimFeed(series, nowIso);
}

export interface EventimUpsertResult {
  upserted: number;
  errors: number;
  filtered: number;
  batches: number;
}

/**
 * Upsert parsed Eventim events through the shared write-path
 * (`syncEventsToSupabase` — dedup, scoring, validation, bundesland) in batches.
 * Imported lazily so the feed/parse path stays usable without DB env.
 */
export async function upsertEventimEvents(
  events: ScrapedEvent[],
  log: (msg: string) => void = () => {},
): Promise<EventimUpsertResult> {
  const { syncEventsToSupabase } = await import('@/lib/db/supabase-sync');
  const BATCH = 500;
  let upserted = 0;
  let errors = 0;
  let filtered = 0;
  let batches = 0;
  for (let i = 0; i < events.length; i += BATCH) {
    const r = await syncEventsToSupabase(events.slice(i, i + BATCH));
    upserted += r.upserted;
    errors += r.errors;
    filtered += r.filtered;
    batches += 1;
    log(`batch ${batches}: +${r.upserted} (${r.errors} err, ${r.filtered} filtered)`);
  }
  return { upserted, errors, filtered, batches };
}

/** Feed credentials present? The cron skips gracefully when they aren't configured. */
export function hasEventimCredentials(): boolean {
  return Boolean(process.env.EVENTIM_FEED_USER && process.env.EVENTIM_FEED_PASS);
}
