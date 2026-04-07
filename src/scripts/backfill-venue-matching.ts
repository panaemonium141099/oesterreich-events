/**
 * Backfill: Match events to venues using the 3-stage venue matcher.
 *
 * Uses the pipeline's matchVenue() (alias + fuzzy + geo) instead of
 * the older backfill-venue-ids.ts approach. Produces detailed per-stage
 * and per-source metrics.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-venue-matching.ts --dry-run
 *   npx tsx src/scripts/backfill-venue-matching.ts
 *   npx tsx src/scripts/backfill-venue-matching.ts --limit=5000
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  loadVenueCache,
  matchVenue,
  type VenueMatchResult,
} from '../lib/pipeline/venue-matcher';
import { isVenueName } from '../lib/location-normalizer';

// ─── ENV LOADING ────────────────────────────────────────────────────────────
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  /* ignore missing .env.local */
}

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface EventRow {
  id: string;
  title: string;
  location_name: string | null;
  address: string | null;
  city?: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  source_url: string | null;
  ticket_url: string | null;
  source_name: string | null;
}

interface SourceStats {
  matched: number;
  total: number;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const FETCH_BATCH_SIZE = 1000;
const UPDATE_BATCH_SIZE = 200;

// ─── HELPERS ────────────────────────────────────────────────────────────────

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    );
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchUnmatchedEvents(
  supabase: SupabaseClient,
  limit?: number,
): Promise<EventRow[]> {
  const events: EventRow[] = [];
  let from = 0;

  while (true) {
    const remaining = limit ? limit - events.length : FETCH_BATCH_SIZE;
    if (limit && remaining <= 0) break;

    const batchSize = Math.min(FETCH_BATCH_SIZE, remaining);
    const { data, error } = await supabase
      .from('events')
      .select(
        'id, title, location_name, address, postal_code, latitude, longitude, source_url, ticket_url, source_name',
      )
      .is('venue_id', null)
      .range(from, from + batchSize - 1);

    if (error) throw new Error(`Failed to fetch events: ${error.message}`);
    if (!data || data.length === 0) break;

    events.push(...(data as EventRow[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return events;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

  if (dryRun) console.log('DRY RUN: No data will be written to Supabase\n');

  const supabase = getSupabase();

  // 1. Pre-load venue cache (venues + aliases)
  console.log('Loading venue cache...');
  await loadVenueCache();

  // 2. Fetch events without venue_id
  console.log('Fetching unmatched events...');
  const events = await fetchUnmatchedEvents(supabase, limit);
  console.log(`Loaded ${events.length} events without venue_id\n`);

  if (events.length === 0) {
    console.log('No unmatched events found.');
    return;
  }

  // 3. Match events in batches
  let stage1Matches = 0;
  let stage2Matches = 0;
  let stage3Uncertain = 0;
  let unmatched = 0;
  let venueGeoMismatch = 0;

  const perSource = new Map<string, SourceStats>();
  const venueMatchCounts = new Map<string, { name: string; count: number }>();
  const unmatchedLocations = new Map<string, number>();

  interface MatchedEvent {
    eventId: string;
    venueId: string;
    confidence: number;
    stage: number;
  }

  const matchedEvents: MatchedEvent[] = [];

  const startTime = Date.now();

  for (let batchStart = 0; batchStart < events.length; batchStart += FETCH_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + FETCH_BATCH_SIZE, events.length);
    const batch = events.slice(batchStart, batchEnd);

    for (const event of batch) {
      const result: VenueMatchResult = await matchVenue({
        location_name: event.location_name,
        address: event.address,
        city: event.city ?? null,
        postal_code: event.postal_code,
        latitude: event.latitude,
        longitude: event.longitude,
        source_url: event.source_url,
        ticket_url: event.ticket_url,
      });

      // Track per-source stats
      const source = event.source_name || '__unknown__';
      const stats = perSource.get(source) ?? { matched: 0, total: 0 };
      stats.total++;

      if (result.venueId && result.stage !== null) {
        stats.matched++;

        // Track stage distribution
        if (result.stage === 1) stage1Matches++;
        else if (result.stage === 2) stage2Matches++;

        // Check geo mismatch: event has coords far from venue match
        // (confidence was penalized by applyGeoAdjustment but still passed)
        if (result.confidence < 0.8 && result.stage === 2) {
          venueGeoMismatch++;
        }

        // Track per-venue match counts
        const vc = venueMatchCounts.get(result.venueId) ?? {
          name: result.venueId,
          count: 0,
        };
        vc.count++;
        venueMatchCounts.set(result.venueId, vc);

        matchedEvents.push({
          eventId: event.id,
          venueId: result.venueId,
          confidence: result.confidence,
          stage: result.stage,
        });
      } else if (result.confidence > 0 && result.confidence < 0.7) {
        stage3Uncertain++;
      } else {
        unmatched++;

        // Track unmatched location names
        if (event.location_name) {
          const loc = event.location_name.trim();
          unmatchedLocations.set(loc, (unmatchedLocations.get(loc) ?? 0) + 1);
        }
      }

      perSource.set(source, stats);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `  Processed ${batchEnd}/${events.length} events ` +
        `(${matchedEvents.length} matched, ${elapsed}s)`,
    );
  }

  // ─── METRICS ────────────────────────────────────────────────────────────

  const totalProcessed = events.length;
  const totalMatched = stage1Matches + stage2Matches;

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  VENUE MATCHING BACKFILL RESULTS');
  console.log('════════════════════════════════════════════════════════\n');
  console.log(`Total events processed:  ${totalProcessed}`);
  console.log(`Stage 1 (hard match):    ${stage1Matches} (${pct(stage1Matches, totalProcessed)})`);
  console.log(`Stage 2 (soft match):    ${stage2Matches} (${pct(stage2Matches, totalProcessed)})`);
  console.log(`Stage 3 (uncertain):     ${stage3Uncertain} (${pct(stage3Uncertain, totalProcessed)})`);
  console.log(`Unmatched:               ${unmatched} (${pct(unmatched, totalProcessed)})`);
  console.log(`Venue geo mismatch:      ${venueGeoMismatch}`);
  console.log(`Total matched:           ${totalMatched} (${pct(totalMatched, totalProcessed)})`);

  // Per-source match rates
  const sourceEntries = [...perSource.entries()]
    .filter(([, s]) => s.total >= 5) // only sources with enough events
    .map(([name, s]) => ({
      name,
      rate: s.matched / s.total,
      matched: s.matched,
      total: s.total,
    }))
    .sort((a, b) => b.rate - a.rate);

  if (sourceEntries.length > 0) {
    console.log('\n── Match rate per source (top 20 best) ──');
    for (const s of sourceEntries.slice(0, 20)) {
      console.log(
        `  ${s.name.padEnd(40)} ${(s.rate * 100).toFixed(1).padStart(5)}%  (${s.matched}/${s.total})`,
      );
    }

    console.log('\n── Match rate per source (bottom 20) ──');
    for (const s of sourceEntries.slice(-20).reverse()) {
      console.log(
        `  ${s.name.padEnd(40)} ${(s.rate * 100).toFixed(1).padStart(5)}%  (${s.matched}/${s.total})`,
      );
    }
  }

  // Top matched venues (need to resolve names)
  const topVenues = [...venueMatchCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);

  if (topVenues.length > 0) {
    // Resolve venue names
    const venueIds = topVenues.map(([id]) => id);
    const { data: venueRows } = await supabase
      .from('venues')
      .select('id, name')
      .in('id', venueIds);
    const venueNameMap = new Map(
      (venueRows ?? []).map((v: { id: string; name: string }) => [v.id, v.name]),
    );

    console.log('\n── Top 20 most-matched venues ──');
    for (const [id, { count }] of topVenues) {
      const name = venueNameMap.get(id) ?? id;
      console.log(`  ${name.padEnd(45)} ${String(count).padStart(5)} events`);
    }
  }

  // Top unmatched location names (for manual alias seeding)
  const topUnmatched = [...unmatchedLocations.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (topUnmatched.length > 0) {
    console.log('\n── Top 20 unmatched location_names (alias candidates) ──');
    for (const [loc, count] of topUnmatched) {
      const venueFlag = isVenueName(loc) ? ' [venue-like]' : '';
      console.log(`  ${loc.padEnd(50)} ${String(count).padStart(5)}${venueFlag}`);
    }
  }

  // ─── LIVE MODE: APPLY UPDATES ─────────────────────────────────────────

  if (!dryRun && matchedEvents.length > 0) {
    console.log(
      `\nUpdating ${matchedEvents.length} events with venue_id...`,
    );

    let updated = 0;
    let errors = 0;

    for (let i = 0; i < matchedEvents.length; i += UPDATE_BATCH_SIZE) {
      const batch = matchedEvents.slice(i, i + UPDATE_BATCH_SIZE);

      for (const m of batch) {
        const { error } = await supabase
          .from('events')
          .update({ venue_id: m.venueId })
          .eq('id', m.eventId);

        if (error) {
          errors++;
        } else {
          updated++;
        }
      }

      const batchNum = Math.floor(i / UPDATE_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(matchedEvents.length / UPDATE_BATCH_SIZE);
      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        console.log(`  Batch ${batchNum}/${totalBatches} (${updated} updated, ${errors} errors)`);
      }
    }

    console.log(
      `\nDone: ${updated} events updated, ${errors} errors`,
    );
  } else if (dryRun) {
    console.log('\nDry run complete. No data written.');
  }
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
