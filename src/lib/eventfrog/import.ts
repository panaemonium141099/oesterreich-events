import type { ScrapedEvent } from '@/types/events';
import { EventfrogClient } from './client';
import { parseEventfrogEvents, EVENTFROG_SOURCE_NAME, type ParseStats } from './parse';
import { RubricIndex } from './rubric-map';
import type { EventfrogLocation } from './types';

/**
 * Eventfrog-Import: Public API → ScrapedEvent → gemeinsamer Schreibpfad.
 * Jeder Lauf ist ein Vollabruf je Land (AT: ~8 Anfragen). Die Erkennung
 * von Dauerangeboten braucht ohnehin alle Termine einer Serie, und der
 * Rückzug (`withdrawal`) sieht über `last_seen_at`, was Eventfrog nicht
 * mehr listet.
 */

export interface CountryResult {
  country: string;
  events: ScrapedEvent[];
  stats: ParseStats;
}

export async function fetchAndParseEventfrog(
  client: EventfrogClient,
  countries: string[],
  fromIso: string,
  log: (msg: string) => void = () => {},
): Promise<CountryResult[]> {
  const rubrics = new RubricIndex(await client.fetchRubrics());
  const out: CountryResult[] = [];
  for (const country of countries) {
    const raw = await client.fetchEvents(country, fromIso);
    log(`${country}: ${raw.length} Events von der API`);
    const locs = await client.fetchLocations(raw.flatMap((e) => e.locationIds));
    const byId = new Map<string, EventfrogLocation>(locs.map((l) => [l.id, l]));
    log(`${country}: ${byId.size} Locations`);
    const { events, stats } = parseEventfrogEvents(raw, byId, rubrics, country);
    out.push({ country, events, stats });
  }
  log(`API-Anfragen in diesem Lauf: ${client.requests} (Limit 2.000/Tag je Konto)`);
  return out;
}

export interface EventfrogUpsertResult {
  upserted: number;
  errors: number;
  filtered: number;
  quarantined: number;
}

/**
 * Bilder spiegeln, dann in 500er-Batches über `syncEventsToSupabase`
 * schreiben (Dedup, Freigabevertrag, Ortsauflösung wie bei jeder Quelle).
 * Ohne Spiegelung wird nicht geschrieben: sonst stünden Hotlinks in der DB.
 */
export async function upsertEventfrogEvents(
  events: ScrapedEvent[],
  log: (msg: string) => void = () => {},
): Promise<EventfrogUpsertResult> {
  const { syncEventsToSupabase, beginScrapeRun, finishScrapeRun } = await import('@/lib/db/supabase-sync');
  const { createClient } = await import('@supabase/supabase-js');
  const { mirrorEventfrogImages } = await import('./images');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL (oder SUPABASE_URL) und SUPABASE_SERVICE_ROLE_KEY fehlen');
  const storage = createClient(url, key, { auth: { persistSession: false } });
  const mirror = await mirrorEventfrogImages(events, storage, log);
  for (const s of mirror.failedSamples) log(`  Bild fehlgeschlagen: ${s}`);

  const BATCH = 500;
  const result: EventfrogUpsertResult = { upserted: 0, errors: 0, filtered: 0, quarantined: 0 };
  let rawWritten = 0;
  const startedMs = Date.now();
  const runId = await beginScrapeRun(EVENTFROG_SOURCE_NAME);
  const errorMessages = new Set<string>();
  for (let i = 0; i < events.length; i += BATCH) {
    const r = await syncEventsToSupabase(events.slice(i, i + BATCH), { scrapeRunId: runId });
    result.upserted += r.upserted;
    result.errors += r.errors;
    result.filtered += r.filtered;
    result.quarantined += r.quarantined;
    rawWritten += r.rawWritten;
    for (const m of r.errorMessages) errorMessages.add(m);
    log(`Batch ${i / BATCH + 1}: +${r.upserted} (${r.errors} Fehler, ${r.filtered} gefiltert, ${r.quarantined} Prüfung)`);
  }
  if (runId) {
    await finishScrapeRun(runId, startedMs, {
      items_found: events.length,
      raw_written: rawWritten,
      items_updated: result.upserted,
      needs_review_count: result.quarantined,
      batch_errors: errorMessages.size,
      status: result.errors === 0 ? 'success' : result.upserted > 0 ? 'partial' : 'error',
      error_message: errorMessages.size > 0 ? [...errorMessages].join(' | ').slice(0, 1000) : null,
    });
  }
  return result;
}
