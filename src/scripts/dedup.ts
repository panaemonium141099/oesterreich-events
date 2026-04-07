// src/scripts/dedup.ts
//
// Batch dedup script — finds and merges duplicate events.
//
// Usage:
//   npm run dedup -- --dry-run     # Show what would happen
//   npm run dedup                   # Execute merges
//   npm run dedup -- --reset        # Re-evaluate all clusters

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { scorePair, canonicalizeIds } from '@/lib/pipeline/dedup-scorer';
import { buildClusters, resolvePrimary, type ScoredPair } from '@/lib/pipeline/dedup-cluster';
import { isGarbageTitle } from '@/lib/pipeline/garbage-filter';
import { generateFingerprint } from '@/lib/dedup/fingerprint';
import type { EventRow, DedupScoreBreakdown } from '@/lib/pipeline/types';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  }
} catch { /* ignore */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESET = args.includes('--reset');
const EVENT_SELECT = 'id,title,description,start_date,end_date,location_name,address,district,postal_code,bundesland,latitude,longitude,source_url,ticket_url,image_url,category,tags,source_id,source_name,venue_id,venue_match_confidence,venue_match_stage,quality_score,publish_status,content_fingerprint,duplicate_of,dedup_score,dedup_cluster_id,organizer,price_text,created_at';

// ---------------------------------------------------------------------------
// Stats tracking
// ---------------------------------------------------------------------------

interface DedupStats {
  totalEvents: number;
  garbageSuppressed: number;
  daysProcessed: number;
  pairsCompared: number;
  mergeDecisions: number;
  uncertainDecisions: number;
  distinctDecisions: number;
  clustersFormed: number;
  eventsMarkedDuplicate: number;
  enrichmentsApplied: number;
  logEntriesWritten: number;
  errors: string[];
}

function newStats(): DedupStats {
  return {
    totalEvents: 0, garbageSuppressed: 0, daysProcessed: 0,
    pairsCompared: 0, mergeDecisions: 0, uncertainDecisions: 0,
    distinctDecisions: 0, clustersFormed: 0, eventsMarkedDuplicate: 0,
    enrichmentsApplied: 0, logEntriesWritten: 0, errors: [],
  };
}

// ---------------------------------------------------------------------------
// Phase 1: Garbage cleanup
// ---------------------------------------------------------------------------

async function cleanupGarbage(stats: DedupStats): Promise<void> {
  console.log('\n--- Phase 1: Garbage Cleanup ---');

  let offset = 0;
  const garbageIds: string[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id,title,publish_status')
      .neq('publish_status', 'suppressed')
      .neq('publish_status', 'duplicate')
      .range(offset, offset + 999)
      .order('id');

    if (error) {
      stats.errors.push(`Garbage scan error: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;

    for (const e of data) {
      if (e.title && isGarbageTitle(e.title)) {
        garbageIds.push(e.id);
      }
    }

    offset += data.length;
    if (data.length < 1000) break;
  }

  console.log(`  Found ${garbageIds.length} garbage events`);
  stats.garbageSuppressed = garbageIds.length;

  if (garbageIds.length > 0 && !DRY_RUN) {
    // Batch update in chunks of 100
    for (let i = 0; i < garbageIds.length; i += 100) {
      const chunk = garbageIds.slice(i, i + 100);
      const { error } = await supabase
        .from('events')
        .update({ publish_status: 'suppressed', quality_score: 0 })
        .in('id', chunk);

      if (error) stats.errors.push(`Garbage update error: ${error.message}`);
    }
    console.log(`  Suppressed ${garbageIds.length} garbage events`);
  }
}

// ---------------------------------------------------------------------------
// Phase 2+3: Dedup by day blocks
// ---------------------------------------------------------------------------

async function getDistinctDays(): Promise<string[]> {
  const days: string[] = [];
  let offset = 0;

  // Fetch distinct days using raw query via RPC or pagination
  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('start_date')
      .not('start_date', 'is', null)
      .not('publish_status', 'in', '("suppressed","duplicate")')
      .order('start_date')
      .range(offset, offset + 4999);

    if (error || !data || data.length === 0) break;

    for (const e of data) {
      const day = e.start_date?.slice(0, 10);
      if (day && (days.length === 0 || days[days.length - 1] !== day)) {
        days.push(day);
      }
    }

    offset += data.length;
    if (data.length < 5000) break;
  }

  return [...new Set(days)].sort();
}

async function loadEventsForDay(day: string): Promise<EventRow[]> {
  const allEvents: EventRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_SELECT)
      .gte('start_date', `${day}T00:00:00`)
      .lt('start_date', `${day}T23:59:59.999`)
      .not('publish_status', 'in', '("suppressed")')
      .range(offset, offset + 999)
      .order('id');

    if (error || !data || data.length === 0) break;
    allEvents.push(...(data as EventRow[]));
    offset += data.length;
    if (data.length < 1000) break;
  }

  return allEvents;
}

/**
 * Build blocks within a day for efficient comparison.
 * Returns groups of event IDs that should be compared pairwise.
 */
function buildBlocks(events: EventRow[]): Map<string, string[]> {
  const blocks = new Map<string, string[]>();

  for (const e of events) {
    // Skip already-duplicate events (unless reset mode)
    if (!RESET && e.publish_status === 'duplicate') continue;

    const keys: string[] = [];

    // Block by fingerprint
    const fp = e.content_fingerprint ??
      (e.title && e.start_date ? generateFingerprint(e.title, e.start_date) : null);
    if (fp) keys.push(`fp:${fp}`);

    // Block by venue_id
    if (e.venue_id) keys.push(`venue:${e.venue_id}`);

    // Block by district + first title word
    const dist = (e.district ?? e.bundesland ?? '').toLowerCase().trim();
    const firstWord = (e.title ?? '').toLowerCase().split(/\s+/)[0] ?? '';
    if (dist && firstWord.length > 2) {
      keys.push(`dist:${dist}:${firstWord}`);
    }

    // Block by location_name (normalized)
    const loc = (e.location_name ?? '').toLowerCase().trim();
    if (loc && loc.length > 3) {
      keys.push(`loc:${loc}`);
    }

    for (const key of keys) {
      if (!blocks.has(key)) blocks.set(key, []);
      blocks.get(key)!.push(e.id);
    }
  }

  return blocks;
}

async function processDayBlock(
  day: string,
  events: EventRow[],
  stats: DedupStats,
): Promise<ScoredPair[]> {
  const eventsById = new Map(events.map(e => [e.id, e]));
  const blocks = buildBlocks(events);
  const scoredPairs: ScoredPair[] = [];
  const seenPairs = new Set<string>();

  for (const [, memberIds] of blocks) {
    if (memberIds.length < 2 || memberIds.length > 200) continue;

    // Score all pairs in this block
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const [idA, idB] = canonicalizeIds(memberIds[i], memberIds[j]);
        const pairKey = `${idA}:${idB}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const eventA = eventsById.get(idA);
        const eventB = eventsById.get(idB);
        if (!eventA || !eventB) continue;

        const score = scorePair(eventA, eventB);
        stats.pairsCompared++;

        if (score.decision === 'merge') stats.mergeDecisions++;
        else if (score.decision === 'uncertain') stats.uncertainDecisions++;
        else stats.distinctDecisions++;

        if (score.decision !== 'distinct') {
          scoredPairs.push({ eventA, eventB, score });
        }
      }
    }
  }

  return scoredPairs;
}

// ---------------------------------------------------------------------------
// Apply merges
// ---------------------------------------------------------------------------

async function applyMerges(
  allPairs: ScoredPair[],
  allEventsById: Map<string, EventRow>,
  stats: DedupStats,
): Promise<void> {
  console.log('\n--- Applying merges ---');

  const mergePairs = allPairs.filter(p => p.score.decision === 'merge');
  const clusters = buildClusters(mergePairs, allEventsById);

  stats.clustersFormed = clusters.length;
  console.log(`  ${clusters.length} clusters formed from ${mergePairs.length} merge pairs`);

  for (const cluster of clusters) {
    // Resolve primary (prevent chains)
    const resolvedPrimary = resolvePrimary(cluster.primaryId, allEventsById);
    if (resolvedPrimary !== cluster.primaryId) {
      // The selected primary is itself a duplicate — use the resolved one
      cluster.primaryId = resolvedPrimary;
      cluster.duplicateIds = cluster.duplicateIds.filter(id => id !== resolvedPrimary);
    }

    if (!DRY_RUN) {
      // Update primary: set cluster_id + enrichments
      const primaryUpdate: Record<string, unknown> = {
        dedup_cluster_id: cluster.clusterId,
      };
      if (Object.keys(cluster.enrichments).length > 0) {
        Object.assign(primaryUpdate, cluster.enrichments);
        stats.enrichmentsApplied++;
      }

      const { error: primaryErr } = await supabase
        .from('events')
        .update(primaryUpdate)
        .eq('id', cluster.primaryId);

      if (primaryErr) {
        stats.errors.push(`Primary update ${cluster.primaryId}: ${primaryErr.message}`);
        continue;
      }

      // Update duplicates
      for (const dupId of cluster.duplicateIds) {
        const dupScore = cluster.scores.get(dupId) ?? 0;
        const { error: dupErr } = await supabase
          .from('events')
          .update({
            publish_status: 'duplicate',
            duplicate_of: cluster.primaryId,
            dedup_score: dupScore,
            dedup_cluster_id: cluster.clusterId,
          })
          .eq('id', dupId);

        if (dupErr) {
          stats.errors.push(`Duplicate update ${dupId}: ${dupErr.message}`);
        } else {
          stats.eventsMarkedDuplicate++;
        }
      }
    } else {
      stats.eventsMarkedDuplicate += cluster.duplicateIds.length;
    }
  }

  // Write dedup log entries (for merge + uncertain pairs)
  if (!DRY_RUN) {
    console.log(`  Writing ${allPairs.length} dedup log entries...`);
    for (let i = 0; i < allPairs.length; i += 50) {
      const chunk = allPairs.slice(i, i + 50);
      const rows = chunk.map(p => {
        const [aId, bId] = canonicalizeIds(p.eventA.id, p.eventB.id);
        return {
          event_a_id: aId,
          event_b_id: bId,
          title_score: p.score.titleScore,
          datetime_score: p.score.datetimeScore,
          venue_score: p.score.venueScore,
          geo_score: p.score.geoScore,
          url_score: p.score.urlScore,
          overall_score: p.score.overallScore,
          decision: p.score.decision,
        };
      });

      const { error } = await supabase
        .from('event_dedup_log')
        .upsert(rows, { onConflict: 'event_a_id,event_b_id' });

      if (error) {
        stats.errors.push(`Dedup log write error: ${error.message}`);
      } else {
        stats.logEntriesWritten += rows.length;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Reset mode
// ---------------------------------------------------------------------------

async function resetClusters(stats: DedupStats): Promise<void> {
  console.log('\n--- Reset mode: clearing existing dedup data ---');

  if (!DRY_RUN) {
    // Clear duplicate status
    let offset = 0;
    let cleared = 0;
    while (true) {
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .eq('publish_status', 'duplicate')
        .limit(500);

      if (error || !data || data.length === 0) break;

      const ids = data.map(e => e.id);
      await supabase
        .from('events')
        .update({
          publish_status: 'published',
          duplicate_of: null,
          dedup_score: null,
          dedup_cluster_id: null,
        })
        .in('id', ids);

      cleared += ids.length;
      offset += ids.length;
    }

    // Clear dedup log (except manual decisions)
    await supabase
      .from('event_dedup_log')
      .delete()
      .in('decision', ['merge', 'uncertain', 'distinct']);

    // Clear cluster IDs on primaries
    while (true) {
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .not('dedup_cluster_id', 'is', null)
        .limit(500);

      if (error || !data || data.length === 0) break;

      const ids = data.map(e => e.id);
      await supabase
        .from('events')
        .update({ dedup_cluster_id: null })
        .in('id', ids);
    }

    console.log(`  Cleared ${cleared} duplicate events`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();
  const stats = newStats();

  console.log(`=== Batch Dedup ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===`);
  if (RESET) console.log('Reset mode: will re-evaluate all clusters');

  // Reset if requested
  if (RESET) await resetClusters(stats);

  // Phase 1: Garbage cleanup
  await cleanupGarbage(stats);

  // Phase 2+3: Day-by-day dedup
  console.log('\n--- Phase 2+3: Day-by-day dedup ---');
  const days = await getDistinctDays();
  console.log(`  ${days.length} distinct days to process`);

  const allPairs: ScoredPair[] = [];
  const allEventsById = new Map<string, EventRow>();

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const events = await loadEventsForDay(day);

    if (events.length < 2) {
      stats.daysProcessed++;
      continue;
    }

    stats.totalEvents += events.length;
    for (const e of events) allEventsById.set(e.id, e);

    const dayPairs = await processDayBlock(day, events, stats);
    allPairs.push(...dayPairs);

    stats.daysProcessed++;
    if (stats.daysProcessed % 50 === 0) {
      process.stderr.write(
        `\r  Days: ${stats.daysProcessed}/${days.length} | Pairs: ${stats.pairsCompared} | Merges: ${stats.mergeDecisions} | Uncertain: ${stats.uncertainDecisions}`,
      );
    }
  }

  process.stderr.write('\n');

  // Apply merges
  await applyMerges(allPairs, allEventsById, stats);

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Dedup Summary ===');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Duration: ${duration}s`);
  console.log(`  Events scanned: ${stats.totalEvents}`);
  console.log(`  Garbage suppressed: ${stats.garbageSuppressed}`);
  console.log(`  Days processed: ${stats.daysProcessed}`);
  console.log(`  Pairs compared: ${stats.pairsCompared}`);
  console.log(`  Merge decisions: ${stats.mergeDecisions}`);
  console.log(`  Uncertain decisions: ${stats.uncertainDecisions}`);
  console.log(`  Distinct decisions: ${stats.distinctDecisions}`);
  console.log(`  Clusters formed: ${stats.clustersFormed}`);
  console.log(`  Events marked duplicate: ${stats.eventsMarkedDuplicate}`);
  console.log(`  Enrichments applied: ${stats.enrichmentsApplied}`);
  console.log(`  Log entries written: ${stats.logEntriesWritten}`);
  if (stats.errors.length > 0) {
    console.log(`  Errors: ${stats.errors.length}`);
    for (const err of stats.errors.slice(0, 10)) {
      console.log(`    - ${err}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
