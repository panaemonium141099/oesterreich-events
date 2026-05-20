/**
 * End-to-end integration test for the Gem2GoScraper detail-fetch integration.
 *
 * Picks 3 gemeinden from the production list, runs the full scrape pipeline
 * including the new enrichEventsFromDetailPages() method, and prints each
 * resulting ScrapedEvent so we can verify which fields the detail-fetch
 * actually filled vs left untouched. Does NOT write to the DB.
 */

import { Gem2GoScraper } from '../lib/scrapers/Gem2GoScraper';
import { GEM2GO_GEMEINDEN } from '../lib/scrapers/gemeinden/gem2goGemeinden';

async function main() {
  // Pick 3 well-known gemeinden expected to have events: one with the rich
  // detail layout, one with the verticaltable minimal layout, one we know is
  // active.
  const TARGETS = ['Schruns', 'Mellau', 'Niederndorferberg'];
  const subset = GEM2GO_GEMEINDEN.filter((g) => TARGETS.includes(g.name));
  if (subset.length === 0) {
    console.log('No matching gemeinden — using first 3 from list');
    subset.push(...GEM2GO_GEMEINDEN.slice(0, 3));
  }
  console.log(`Testing against: ${subset.map((g) => g.name).join(', ')}\n`);

  const scraper = new Gem2GoScraper();
  // Swap in our subset via prototype override (the scraper's own constant is
  // imported above, which we can't mutate cleanly — easiest is monkey-patch the
  // module-level constant, but since it's exported as `const` we use the
  // subset variable directly via cast).
  // Cleaner alternative: run scrape() and let it hit all 2000, but that's
  // unacceptable for a smoke test. So we work around the encapsulation:
  const original = [...GEM2GO_GEMEINDEN];
  GEM2GO_GEMEINDEN.length = 0;
  GEM2GO_GEMEINDEN.push(...subset);

  let events: import('@/types/events').ScrapedEvent[] = [];
  try {
    events = await scraper.scrape();
  } finally {
    GEM2GO_GEMEINDEN.length = 0;
    GEM2GO_GEMEINDEN.push(...original);
  }

  console.log(`\n${events.length} events extracted total\n`);

  // Per-event detail
  for (const e of events) {
    const filled: string[] = [];
    const missing: string[] = [];
    const check = (label: string, val: unknown) => {
      if (val !== null && val !== undefined && String(val).length > 0) filled.push(label);
      else missing.push(label);
    };
    check('title', e.title);
    check('start_date', e.start_date);
    check('description', e.description);
    check('location_name', e.location_name);
    check('address', e.address);
    check('postal_code', e.postal_code);
    check('image_url', e.image_url);
    check('price_text', e.price_text);
    check('organizer', e.organizer);

    console.log(`─ ${e.title}`);
    console.log(`  source_url: ${e.source_url ?? '(none)'}`);
    console.log(`  filled: ${filled.join(', ')}`);
    console.log(`  missing: ${missing.join(', ')}`);
    if (e.address) console.log(`  → address: ${e.address}`);
    if (e.description) console.log(`  → description: ${e.description.slice(0, 120)}…`);
    if (e.price_text) console.log(`  → price: ${e.price_text}`);
    if (e.organizer) console.log(`  → organizer: ${e.organizer}`);
    if (e.image_url) console.log(`  → image: ${e.image_url.slice(0, 100)}`);
    console.log('');
  }

  // Aggregate
  const counts: Record<string, number> = {};
  const FIELDS = ['description', 'address', 'postal_code', 'image_url', 'price_text', 'organizer', 'location_name'];
  for (const f of FIELDS) counts[f] = 0;
  for (const e of events) {
    for (const f of FIELDS) {
      const v = (e as unknown as Record<string, unknown>)[f];
      if (v !== null && v !== undefined && String(v).length > 0) counts[f]++;
    }
  }
  console.log('─────── AGGREGATE ───────');
  console.log(`Total events from ${subset.length} gemeinden: ${events.length}`);
  for (const f of FIELDS) {
    const pct = events.length > 0 ? ((counts[f] / events.length) * 100).toFixed(0) : '0';
    console.log(`  ${f.padEnd(20)} ${counts[f]}/${events.length}  (${pct}%)`);
  }

  // Dump URLs of events without price — so the user can manually verify
  // whether the page actually has price info we missed, or the page truly
  // lacks it.
  const noPrice = events.filter((e) => !e.price_text);
  console.log(`\n─────── ${noPrice.length} events WITHOUT price_text ───────`);
  // Dedupe by source_url (recurring events repeat the same URL across dates)
  const seen = new Set<string>();
  for (const e of noPrice) {
    if (!e.source_url || seen.has(e.source_url)) continue;
    seen.add(e.source_url);
    console.log(`${e.source_url}`);
    console.log(`  title: ${e.title}`);
  }
  console.log(`(${seen.size} unique URLs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
