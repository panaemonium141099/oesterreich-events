/**
 * One-time migration endpoint — adds event_score column to events table.
 *
 * Authentication: requireAdmin() (admin/god rolle, konsistent mit allen
 * anderen /api/admin/* routes). Vorher wurde ein Bearer-Token mit dem
 * SUPABASE_SERVICE_ROLE_KEY geprüft — das war die einzige inkonsistente
 * Auth-Methode, weshalb der Pentest sie als "M2: inkonsistent" flaggte.
 *
 * POST /api/admin/migrate
 * Body: { "migration": "add_event_score" }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase/require-admin';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const migration = body.migration as string;

  if (migration === 'add_event_score') {
    // Apply the event_score migration using raw postgres via Supabase RPC
    // We use an upsert trick: try to select the column to detect its presence
    const { error: checkError } = await supabase
      .from('events')
      .select('event_score')
      .limit(1);

    if (!checkError) {
      return NextResponse.json({ message: 'Column event_score already exists — no migration needed.' });
    }

    // Column doesn't exist — need to apply DDL
    // Supabase PostgREST doesn't support DDL directly; use pg_net or rpc
    return NextResponse.json({
      error: 'Cannot apply DDL via REST API. Please run this SQL in Supabase Dashboard > SQL Editor:',
      sql: [
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS event_score float DEFAULT 0;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS score_updated_at timestamptz;",
        "CREATE INDEX IF NOT EXISTS idx_events_score_desc ON events (event_score DESC);"
      ].join('\n'),
    }, { status: 422 });
  }

  return NextResponse.json({ error: 'Unknown migration' }, { status: 400 });
}
