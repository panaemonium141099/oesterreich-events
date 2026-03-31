/**
 * Apply pending Supabase migrations.
 * Checks if the migration has already been applied; if not, prints the SQL to run manually.
 *
 * Usage: tsx --env-file=.env.local src/scripts/apply-migration.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('Checking migration status...\n');

  // Check if event_score column exists
  const { error } = await supabase
    .from('events')
    .select('event_score')
    .limit(1);

  if (!error) {
    console.log('✓ Migration 20260401_add_event_score: already applied');
    console.log('\nAll migrations up to date. Run `npm run score` to calculate event scores.');
    return;
  }

  console.log('✗ Migration 20260401_add_event_score: NOT applied\n');
  console.log('Please run the following SQL in your Supabase Dashboard > SQL Editor:\n');
  console.log('─'.repeat(60));
  console.log(`ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_score float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_events_score_desc
  ON events (event_score DESC);`);
  console.log('─'.repeat(60));
  console.log('\nThen run `npm run score` to calculate event scores.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
