import type { ScrapedEvent } from '@/types/events';
import { downloadEventimFeed } from './feed-client';
import { parseEventimFeed, type NotBookableStats } from './parse';
import type { EventimSeries } from './types';

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
  console.log(feedFieldReport(series));
  return parseEventimFeed(series, nowIso, notBookable);
}

/**
 * Feldbericht des Rohfeeds (fn-25): welche Felder liefert der Feed je
 * Event, wie oft, und welche kennt unser Typ nicht? Dazu ein Beispiel-Event
 * mit Platzhalter-Koordinate (Stadtmittelpunkt für viele Spielstätten) und
 * die meistgeteilten Koordinaten. Reine Log-Ausgabe, damit der Import-Lauf
 * belegt, was der Feed tatsächlich enthält (Typen sind nur ein Snapshot).
 */
export function feedFieldReport(series: EventimSeries[]): string {
  const known = new Set(['eventId', 'eventName', 'eventDateIso8601', 'eventStatus', 'eventType', 'deliverable', 'eventCity', 'eventCountry', 'eventZip', 'eventStreet', 'eventVenue', 'eventVenueId', 'venueLatitude', 'venueLongitude', 'minPrice', 'maxPrice', 'evoLink', 'priceCategories']);
  const counts = new Map<string, number>();
  const shared = new Map<string, Set<string>>();
  let events = 0;
  let sample: Record<string, unknown> | null = null;
  for (const s of series) {
    for (const e of s.events ?? []) {
      events++;
      for (const k of Object.keys(e)) counts.set(k, (counts.get(k) ?? 0) + 1);
      if (e.eventCountry !== 'AT' || !e.venueLatitude || !e.venueLongitude) continue;
      const key = `${e.venueLatitude.toFixed(5)},${e.venueLongitude.toFixed(5)}`;
      const set = shared.get(key) ?? new Set<string>();
      set.add(e.eventVenueId);
      shared.set(key, set);
      if (!sample && Math.abs(e.venueLatitude - 48.209) < 0.0005 && Math.abs(e.venueLongitude - 16.37) < 0.0005) {
        sample = { ...(e as unknown as Record<string, unknown>) };
        delete sample.priceCategories;
      }
    }
  }
  const fields = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}${known.has(k) ? '' : ' (NEU)'}:${n}`).join(' ');
  const top = [...shared.entries()].filter(([, v]) => v.size >= 3).sort((a, b) => b[1].size - a[1].size).slice(0, 6).map(([k, v]) => `${k}=${v.size} Spielstätten`).join('; ');
  return `[eventim] Feldbericht: ${series.length} Serien, ${events} Events; Felder je Event: ${fields}; geteilte AT-Koordinaten: ${top || 'keine'}; Beispiel Platzhalter: ${sample ? JSON.stringify(sample) : 'keins'}`;
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
