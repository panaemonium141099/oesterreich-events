/**
 * Backfill Quality Scores — scores all existing events in Supabase.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-quality.ts --dry-run   # Analyze only, no writes
 *   npx tsx src/scripts/backfill-quality.ts              # Live mode, writes scores
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { scoreAndAdmit } from '../lib/quality/score-event';
import { bundeslandFromPolygon } from '../lib/eventim/bundesland-from-geo';
import { makeBulkUpdater } from '../lib/db/bulk-update';

// Load .env.local (tsx does not auto-load like Next.js does)
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
} catch { /* .env.local not found, rely on environment */ }
// Scoring is delegated to src/lib/quality/score-event.ts so this script
// and the at-ingest path in supabase-sync.ts produce IDENTICAL scores.
// This file used to carry its own copies of the scoring helpers; that
// duplication had already drifted (the old completeness call here
// passed camelCase keys that the snake_case-keyed function couldn't
// read, silently dropping ~10 points from every backfilled event).

const BATCH_SIZE = 1000;
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 3 Bulk-Updater statt 5 Round-Trips pro Event.
  // Pre-Refactor: pro Event = DELETE flags + INSERT flags + UPSERT scores
  //   + SELECT publish_status + UPDATE event = 5 PostgREST round-trips.
  // Now: pro 500-Event-Batch = 3 RPC-Calls (flags ersetzen, scores
  //   upserten, events publish setzen). Der Publish-RPC hat den
  //   duplicate/archived guard eingebaut, also kein SELECT pro Event mehr.
  const flagsUpdater = makeBulkUpdater(supabase, 'bulk_replace_event_quality_flags');
  const scoresUpdater = makeBulkUpdater(supabase, 'bulk_upsert_event_quality_scores');
  const publishUpdater = makeBulkUpdater(supabase, 'bulk_update_event_publish');

  console.log(`\nBackfill Quality Scores (${isDryRun ? 'DRY RUN' : 'LIVE'})`);
  console.log('='.repeat(60));

  // Counters for histogram
  const scoreBuckets = { '0-19': 0, '20-39': 0, '40-59': 0, '60-100': 0 };
  const statusCounts = { published: 0, published_low_confidence: 0, needs_review: 0, suppressed: 0 };
  let outsideAustriaCount = 0;
  let totalProcessed = 0;
  const sourceScores: Map<string, { total: number; count: number }> = new Map();

  // Fetch events in batches using cursor-based pagination on id.
  //
  // Why id-cursor instead of offset+range:
  //   In LIVE mode every batch's UPDATE removes the just-processed events
  //   from the (quality_score IS NULL) filter set. With offset-based
  //   pagination the next .range(500, 999) then reads positions 500–999
  //   of the SHRUNKEN set — which corresponds to events 1000–1499 of the
  //   original ordering. Events 500–999 are silently skipped. Result:
  //   ~50% of rows never get scored (~23k of 57k on the prior run).
  //
  //   Cursor-based on id avoids this entirely: each batch reads
  //   `id > lastSeenId` from the still-NULL set. Even after rows leave
  //   the filter, the next id-range is unambiguous and never re-reads or
  //   skips. Works correctly in both DRY-RUN (filter stable) and LIVE
  //   (filter shrinks).
  let lastId: string | null = null;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('events')
      .select('*')
      .is('quality_score', null)
      .order('id')
      .limit(BATCH_SIZE);
    if (lastId !== null) {
      query = query.gt('id', lastId);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Fetch error:', error.message);
      // Retry once after 5s. lastId is unchanged so the next iteration
      // re-attempts the SAME batch — no skip on transient failures.
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }
    if (!events || events.length === 0) {
      hasMore = false;
      break;
    }

    for (const event of events) {
      // Single source of truth for scoring — see src/lib/quality/score-event.ts.
      // dedup=10 (assume unique), source_trust=2 (neutral) for backfill,
      // matching the previous self-contained logic.
      //
      // scoreAndAdmit statt scoreEvent: der Backfill schreibt publish_status
      // und würde sonst jede Quarantäne des Freigabevertrags wieder aufheben
      // (Score allein kennt keine Ortswidersprüche).
      const result = scoreAndAdmit(event, { regionOf: bundeslandFromPolygon });
      if (result.outside_austria) outsideAustriaCount++;

      // Histogram
      if (result.quality_score < 20) scoreBuckets['0-19']++;
      else if (result.quality_score < 40) scoreBuckets['20-39']++;
      else if (result.quality_score < 60) scoreBuckets['40-59']++;
      else scoreBuckets['60-100']++;

      statusCounts[result.publish_status]++;

      // Source tracking
      const src = (event.source_name as string) ?? 'unknown';
      const existing = sourceScores.get(src) ?? { total: 0, count: 0 };
      existing.total += result.quality_score;
      existing.count++;
      sourceScores.set(src, existing);

      // LIVE MODE: queue flags + score-breakdown + publish update.
      // Alle 3 Updater auto-flushen bei 500. Final flush nach der Loop.
      if (!isDryRun) {
        // 1) Flags-Replacement (DELETE+INSERT atomic im RPC)
        await flagsUpdater.add({
          id: event.id,                     // BulkUpdater fordert id; wird nicht
          event_id: event.id,               // benutzt vom RPC, nutzt event_id stattdessen
          flags: result.flags.map(f => ({
            flag_type: f.flag_type,
            severity: f.severity,
            details_json: f.details ?? null,
          })),
        });

        // 2) Per-Dimension Breakdown (UPSERT)
        await scoresUpdater.add({
          id: event.id,
          event_id: event.id,
          completeness_score: result.breakdown.completeness,
          date_score: result.breakdown.date,
          location_score: result.breakdown.location,
          image_score: result.breakdown.image,
          link_score: result.breakdown.link,
          dedup_confidence_score: result.breakdown.dedup,
          source_trust_score: result.breakdown.source_trust,
          final_quality_score: result.quality_score,
          scoring_version: 1,
        });

        // 3) Publish-Status + Quality-Score am events-Row.
        // RPC hat duplicate/archived guard eingebaut → kein SELECT pro
        // Event nötig. Der Status wird einfach gesetzt; Rows mit
        // publish_status='duplicate' werden vom RPC übersprungen.
        await publishUpdater.add({
          id: event.id,
          publish_status: result.publish_status,
          quality_score: result.quality_score,
        });
      }

      totalProcessed++;
    }

    // Cursor advance — next batch starts strictly after the last id we
    // just processed. Monotonic in id-order, so it works regardless of
    // whether the filter set is stable (dry-run) or shrinking (live).
    lastId = events[events.length - 1].id;
    process.stdout.write(`\r  Processed: ${totalProcessed} events...`);

    if (events.length < BATCH_SIZE) hasMore = false;
  }

  // Final flushes — verbleibende <500 Rows aus jedem Updater rauspushen
  if (!isDryRun) {
    await Promise.all([
      flagsUpdater.flush().catch(e => console.error(`flags flush: ${e.message}`)),
      scoresUpdater.flush().catch(e => console.error(`scores flush: ${e.message}`)),
      publishUpdater.flush().catch(e => console.error(`publish flush: ${e.message}`)),
    ]);
    console.log(
      `\n  Bulk-RPC summary:\n`
      + `    flags:   ${flagsUpdater.stats.flushes} calls, ${flagsUpdater.stats.affected} inserted, ${flagsUpdater.stats.errors} errs\n`
      + `    scores:  ${scoresUpdater.stats.flushes} calls, ${scoresUpdater.stats.affected} affected, ${scoresUpdater.stats.errors} errs\n`
      + `    publish: ${publishUpdater.stats.flushes} calls, ${publishUpdater.stats.affected} affected, ${publishUpdater.stats.errors} errs`,
    );
  }

  // Print results
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`Total Events Processed: ${totalProcessed}`);
  console.log(`\nScore Distribution:`);
  console.log(`  0-19  (suppressed):           ${scoreBuckets['0-19']}`);
  console.log(`  20-39 (needs_review):          ${scoreBuckets['20-39']}`);
  console.log(`  40-59 (published_low_conf):    ${scoreBuckets['40-59']}`);
  console.log(`  60-100 (published):            ${scoreBuckets['60-100']}`);

  console.log(`\nPublish Status:`);
  console.log(`  published:                ${statusCounts.published}`);
  console.log(`  published_low_confidence: ${statusCounts.published_low_confidence}`);
  console.log(`  needs_review:             ${statusCounts.needs_review}`);
  console.log(`  suppressed:               ${statusCounts.suppressed}`);

  console.log(`\nOutside Austria: ${outsideAustriaCount}`);

  // Top 10 worst sources by avg score
  const sourceList = [...sourceScores.entries()]
    .map(([name, { total, count }]) => ({ name, avg: total / count, count }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 10);

  console.log(`\nTop 10 Lowest Avg Score Sources:`);
  for (const s of sourceList) {
    console.log(`  ${s.name.padEnd(40)} avg=${s.avg.toFixed(1)}  (${s.count} events)`);
  }

  console.log(
    `\n${isDryRun ? 'DRY RUN — no changes written.' : 'LIVE — scores and status written to database.'}`,
  );
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
