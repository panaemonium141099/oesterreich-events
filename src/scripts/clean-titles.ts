// src/scripts/clean-titles.ts
//
// Batch-clean dirty event titles in Supabase.
// Targets gem2go, gemeinden-generic, gemeinde-registry, gemeinden sources.
//
// Usage:
//   npx tsx --env-file=.env.local src/scripts/clean-titles.ts --dry-run
//   npx tsx --env-file=.env.local src/scripts/clean-titles.ts

import { createClient } from '@supabase/supabase-js';
import { cleanTitle } from '@/lib/pipeline/title-cleaner';
import { isGarbageTitle } from '@/lib/pipeline/garbage-filter';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_SOURCES = ['gem2go', 'gemeinden-generic', 'gemeinde-registry', 'gemeinden'];

async function main() {
  console.log(`=== Title Cleanup ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`);

  let totalScanned = 0;
  let totalCleaned = 0;
  let totalGarbage = 0;
  let totalUnchanged = 0;
  const errors: string[] = [];

  for (const src of TARGET_SOURCES) {
    let offset = 0;
    let srcCleaned = 0;
    let srcGarbage = 0;
    let srcScanned = 0;

    while (true) {
      const { data, error } = await sb
        .from('events')
        .select('id,title,publish_status')
        .eq('source_name', src)
        .range(offset, offset + 499)
        .order('id');

      if (error) {
        errors.push(`${src} fetch error: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;

      const updates: { id: string; title: string }[] = [];
      const garbageIds: string[] = [];

      for (const e of data) {
        srcScanned++;
        if (!e.title) continue;

        const cleaned = cleanTitle(e.title);

        // Check if cleaned title is garbage
        if (isGarbageTitle(cleaned)) {
          if (e.publish_status !== 'suppressed' && e.publish_status !== 'duplicate') {
            garbageIds.push(e.id);
            srcGarbage++;
          }
          continue;
        }

        // Only update if title actually changed
        if (cleaned !== e.title.trim()) {
          updates.push({ id: e.id, title: cleaned });
          srcCleaned++;
        }
      }

      // Apply updates in batch
      if (!DRY_RUN && updates.length > 0) {
        for (const u of updates) {
          const { error: upErr } = await sb
            .from('events')
            .update({ title: u.title })
            .eq('id', u.id);
          if (upErr) errors.push(`Update ${u.id}: ${upErr.message}`);
        }
      }

      // Suppress garbage titles
      if (!DRY_RUN && garbageIds.length > 0) {
        for (let i = 0; i < garbageIds.length; i += 100) {
          const chunk = garbageIds.slice(i, i + 100);
          const { error: supErr } = await sb
            .from('events')
            .update({ publish_status: 'suppressed', quality_score: 0 })
            .in('id', chunk);
          if (supErr) errors.push(`Suppress: ${supErr.message}`);
        }
      }

      offset += data.length;
      if (data.length < 500) break;
    }

    totalScanned += srcScanned;
    totalCleaned += srcCleaned;
    totalGarbage += srcGarbage;
    totalUnchanged += srcScanned - srcCleaned - srcGarbage;

    console.log(`  ${src}: ${srcScanned} scanned, ${srcCleaned} cleaned, ${srcGarbage} garbage`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Total scanned: ${totalScanned}`);
  console.log(`  Titles cleaned: ${totalCleaned}`);
  console.log(`  Garbage suppressed: ${totalGarbage}`);
  console.log(`  Unchanged: ${totalUnchanged}`);
  if (errors.length > 0) {
    console.log(`  Errors: ${errors.length}`);
    for (const e of errors.slice(0, 10)) console.log(`    ${e}`);
  }
}

main();
