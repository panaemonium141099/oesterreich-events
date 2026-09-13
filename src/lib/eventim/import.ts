import type { ScrapedEvent } from '@/types/events';
import { downloadEventimFeed } from './feed-client';
import { parseEventimFeed, type NotBookableStats } from './parse';

/**
 * Shared Eventim import logic, used by both the CLI script
 * (`src/scripts/import-eventim.ts`) and the daily cron route
 * (`src/app/api/cron/eventim/route.ts`). Keeping it here means there is one
 * implementation of the download → parse → upsert pipeline.
 */

/** Download the Eventim PFT feed and parse it into future, non-cancelled, AT/DE/CH ScrapedEvents.
 *  `notBookable` wird, wenn uebergeben, mit der Ursachen-Zaehlung der
 *  Events ohne Ticket-Link befuellt (Einnahme-relevant, siehe parse.ts). */
export async function fetchAndParseEventim(
  nowIso: string,
  notBookable?: NotBookableStats,
): Promise<ScrapedEvent[]> {
  const series = await downloadEventimFeed();
  return parseEventimFeed(series, nowIso, notBookable);
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
  const { syncEventsToSupabase, beginScrapeRun, finishScrapeRun } = await import('@/lib/db/supabase-sync');
  const BATCH = 500;
  let upserted = 0;
  let errors = 0;
  let filtered = 0;
  let batches = 0;
  let quarantined = 0;
  let rawWritten = 0;
  const startedMs = Date.now();
  // fn-25 B1: EIN Rohschicht-Lauf für den ganzen Import statt einem je Batch.
  const runId = await beginScrapeRun('Eventim');
  const errorMessages = new Set<string>();
  for (let i = 0; i < events.length; i += BATCH) {
    const r = await syncEventsToSupabase(events.slice(i, i + BATCH), { scrapeRunId: runId });
    upserted += r.upserted;
    errors += r.errors;
    filtered += r.filtered;
    quarantined += r.quarantined;
    rawWritten += r.rawWritten;
    for (const m of r.errorMessages) errorMessages.add(m);
    batches += 1;
    log(`batch ${batches}: +${r.upserted} (${r.errors} err, ${r.filtered} filtered, ${r.rawWritten} raw)`);
  }
  if (runId) {
    await finishScrapeRun(runId, startedMs, {
      items_found: events.length,
      raw_written: rawWritten,
      items_updated: upserted,
      needs_review_count: quarantined,
      batch_errors: errorMessages.size,
      status: errors === 0 ? 'success' : upserted > 0 ? 'partial' : 'error',
      error_message: errorMessages.size > 0 ? [...errorMessages].join(' | ').slice(0, 1000) : null,
    });
  }
  return { upserted, errors, filtered, batches };
}

/** Feed credentials present? The cron skips gracefully when they aren't configured. */
export function hasEventimCredentials(): boolean {
  return Boolean(process.env.EVENTIM_FEED_USER && process.env.EVENTIM_FEED_PASS);
}
