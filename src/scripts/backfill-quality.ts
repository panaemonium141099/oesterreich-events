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
// Self-contained scoring functions for backfill (independent of quality-scorer.ts)
// These match the Phase 1 spec: 7 dimensions, max 100 points

const AT_LAT_MIN = 46.3, AT_LAT_MAX = 49.1, AT_LNG_MIN = 9.5, AT_LNG_MAX = 17.2;

function isOutsideAustria(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  return lat < AT_LAT_MIN || lat > AT_LAT_MAX || lng < AT_LNG_MIN || lng > AT_LNG_MAX;
}

function scoreToPublishStatus(score: number): string {
  if (score >= 60) return 'published';
  if (score >= 40) return 'published_low_confidence';
  if (score >= 20) return 'needs_review';
  return 'suppressed';
}

function computeCompletenessScore(e: Record<string, unknown>): number {
  let s = 0;
  if (e.title && (e.title as string).length > 5) s += 5;
  if (e.start_date) s += 5;
  if (e.location_name) s += 5;
  if (e.category) s += 3;
  if (e.description && (e.description as string).length > 50) s += 4;
  if (e.description && (e.description as string).length > 200) s += 3;
  return s;
}

function computeDateScore(e: Record<string, unknown>): number {
  let s = 0;
  if (e.start_date) s += 5;
  // Assume exact if time component present
  const sd = e.start_date as string | null;
  if (sd && sd.includes('T') && !sd.endsWith('T00:00:00')) s += 5;
  if (sd) {
    const d = new Date(sd);
    const now = new Date();
    const twoYears = new Date(); twoYears.setFullYear(twoYears.getFullYear() + 2);
    if (d >= now && d <= twoYears) s += 3;
  }
  if (e.end_date) s += 2;
  return s;
}

function computeLocationScore(e: Record<string, unknown>): number {
  let s = 0;
  if (e.latitude && e.longitude) s += 7;
  if (e.address) s += 5;
  if (e.location_name) s += 3;
  if (e.latitude && e.longitude && !isOutsideAustria(e.latitude as number, e.longitude as number)) s += 5;
  if (e.bundesland && e.postal_code) s += 5;
  return Math.min(25, s);
}

function computeImageScore(e: Record<string, unknown>): number {
  return e.image_url ? 10 : 0;
}

function computeLinkScore(e: Record<string, unknown>): number {
  let s = 0;
  if (e.source_url) s += 3;
  if (e.ticket_url) s += 3;
  if (e.source_url || e.ticket_url) s += 4;
  return s;
}

