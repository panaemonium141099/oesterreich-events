/**
 * Feed Detection Script — Scans venue websites for ICS/JSON-LD/RSS event feeds.
 *
 * Iterates over all venues in Supabase that have a website URL but no
 * event_feed_type yet (or --force to rescan all), fetches each homepage,
 * and auto-detects the best available event feed.
 *
 * Updates venues.event_feed_url and venues.event_feed_type in Supabase.
 *
 * Run: npx tsx src/scripts/detect-feeds.ts
 *      npx tsx src/scripts/detect-feeds.ts --dry-run
 *      npx tsx src/scripts/detect-feeds.ts --force          # Rescan all venues
 *      npx tsx src/scripts/detect-feeds.ts --limit=50       # Process first 50
 *      npx tsx src/scripts/detect-feeds.ts --type=bar       # Only scan bars
 *      npx tsx src/scripts/detect-feeds.ts --verbose        # Show per-venue details
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { detectFeeds } from '../lib/connectors/feed-detector';

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
} catch { /* ignore missing .env.local */ }

// ─── CLI ARGS ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const VERBOSE = args.includes('--verbose');

const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

const typeArg = args.find((a) => a.startsWith('--type='));
const TYPE_FILTER = typeArg ? typeArg.split('=')[1] : undefined;

// ─── SUPABASE CLIENT ────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface VenueRow {
  id: string;
  name: string;
  website: string;
  type: string;
  city: string | null;
  event_feed_url: string | null;
  event_feed_type: string | null;
}

interface Stats {
  scanned: number;
  detected: number;
  ics: number;
  'json-ld': number;
  rss: number;
  errors: number;
  skipped: number;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Feed Detection Script ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Force rescan: ${FORCE ? 'yes' : 'no'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  if (TYPE_FILTER) console.log(`Type filter: ${TYPE_FILTER}`);
  console.log('');

  // Fetch venues with websites
  let query = supabase
    .from('venues')
    .select('id, name, website, type, city, event_feed_url, event_feed_type')
    .not('website', 'is', null)
    .neq('website', '');

  // Only scan venues without a feed type unless --force
  if (!FORCE) {
    query = query.is('event_feed_type', null);
  }

  if (TYPE_FILTER) {
    query = query.eq('type', TYPE_FILTER);
  }

  query = query.order('name');

  if (LIMIT) {
    query = query.limit(LIMIT);
  }

  const { data: venues, error } = await query;

  if (error) {
    console.error('Failed to fetch venues:', error.message);
    process.exit(1);
  }

  if (!venues || venues.length === 0) {
    console.log('No venues to scan. Use --force to rescan all venues with websites.');
    return;
  }

  console.log(`Found ${venues.length} venues to scan.\n`);

  const stats: Stats = {
    scanned: 0,
    detected: 0,
    ics: 0,
    'json-ld': 0,
    rss: 0,
    errors: 0,
    skipped: 0,
  };

  // Process venues with concurrency limit
  const CONCURRENCY = 5;
  const batches: VenueRow[][] = [];
  for (let i = 0; i < venues.length; i += CONCURRENCY) {
    batches.push(venues.slice(i, i + CONCURRENCY) as VenueRow[]);
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map((venue) => processVenue(venue, stats)),
    );
  }

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Scanned:  ${stats.scanned}`);
  console.log(`Detected: ${stats.detected}`);
  console.log(`  ICS:     ${stats.ics}`);
  console.log(`  JSON-LD: ${stats['json-ld']}`);
  console.log(`  RSS:     ${stats.rss}`);
  console.log(`Errors:   ${stats.errors}`);
  console.log(`Skipped:  ${stats.skipped}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN: No changes were written to Supabase.');
  }
}

async function processVenue(venue: VenueRow, stats: Stats): Promise<void> {
  stats.scanned++;

  // Normalize website URL
  let url = venue.website.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const result = await detectFeeds(url, {
      timeoutMs: 15000,
    });

    if (result.errors.length > 0 && VERBOSE) {
      console.log(`  [WARN] ${venue.name}: ${result.errors[0]}`);
    }

    if (result.best) {
      stats.detected++;
      const feedType = result.best.type;
      stats[feedType as keyof Pick<Stats, 'ics' | 'json-ld' | 'rss'>]++;

      if (VERBOSE) {
        console.log(
          `  [FOUND] ${venue.name} (${venue.city || '?'}): ${feedType} @ ${result.best.url} (${result.best.confidence})`,
        );
      } else {
        const progress = `[${stats.scanned}/${stats.scanned + stats.errors + stats.skipped}]`;
        console.log(
          `${progress} ${venue.name}: ${feedType} (${result.best.confidence})`,
        );
      }

      // Update Supabase
      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('venues')
          .update({
            event_feed_url: result.best.url,
            event_feed_type: feedType,
            updated_at: new Date().toISOString(),
          })
          .eq('id', venue.id);

        if (updateError) {
          console.error(`  [ERROR] Failed to update ${venue.name}: ${updateError.message}`);
        }
      }
    } else {
      stats.skipped++;
      if (VERBOSE) {
        console.log(`  [NONE] ${venue.name} (${venue.city || '?'}): no event feed detected`);
      }
    }
  } catch (err) {
    stats.errors++;
    const msg = err instanceof Error ? err.message : String(err);
    if (VERBOSE) {
      console.log(`  [ERROR] ${venue.name}: ${msg}`);
    }
  }
}

// ─── RUN ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
