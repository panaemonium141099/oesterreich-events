/**
 * Quick test for the GemeindeRegistryScraper.
 * Run: npx tsx src/scripts/test-registry-scraper.ts
 */
import { GemeindeRegistryScraper } from '../lib/scrapers/GemeindeRegistryScraper';

async function main() {
  const scraper = new GemeindeRegistryScraper();
  console.log('Starting test scrape...\n');

  const events = await scraper.scrape();

  console.log('\n=== RESULTS ===');
  console.log(`Total events: ${events.length}`);

  // Group by location
  const byLocation: Record<string, number> = {};
  for (const e of events) {
    const key = e.location_name || 'unknown';
    byLocation[key] = (byLocation[key] || 0) + 1;
  }
  console.log('\nBy Gemeinde:');
  Object.entries(byLocation)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // Count images
  const withImages = events.filter(e => e.image_url).length;
  console.log(`\nWith images: ${withImages}/${events.length} (${Math.round(withImages / Math.max(events.length, 1) * 100)}%)`);

  // Sample events
  console.log('\nSample events:');
  events.slice(0, 10).forEach(e =>
    console.log(`  ${e.start_date.padEnd(20)} ${e.title.substring(0, 50).padEnd(52)} ${e.location_name?.padEnd(25)} ${e.image_url ? '[IMG]' : ''}`)
  );
}

main().catch(console.error);
