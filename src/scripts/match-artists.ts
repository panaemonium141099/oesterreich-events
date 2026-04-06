/**
 * CLI script for running the artist-event matching pipeline.
 *
 * Usage:
 *   npx tsx src/scripts/match-artists.ts              # Run matching
 *   npx tsx src/scripts/match-artists.ts --dry-run     # Preview matches without writing
 *   npx tsx src/scripts/match-artists.ts --reset-cursor # Re-process all events
 *   npx tsx src/scripts/match-artists.ts --reset-cursor --dry-run
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.6
 */

import { createClient } from '@supabase/supabase-js';
import { runMatchingPipeline } from '../lib/artist-matching';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const resetCursor = args.includes('--reset-cursor');

async function main() {
  console.log('=== Artist-Event Matching Pipeline ===');
  if (dryRun) console.log('[DRY RUN MODE]');
  if (resetCursor) console.log('[CURSOR RESET]');
  console.log('');

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

  const startTime = Date.now();

  try {
    const stats = await runMatchingPipeline(supabase, { dryRun, resetCursor });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n=== Results ===');
    console.log(`  Artists checked:      ${stats.artists_checked}`);
    console.log(`  Skipped (short name): ${stats.skipped_short_names}`);
    console.log(`  Events processed:     ${stats.events_processed}`);
    console.log(`  Matches found:        ${stats.matches_found}`);
    console.log(`  Notifications created: ${stats.notifications_created}`);
    console.log(`  Time elapsed:         ${elapsed}s`);
  } catch (error) {
    console.error('Matching pipeline failed:', error);
    process.exit(1);
  }
}

main();
