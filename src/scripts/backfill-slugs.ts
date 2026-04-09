/**
 * Backfill slugs for existing events.
 *
 * Loads all events without a slug, generates one from title + location_name,
 * and writes back in batches.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-slugs.ts
 *   npx tsx src/scripts/backfill-slugs.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { generateEventSlug } from '../lib/utils/slugify';

const BATCH_SIZE = 500;

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
  let offset = 0;
  let hasMore = true;

  console.log(`Backfilling slugs${dryRun ? ' (DRY RUN)' : ''}...`);

  while (hasMore) {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, location_name')
      .is('slug', null)
      .order('id')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Query error:', error);
      break;
    }

    if (!events || events.length === 0) {
      hasMore = false;
      break;
    }

    const updates: { id: string; slug: string }[] = [];

    for (const event of events) {
      const slug = generateEventSlug(event.title, event.location_name);
      updates.push({ id: event.id, slug });
    }

    if (!dryRun && updates.length > 0) {
      // Batch update via individual updates (Supabase doesn't support bulk upsert on non-PK)
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('events')
          .update({ slug: update.slug })
          .eq('id', update.id);

        if (updateError) {
          console.error(`Failed to update ${update.id}:`, updateError.message);
        } else {
          updated++;
        }
      }
    } else {
      updated += updates.length;
    }

    processed += events.length;
    offset += BATCH_SIZE;

    if (processed % 5000 === 0) {
      console.log(`  Processed: ${processed}, Updated: ${updated}`);
    }

    // Avoid rate limiting
    if (!dryRun) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log(`Done. Processed: ${processed}, Updated: ${updated}${dryRun ? ' (dry run)' : ''}`);
}

main().catch(console.error);
