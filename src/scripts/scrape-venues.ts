/**
 * CLI script: Run the registry-based venue feed ingestion pipeline.
 *
 * Usage:
 *   npx tsx src/scripts/scrape-venues.ts                    # Scrape all eligible venues
 *   npx tsx src/scripts/scrape-venues.ts --feed-type ics    # Only ICS feeds
 *   npx tsx src/scripts/scrape-venues.ts --bundesland Wien  # Only Wien venues
 *   npx tsx src/scripts/scrape-venues.ts --student-only     # Only student-relevant venues
 *   npx tsx src/scripts/scrape-venues.ts --force            # Ignore last_scraped_at
 *   npx tsx src/scripts/scrape-venues.ts --dry-run          # Show eligible venues, don't scrape
 *   npx tsx src/scripts/scrape-venues.ts --verbose          # Verbose logging
 *   npx tsx src/scripts/scrape-venues.ts --venue-id <id>    # Scrape a specific venue
 *   npx tsx src/scripts/scrape-venues.ts --max 50           # Limit to 50 venues
 *   npx tsx src/scripts/scrape-venues.ts --concurrency 10   # Process 10 venues in parallel
 */

import { readFileSync } from 'fs';
import { join } from 'path';

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
} catch { /* .env.local not found */ }

import { createClient } from '@supabase/supabase-js';
import {
  runRegistryScraper,
  fetchEligibleVenues,
  type RegistryScraperOptions,
} from '../lib/scrapers/RegistryBasedScraper';
import { syncEventsToSupabase } from '../lib/db/supabase-sync';
import type { EventFeedType } from '@/types/venues';

function parseArgs(): RegistryScraperOptions & { dryRun: boolean; sync: boolean } {
  const args = process.argv.slice(2);
  const options: RegistryScraperOptions & { dryRun: boolean; sync: boolean } = {
    dryRun: false,
    sync: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--feed-type':
        options.feedType = args[++i] as EventFeedType;
        break;
      case '--bundesland':
        options.bundesland = args[++i];
        break;
      case '--student-only':
        options.studentOnly = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--no-sync':
        options.sync = false;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--venue-id':
        options.venueIds = [args[++i]];
        break;
      case '--max':
        options.maxVenues = parseInt(args[++i], 10);
        break;
      case '--concurrency':
        options.concurrency = parseInt(args[++i], 10);
        break;
      case '--min-hours':
        options.minHoursSinceLastScrape = parseInt(args[++i], 10);
        break;
      case '--help':
        console.log(`
Registry-Based Venue Scraper — Ingest events from venue feeds

Options:
  --feed-type <type>    Only process venues with this feed type (ics, json-ld, rss)
  --bundesland <name>   Only process venues in this Bundesland
  --student-only        Only process student-relevant venues
  --force               Re-scrape even recently scraped venues
  --dry-run             Show eligible venues without scraping
  --no-sync             Scrape but don't sync to Supabase
  --verbose             Enable verbose logging
  --venue-id <id>       Scrape a specific venue by ID
  --max <n>             Maximum venues to process (default: 500)
  --concurrency <n>     Parallel venue processing (default: 5)
  --min-hours <n>       Minimum hours since last scrape (default: 12)
  --help                Show this help
`);
        process.exit(0);
      default:
        if (args[i].startsWith('--')) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('Registry-Based Venue Scraper');
  console.log('='.repeat(60));

  // Dry-run mode: just list eligible venues
  if (options.dryRun) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const venues = await fetchEligibleVenues(supabase, options);
    console.log(`\nFound ${venues.length} eligible venues:\n`);

    for (const v of venues) {
      const lastScraped = v.last_scraped_at
        ? new Date(v.last_scraped_at).toLocaleDateString('de-AT')
        : 'never';
      console.log(
        `  ${v.name} [${v.event_feed_type}] (${v.bundesland ?? 'unknown'}) — last scraped: ${lastScraped}`
      );
      console.log(`    Feed: ${v.event_feed_url}`);
    }

    const byType = new Map<string, number>();
    for (const v of venues) {
      const t = v.event_feed_type ?? 'unknown';
      byType.set(t, (byType.get(t) ?? 0) + 1);
    }
    console.log('\nBy feed type:');
    for (const [type, count] of byType) {
      console.log(`  ${type}: ${count}`);
    }

    return;
  }

  // Run the pipeline
  const result = await runRegistryScraper(options);

  console.log('\n' + '-'.repeat(60));
  console.log('Results:');
  console.log(`  Venues processed:    ${result.venues_processed}`);
  console.log(`  Venues with events:  ${result.venues_with_events}`);
  console.log(`  Venues errored:      ${result.venues_errored}`);
  console.log(`  Total raw events:    ${result.total_events_raw}`);
  console.log(`  After dedup:         ${result.total_events_deduped}`);
  console.log(`  Duplicates removed:  ${result.duplicates_removed}`);

  // Show per-venue breakdown if verbose
  if (options.verbose && result.venue_results.length > 0) {
    console.log('\nPer-venue breakdown:');
    for (const vr of result.venue_results) {
      const status = vr.events_found > 0
        ? `${vr.events_found} events`
        : vr.errors.length > 0
          ? `ERROR: ${vr.errors[0]}`
          : 'no events';
      console.log(`  ${vr.venue_name} [${vr.feed_type}]: ${status} (${vr.duration_ms}ms)`);
    }
  }

  // Sync to Supabase
  if (options.sync && result.events.length > 0) {
    console.log(`\nSyncing ${result.events.length} events to Supabase...`);
    const { upserted, errors, filtered } = await syncEventsToSupabase(result.events);
    console.log(
      `Supabase sync: ${upserted} upserted, ${errors} errors${filtered > 0 ? `, ${filtered} filtered` : ''}`
    );
  } else if (result.events.length === 0) {
    console.log('\nNo events to sync.');
  } else {
    console.log('\nSync skipped (--no-sync).');
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nCompleted in ${elapsed}s`);
  console.log('='.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
