/**
 * Backfill slugs for existing events.
 *
 * Loads all events without a slug, generates one from title + location_name,
 * and writes back in batches.
 *
 * Usage:
 *   npm run backfill-slugs                # write
 *   npm run backfill-slugs -- --dry-run   # no DB writes, just report
 *
 * Implementation notes:
 * - Query pattern is "drain the filter set": `WHERE slug IS NULL LIMIT N`
 *   (no offset). Each batch's updates remove those rows from the filter set,
 *   so offset-based pagination would skip rows. The previous version had
 *   this bug and under-processed data silently after the first batch.
 * - Updates are issued in parallel via `Promise.all` within each batch so
 *   a single batch of 500 completes in ~1s instead of ~50s.
 * - Idempotent: re-running after completion is a one-query no-op.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local manually — tsx doesn't pull it in automatically when the
// script isn't invoked via the `--env-file` flag.
try {
  const envPath = join(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.substring(0, i).trim();
    const v = t.substring(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* .env.local absent, fall back to ambient env */ }

import { createClient } from '@supabase/supabase-js';
import { generateEventSlug } from '../lib/utils/slugify';

const BATCH_SIZE = 500;
const CONCURRENT_UPDATES = 25; // how many UPDATEs in flight at once

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  let processed = 0;
  let updated = 0;
  let errors = 0;
  const startedAt = Date.now();

  console.log(`Backfilling slugs${dryRun ? ' (DRY RUN)' : ''}, batch size ${BATCH_SIZE}...`);

  // Drain the filter set — always select the first N rows WHERE slug IS NULL.
  // As we fill slugs, rows drop out of the filter and the next batch just
  // gets the next N still-NULL rows. No offset needed.
  while (true) {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, location_name')
      .is('slug', null)
      .order('id')
      .limit(BATCH_SIZE);

    if (error) {
      console.error('Query error:', error.message);
      break;
    }

    if (!events || events.length === 0) break;

    const updates = events.map((event) => ({
      id: event.id as string,
      slug: generateEventSlug(
        event.title as string,
        event.location_name as string | null,
      ),
    }));

    if (!dryRun) {
      // Issue updates in parallel pools of CONCURRENT_UPDATES to keep Supabase
      // connection count reasonable while still finishing each 500-row batch
      // in about a second.
      for (let i = 0; i < updates.length; i += CONCURRENT_UPDATES) {
        const chunk = updates.slice(i, i + CONCURRENT_UPDATES);
        const results = await Promise.all(
          chunk.map((u) =>
            supabase.from('events').update({ slug: u.slug }).eq('id', u.id),
          ),
        );
        for (const r of results) {
          if (r.error) {
            errors += 1;
            if (errors < 10) console.error(`update error: ${r.error.message}`);
          } else {
            updated += 1;
          }
        }
      }
    } else {
      updated += updates.length;
    }

    processed += events.length;

    const elapsed = (Date.now() - startedAt) / 1000;
    const rate = processed / Math.max(elapsed, 0.001);
    process.stdout.write(
      `  processed=${processed} updated=${updated} errors=${errors} ` +
      `rate=${rate.toFixed(0)}/s\r`,
    );

    // If the DB returned fewer rows than the batch size we know the set is
    // drained. Saves one extra round-trip at the end.
    if (events.length < BATCH_SIZE) break;
  }

  const elapsed = (Date.now() - startedAt) / 1000;
  process.stdout.write('\n');
  console.log(
    `Done. processed=${processed} updated=${updated} errors=${errors} ` +
    `elapsed=${elapsed.toFixed(1)}s${dryRun ? ' (dry run)' : ''}`,
  );
}

main().catch((err) => {
  console.error('backfill-slugs failed:', err);
  process.exit(1);
});
