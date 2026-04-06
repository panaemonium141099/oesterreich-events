/**
 * Master scrape script: runs everything in the correct order.
 *
 * 1. Regular scrapers (141 sources)
 * 2. Venue feed ingestion (ICS/JSON-LD/RSS from registered venues)
 * 3. Score calculation (with venue/student bonuses)
 *
 * Run: npm run scrape:all
 *      npm run scrape:all -- --skip-scrapers    (only venues + score)
 *      npm run scrape:all -- --skip-venues      (only scrapers + score)
 *      npm run scrape:all -- --skip-score       (no score recalc)
 */
import { execSync } from 'child_process';
import { triggerMatchArtists } from '../lib/post-scrape-hook';

const args = process.argv.slice(2);
const skipScrapers = args.includes('--skip-scrapers');
const skipVenues = args.includes('--skip-venues');
const skipScore = args.includes('--skip-score');

function run(label: string, cmd: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  } catch (err) {
    console.error(`\n[scrape-all] "${label}" failed, continuing...\n`);
  }
}

async function main() {
  const start = Date.now();

  // 1. Regular scrapers
  if (!skipScrapers) {
    run('Step 1/3: Running 141 scrapers', 'npx tsx src/scripts/scrape.ts');
  } else {
    console.log('\nSkipping regular scrapers (--skip-scrapers)');
  }

  // 2. Venue feed ingestion
  if (!skipVenues) {
    run('Step 2/3: Venue feed ingestion (ICS/JSON-LD/RSS)', 'npx tsx --env-file=.env.local src/scripts/scrape-venues.ts');
  } else {
    console.log('\nSkipping venue scraping (--skip-venues)');
  }

  // 3. Score calculation
  if (!skipScore) {
    run('Step 3/3: Calculating event scores', 'npx tsx --env-file=.env.local src/scripts/calculate-scores.ts');
  } else {
    console.log('\nSkipping score calculation (--skip-score)');
  }

  // 4. Post-scrape hook: trigger artist-event matching
  if (!skipScrapers || !skipVenues) {
    run('Step 4: Artist-event matching', 'echo "Triggering match-artists Edge Function..."');
    await triggerMatchArtists();
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Done! Total time: ${elapsed} minutes`);
  console.log(`${'='.repeat(60)}\n`);
}

main();
