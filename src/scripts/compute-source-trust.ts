// src/scripts/compute-source-trust.ts
//
// Batch script -- computes source trust scores from the events table.
//
// Usage:
//   npm run source-trust              # Compute and print scores
//   npm run source-trust -- --json    # Output as JSON

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  computeTrustScoreFromMetrics,
  aggregateMetrics,
  type SourceTrustScore,
} from '@/lib/pipeline/source-trust';

// ---------------------------------------------------------------------------
// Load env
// ---------------------------------------------------------------------------
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  }
} catch {
  // .env.local may not exist if env vars are set externally
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const jsonOutput = process.argv.includes('--json');
  const today = new Date().toISOString().slice(0, 10);

  console.log('Fetching events...');

  // Fetch all events with the fields we need (paginated for large tables)
  const allEvents: Array<Record<string, unknown>> = [];
  let from = 0;
  const pageSize = 5000;

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('source_name, quality_score, venue_id, publish_status, latitude, longitude, description, image_url, ticket_url, start_date')
      .not('source_name', 'is', null)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allEvents.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Fetched ${allEvents.length} events`);

  // Group by source_name
  const sourceMap = new Map<string, Array<Record<string, unknown>>>();
  for (const e of allEvents) {
    const name = e.source_name as string;
    let list = sourceMap.get(name);
    if (!list) {
      list = [];
      sourceMap.set(name, list);
    }
    list.push(e);
  }

  // Compute trust scores
  const results: SourceTrustScore[] = [];
  const entries = Array.from(sourceMap.entries());
  for (const [sourceName, events] of entries) {
    const metrics = aggregateMetrics(events as Parameters<typeof aggregateMetrics>[0], today);
    const score = computeTrustScoreFromMetrics(sourceName, metrics);
    results.push(score);
  }

  // Sort by trust score descending
  results.sort((a, b) => b.trustScore - a.trustScore);

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('\n=== Source Trust Scores ===\n');
    console.log(
      'Source'.padEnd(35) +
      'Events'.padStart(8) +
      'Trust'.padStart(7) +
      'AvgQ'.padStart(7) +
      'Venue%'.padStart(8) +
      'Dup%'.padStart(7) +
      'Coords%'.padStart(9) +
      'Desc%'.padStart(8) +
      'Img%'.padStart(7) +
      'Future%'.padStart(9)
    );
    console.log('-'.repeat(99));

    for (const s of results) {
      const color = s.trustScore >= 70 ? '\x1b[32m' : s.trustScore >= 40 ? '\x1b[33m' : '\x1b[31m';
      const reset = '\x1b[0m';
      console.log(
        s.sourceName.padEnd(35).slice(0, 35) +
        String(s.eventCount).padStart(8) +
        `${color}${String(s.trustScore).padStart(7)}${reset}` +
        String(s.avgQualityScore).padStart(7) +
        `${String(s.venueMatchRate)}%`.padStart(8) +
        `${String(s.duplicateRate)}%`.padStart(7) +
        `${String(s.coordsRate)}%`.padStart(9) +
        `${String(s.descriptionRate)}%`.padStart(8) +
        `${String(s.imageRate)}%`.padStart(7) +
        `${String(s.futureEventRate)}%`.padStart(9)
      );
    }

    console.log(`\nTotal: ${results.length} sources, ${allEvents.length} events`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
