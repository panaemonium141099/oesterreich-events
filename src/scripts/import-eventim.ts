/**
 * Eventim PFT feed importer.
 *
 *   npx tsx src/scripts/import-eventim.ts --dry-run --verbose
 *   npx tsx src/scripts/import-eventim.ts --limit 50
 *
 * Env: EVENTIM_FEED_URL (optional), EVENTIM_FEED_USER, EVENTIM_FEED_PASS,
 *      plus Supabase env for the non-dry-run write path.
 */
import { downloadEventimFeed } from '@/lib/eventim/feed-client';
import { parseEventimFeed } from '@/lib/eventim/parse';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? '') : undefined;
}
const hasFlag = (name: string) => process.argv.includes(name);

async function main() {
  const dryRun = hasFlag('--dry-run');
  const verbose = hasFlag('--verbose');
  const limitStr = arg('--limit');
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  console.log('[eventim] downloading feed…');
  const series = await downloadEventimFeed();
  console.log(`[eventim] ${series.length} series downloaded`);

  let events = parseEventimFeed(series, new Date().toISOString());
  console.log(`[eventim] ${events.length} events after filtering (future, ticket, non-cancelled, AT/DE/CH)`);

  if (limit && events.length > limit) {
    events = events.slice(0, limit);
    console.log(`[eventim] limited to ${events.length}`);
  }

  // Distribution snapshot
  const byCountry: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let bookable = 0;
  for (const e of events) {
    byCountry[e.country ?? '?'] = (byCountry[e.country ?? '?'] ?? 0) + 1;
    byCategory[e.category ?? '?'] = (byCategory[e.category ?? '?'] ?? 0) + 1;
    if (e.ticket_url) bookable++;
  }
  console.log('[eventim] by country:', byCountry);
  console.log('[eventim] by category:', byCategory);
  console.log(`[eventim] bookable (ticket_url set): ${bookable}/${events.length}`);

  if (verbose || dryRun) {
    console.log('\n[eventim] sample events:');
    for (const e of events.slice(0, 3)) {
      console.log(JSON.stringify(
        { source_id: e.source_id, title: e.title, start_date: e.start_date, country: e.country,
          category: e.category, tags: e.tags, price_text: e.price_text, ticket_url: e.ticket_url,
          location_name: e.location_name, lat: e.latitude, lng: e.longitude }, null, 2));
    }
  }

  if (dryRun) {
    console.log('\n[eventim] DRY RUN — no DB writes.');
    return;
  }

  const { syncEventsToSupabase } = await import('@/lib/db/supabase-sync');
  const BATCH = 500;
  let upserted = 0, errors = 0, filtered = 0;
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    const r = await syncEventsToSupabase(batch);
    upserted += r.upserted; errors += r.errors; filtered += r.filtered;
    console.log(`[eventim] batch ${i / BATCH + 1}: +${r.upserted} (${r.errors} err, ${r.filtered} filtered)`);
  }
  console.log(`[eventim] DONE — ${upserted} upserted, ${errors} errors, ${filtered} filtered`);
}

main().catch((e) => { console.error(e); process.exit(1); });
