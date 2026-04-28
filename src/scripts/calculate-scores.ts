/**
 * Event scoring script: calculates quality/relevance scores for future events.
 * Uses the scoring algorithm from src/lib/utils/scoring.ts.
 *
 * Run with: npm run score
 */

import { createClient } from '@supabase/supabase-js';
import {
  calculateScore,
  LOCAL_VENUE_TYPES,
  type ScoringEventRow,
  type ScoringVenueRow,
} from '../lib/utils/scoring';

// Re-export for backwards compatibility
export { calculateScore };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BATCH_SIZE = 1000;

async function fetchVenueMap(): Promise<Map<string, ScoringVenueRow>> {
  const venueMap = new Map<string, ScoringVenueRow>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('venues')
      .select('id, type, is_student_relevant, localness_score, registry_source')
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching venues:', error);
      // Non-fatal: continue scoring without venue bonuses
      break;
    }

    if (!data || data.length === 0) break;

    for (const venue of data as ScoringVenueRow[]) {
      venueMap.set(venue.id, venue);
    }

    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return venueMap;
}

async function main() {
  console.log('Starting event score calculation...');

  const today = new Date().toISOString().slice(0, 10);

  // Fetch venue data for bonus calculation
  console.log('Fetching venue registry...');
  const venueMap = await fetchVenueMap();
  console.log(`Loaded ${venueMap.size} venues for scoring bonuses.`);

  // Fetch all future events
  let allEvents: ScoringEventRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, image_url, ticket_url, price_min, price_text, tags, organizer, source_url, view_count, save_count, share_count, start_date, venue_id, event_series_id')
      .gte('start_date', today)
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching events:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    allEvents = allEvents.concat(data as ScoringEventRow[]);
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  console.log(`Fetched ${allEvents.length} future events. Calculating scores...`);

  // Track venue/series bonus stats
  let venueBoostCount = 0;
  let seriesBoostCount = 0;
  let studentBoostCount = 0;

  // Calculate scores
  const scored = allEvents.map(event => {
    const venue = event.venue_id ? venueMap.get(event.venue_id) ?? null : null;
    if (venue?.is_student_relevant) studentBoostCount++;
    if (venue && LOCAL_VENUE_TYPES.has(venue.type)) venueBoostCount++;
    if (event.event_series_id) seriesBoostCount++;

    return {
      id: event.id,
      title: event.title,
      event_score: calculateScore(event, venue),
      score_updated_at: new Date().toISOString(),
    };
  });

  // Bulk update via RPC — single UPDATE … FROM jsonb_to_recordset() per
  // batch instead of N individual UPDATE … WHERE id = ?.
  //
  // Old behaviour (pre-2026-04-28): Promise.all over 20 parallel updates
  // per chunk × N chunks per batch × M batches. Across runs this
  // accumulated to 2.27 million single-row UPDATEs visible in
  // pg_stat_statements (7.5 % of all DB time, second-biggest tax on the
  // free-tier Supabase compute behind WAL replication). It was also the
  // root cause of repeated connection-pool exhaustion: 20 concurrent
  // statements × multi-second tail → workers blocked on each other.
  //
  // New behaviour: chunk into batches of BATCH_SIZE rows, send each
  // batch as a single jsonb payload to bulk_update_event_scores. One
  // UPDATE statement, one parsed JSON, one round-trip, one row-level
  // write per event. ~50 RPC calls instead of ~73k single UPDATEs for
  // a typical full-DB rescore run.
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  let updated = 0;
  for (let i = 0; i < scored.length; i += BATCH_SIZE) {
    const batch = scored.slice(i, i + BATCH_SIZE);
    const payload = batch.map(row => ({
      id: row.id,
      event_score: row.event_score,
      score_updated_at: row.score_updated_at,
    }));

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.rpc('bulk_update_event_scores', {
        p_updates: payload,
      });
      if (!error) {
        // `data` is the affected-row count from the RPC; mismatch usually
        // means a concurrent delete killed an event mid-flight — log but
        // don't abort.
        const affected = typeof data === 'number' ? data : batch.length;
        if (affected !== batch.length) {
          console.warn(`\n  affected=${affected} but batch=${batch.length} — concurrent delete?`);
        }
        lastError = null;
        break;
      }
      lastError = error;
      const msg = error.message ?? String(error);
      const isTransient =
        msg.includes('502') || msg.includes('504') ||
        msg.includes('Bad gateway') || msg.includes('fetch failed') ||
        msg.includes('timeout') || msg.includes('ECONN');
      if (!isTransient || attempt >= 3) break;
      console.log(`\n  ${msg.slice(0, 60)} at batch ${i}, retrying in ${attempt * 15}s...`);
      await sleep(attempt * 15000);
    }

    if (lastError) {
      console.error(`Error updating batch starting at ${i}:`, lastError);
      process.exit(1);
    }

    updated += batch.length;
    process.stdout.write(`\rUpdated ${updated}/${scored.length} events...`);
    // Modest yield between batches so other Supabase traffic gets
    // breathing room. The single RPC call is much cheaper than the
    // old 20-parallel-UPDATE storm, so the previous 100ms-per-chunk
    // delay was over-protective; 25ms here is plenty.
    await sleep(25);
  }

  console.log(`\nScored ${scored.length} events.`);

  // Log venue/series bonus stats
  console.log('\nVenue/series bonus stats:');
  console.log(`  Student-relevant venue boost (+10): ${studentBoostCount} events`);
  console.log(`  Local venue type boost (+5):        ${venueBoostCount} events`);
  console.log(`  Recurring series boost (+5):        ${seriesBoostCount} events`);

  // Log top 10
  const top10 = scored
    .sort((a, b) => b.event_score - a.event_score)
    .slice(0, 10);

  console.log('\nTop 10 events by score:');
  top10.forEach((e, i) => {
    console.log(`  ${i + 1}. [${e.event_score.toFixed(1)}] ${e.title}`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
