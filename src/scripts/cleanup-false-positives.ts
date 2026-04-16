/**
 * Cleanup false positive artist-event matches.
 *
 * Scans all entries in artist_event_notifications, applies the current
 * isFalsePositiveMatch() filter against the event title, and removes
 * entries that would be rejected by today's filter logic.
 *
 * Also cleans up corresponding notifications in the notifications table.
 *
 * Usage:
 *   npx tsx src/scripts/cleanup-false-positives.ts --dry-run   # Preview only
 *   npx tsx src/scripts/cleanup-false-positives.ts              # Actually delete
 */

import { createClient } from '@supabase/supabase-js';
import { isFalsePositiveMatch } from '@/lib/artist-matching';

const BATCH_SIZE = 500;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  console.log(`=== Cleanup False Positive Matches ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletes)' : 'LIVE (will delete!)'}\n`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Fetch ALL artist_event_notifications with their event titles
  console.log('Fetching all artist_event_notifications...');
  let allRows: Array<{
    id: string;
    user_id: string;
    event_id: string;
    artist_name: string;
    match_score: number;
    match_source: string;
    events: { title: string; source_type: string | null };
  }> = [];

  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('artist_event_notifications')
      .select(`
        id, user_id, event_id, artist_name, match_score, match_source,
        events!inner (title, source_type)
      `)
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error('Fetch error:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allRows.push(...(data as any[]));
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  console.log(`Found ${allRows.length} total match entries\n`);

  // 2. Apply isFalsePositiveMatch to each entry
  const falsePositives: typeof allRows = [];
  const legitimate: typeof allRows = [];

  for (const row of allRows) {
    const eventTitle = row.events?.title || '';
    const isFP = isFalsePositiveMatch(row.artist_name, eventTitle);

    if (isFP) {
      falsePositives.push(row);
    } else {
      legitimate.push(row);
    }
  }

  console.log(`Legitimate matches: ${legitimate.length}`);
  console.log(`False positives found: ${falsePositives.length}\n`);

  if (falsePositives.length === 0) {
    console.log('No false positives to clean up!');
    return;
  }

  // 3. Print false positives
  console.log('=== FALSE POSITIVES ===');
  for (const fp of falsePositives) {
    console.log(`  "${fp.artist_name}" → "${fp.events?.title}" (${fp.match_source}, score: ${fp.match_score})`);
  }
  console.log('');

  if (verbose) {
    console.log('=== LEGITIMATE MATCHES (kept) ===');
    for (const m of legitimate) {
      console.log(`  "${m.artist_name}" → "${m.events?.title}" (${m.match_source}, score: ${m.match_score})`);
    }
    console.log('');
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would delete ${falsePositives.length} false positive entries.`);
    return;
  }

  // 4. Delete false positive artist_event_notifications
  console.log(`Deleting ${falsePositives.length} false positive match entries...`);
  const fpIds = falsePositives.map(fp => fp.id);

  for (let i = 0; i < fpIds.length; i += BATCH_SIZE) {
    const batch = fpIds.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('artist_event_notifications')
      .delete()
      .in('id', batch);

    if (error) {
      console.error('Delete error:', error);
    }
  }
  console.log('Deleted match entries.');

  // 5. Delete corresponding notifications (type = 'spotify_match' for the same user+event)
  console.log('Cleaning up corresponding notifications...');
  let notifDeleted = 0;

  // Group FPs by user_id+event_id to find notifications to remove
  // Only delete if ALL matches for that user+event are false positives
  const fpKeys = new Set(falsePositives.map(fp => `${fp.user_id}:${fp.event_id}`));
  const legitKeys = new Set(legitimate.map(m => `${m.user_id}:${m.event_id}`));

  // Only delete notifications where there are NO remaining legitimate matches
  const notifToDelete = [...fpKeys].filter(key => !legitKeys.has(key));

  for (const key of notifToDelete) {
    const [userId, eventId] = key.split(':');
    const { error, count } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .eq('type', 'spotify_match');

    if (error) {
      console.error(`Notification delete error for ${key}:`, error);
    } else {
      notifDeleted += count ?? 0;
    }
  }

  console.log(`Deleted ${notifDeleted} orphaned notifications.`);

  // 6. Summary
  console.log(`\n=== CLEANUP COMPLETE ===`);
  console.log(`  Match entries deleted: ${falsePositives.length}`);
  console.log(`  Notifications deleted: ${notifDeleted}`);
  console.log(`  Remaining legitimate matches: ${legitimate.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