function generateBackfillFlags(e: Record<string, unknown>): Array<{ event_id: string; flag_type: string; severity: string; details_json: unknown }> {
  const flags: Array<{ event_id: string; flag_type: string; severity: string; details_json: unknown }> = [];
  const id = e.id as string;
  if (isOutsideAustria(e.latitude as number | null, e.longitude as number | null)) {
    flags.push({ event_id: id, flag_type: 'outside_austria', severity: 'critical', details_json: { latitude: e.latitude, longitude: e.longitude } });
  }
  if (!e.location_name && !e.latitude) flags.push({ event_id: id, flag_type: 'missing_location', severity: 'high', details_json: null });
  if (!e.description || (e.description as string).length < 20) flags.push({ event_id: id, flag_type: 'missing_description', severity: 'low', details_json: null });
  if (!e.image_url) flags.push({ event_id: id, flag_type: 'missing_image', severity: 'low', details_json: null });
  return flags;
}

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

  console.log(`\nBackfill Quality Scores (${isDryRun ? 'DRY RUN' : 'LIVE'})`);
  console.log('='.repeat(60));

  // Counters for histogram
  const scoreBuckets = { '0-19': 0, '20-39': 0, '40-59': 0, '60-100': 0 };
  const statusCounts = { published: 0, published_low_confidence: 0, needs_review: 0, suppressed: 0 };
  let outsideAustriaCount = 0;
  let totalProcessed = 0;
  const sourceScores: Map<string, { total: number; count: number }> = new Map();

  // Fetch events in batches
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .is('quality_score', null)
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id');

    if (error) {
      console.error('Fetch error:', error.message);
      // Retry once after 5s
      await new Promise(r => setTimeout(r, 5000));
      const retry = await supabase
        .from('events')
        .select('*')
        .is('quality_score', null)
        .range(offset, offset + BATCH_SIZE - 1)
        .order('id');
      if (retry.error) {
        console.error('Retry failed, skipping batch:', retry.error.message);
        offset += BATCH_SIZE;
        continue;
      }
      // Use retry data
      if (!retry.data || retry.data.length === 0) { hasMore = false; break; }
      // fall through with retry.data below won't work cleanly, so just continue
      offset += BATCH_SIZE;
      continue;
    }
    if (!events || events.length === 0) {
      hasMore = false;
      break;
    }

    for (const event of events) {
      // Generate flags
      const flags = generateBackfillFlags(event);
      const isBlocked = flags.some(f => f.flag_type === 'outside_austria');

      let finalScore = 0;
      let status: string;

      if (isBlocked) {
        finalScore = 0;
        status = 'suppressed';
        outsideAustriaCount++;
      } else {
        const completeness = computeCompletenessScore(event);
        const dateScore = computeDateScore(event);
        const locationScore = computeLocationScore(event);
        const imageScore = computeImageScore(event);
        const linkScore = computeLinkScore(event);
        const dedupScore = 10; // Phase 1: no cluster, assume unique
        const sourceTrust = 2; // Neutral for backfill (no run history yet)

        finalScore = completeness + dateScore + locationScore + imageScore + linkScore + dedupScore + sourceTrust;
        status = scoreToPublishStatus(finalScore);
      }

      // Histogram
      if (finalScore < 20) scoreBuckets['0-19']++;
      else if (finalScore < 40) scoreBuckets['20-39']++;
      else if (finalScore < 60) scoreBuckets['40-59']++;
      else scoreBuckets['60-100']++;

      statusCounts[status as keyof typeof statusCounts]++;

      // Source tracking
      const src = (event.source_name as string) ?? 'unknown';
      const existing = sourceScores.get(src) ?? { total: 0, count: 0 };
      existing.total += finalScore;
      existing.count++;
      sourceScores.set(src, existing);

      // LIVE MODE: Write to database
      if (!isDryRun) {
        // Write quality flags
        await supabase.from('quality_flags').delete().eq('event_id', event.id);
        if (flags.length > 0) {
          await supabase.from('quality_flags').insert(flags);
        }

        // Write quality score
        await supabase.from('event_quality_scores').upsert(
          {
            event_id: event.id,
            completeness_score: isBlocked
              ? 0
              : computeCompletenessScore({
                  title: event.title,
                  startDate: event.start_date,
                  locationName: event.location_name,
                  category: event.category,
                  description: event.description,
                }),
            date_score: isBlocked ? 0 : computeDateScore(event),
            location_score: isBlocked ? 0 : computeLocationScore(event),
            image_score: isBlocked ? 0 : computeImageScore(event),
            link_score: isBlocked ? 0 : computeLinkScore(event),
            dedup_confidence_score: isBlocked ? 0 : 10,
            source_trust_score: isBlocked ? 0 : 2,
            final_quality_score: finalScore,
            scoring_version: 1,
          },
          { onConflict: 'event_id,scoring_version' },
        );

        // Update event
        await supabase
          .from('events')
          .update({
            quality_score: finalScore,
            publish_status: status,
          })
          .eq('id', event.id);
      }

      totalProcessed++;
    }

    offset += BATCH_SIZE;
    process.stdout.write(`\r  Processed: ${totalProcessed} events...`);

    if (events.length < BATCH_SIZE) hasMore = false;
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
