/**
 * GET /api/saved-events
 *
 * Returns the current user's bookmarked events (rows in `saved_events`),
 * joined with the underlying event details needed to render an event card.
 *
 * Ordered by saved_events.created_at DESC so the most-recently-merked
 * event shows up first — matches the user's mental model of "what did
 * I just save".
 *
 * Auth required (Supabase session cookie). Returns 401 otherwise so the
 * /saved client can redirect to login.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('saved_events')
    .select(`
      id,
      created_at,
      event:events (
        id, title, start_date, location_name, postal_code, district,
        bundesland, latitude, longitude, image_url, ticket_url, category
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[saved-events] query failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Drop rows where the joined event no longer exists (cascade should
  // prevent this, but defensive).
  const items = (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      saved_at: r.created_at,
      ...r.event,
    }));

  return NextResponse.json({ items });
}
