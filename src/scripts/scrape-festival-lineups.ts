/**
 * CLI script: Run the festival lineup ingestion pipeline.
 *
 * Usage:
 *   npx tsx src/scripts/scrape-festival-lineups.ts                    # Scrape all eligible festivals
 *   npx tsx src/scripts/scrape-festival-lineups.ts --festival frequency  # Only scrape Frequency
 *   npx tsx src/scripts/scrape-festival-lineups.ts --force              # Ignore lineup hash, re-scrape all
 *   npx tsx src/scripts/scrape-festival-lineups.ts --dry-run            # Show what would change, no DB writes
 *   npx tsx src/scripts/scrape-festival-lineups.ts --verbose            # Verbose logging
 *   npx tsx src/scripts/scrape-festival-lineups.ts --help               # Show help
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.6
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

import {
  runLineupOrchestrator,
  type OrchestratorOptions,
} from '../lib/lineup/orchestrator';

function parseArgs(): OrchestratorOptions {
  const args = process.argv.slice(2);
  const options: OrchestratorOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--festival':
        options.festivalSlug = args[++i];
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Festival Lineup Ingestion Pipeline

Scrapes lineup pages for eligible festivals, upserts artist data,
and generates derived events (e.g. "Volbeat at Nova Rock 2026").

Options:
  --festival <slug>  Only process this festival (e.g. "frequency", "nova-rock")
  --force            Ignore lineup hash, re-scrape even if unchanged
  --dry-run          Show what would change without writing to the database
  --verbose          Enable verbose logging
  --help             Show this help

Environment variables:
  NEXT_PUBLIC_SUPABASE_URL    Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY   Supabase service role key

Registered scrapers:
  frequency, nova-rock, electric-love, shutdown

Examples:
  npm run scrape:festival-lineups
  npm run scrape:festival-lineups -- --festival nova-rock --verbose
  npm run scrape:festival-lineups -- --dry-run
  npm run scrape:festival-lineups -- --force --verbose
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
  console.log('Festival Lineup Ingestion Pipeline');
  if (options.dryRun) console.log('  ** DRY-RUN MODE — no database writes **');
  if (options.force) console.log('  ** FORCE MODE — ignoring lineup hashes **');
  if (options.festivalSlug) console.log(`  ** Filtering to: ${options.festivalSlug} **`);
  console.log('='.repeat(60) + '\n');

  const stats = await runLineupOrchestrator(options);

  // Print summary
  console.log('\n' + '-'.repeat(60));
  console.log('Results:');
  console.log(`  Festivals checked:       ${stats.festivals_checked}`);
  console.log(`  Festivals changed:       ${stats.festivals_changed}`);
  console.log(`  Festivals unchanged:     ${stats.festivals_skipped_unchanged}`);
  console.log(`  Festivals no scraper:    ${stats.festivals_skipped_no_scraper}`);
  console.log(`  Festivals errored:       ${stats.festivals_errored}`);
  console.log(`  Artists added:           ${stats.artists_added}`);
  console.log(`  Artists removed:         ${stats.artists_removed}`);
  console.log(`  Derived events created:  ${stats.events_derived}`);
  console.log(`  Events backlinked:       ${stats.events_backlinked}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nCompleted in ${elapsed}s`);
  console.log('='.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
