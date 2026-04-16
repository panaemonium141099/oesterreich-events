/**
 * One-time cleanup: delete false-positive artist_event_notifications
 * where the artist name is only a substring of a longer word in the event title.
 */
import { createClient } from '@supabase/supabase-js';
import { isFalsePositiveMatch } from '../lib/artist-matching';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get all notifications with joined event title
  const { data: all } = await supabase
    .from('artist_event_notifications')
    .select('id, artist_name, match_score, match_source, events!inner(title)')
    .limit(5000);

  console.log('Total notifications to check:', all?.length || 0);

  let deleted = 0;
  for (const n of all || []) {
    const title = (n.events as any)?.title || '';
    if (isFalsePositiveMatch(n.artist_name, title)) {
      await supabase.from('artist_event_notifications').delete().eq('id', n.id);
      console.log(`  DELETED: "${n.artist_name}" vs "${title.slice(0, 60)}" (${n.match_source}, score=${n.match_score})`);
      deleted++;
    }
  }

  console.log(`\nDeleted ${deleted} false-positive notifications`);
}

main().catch(console.error);
