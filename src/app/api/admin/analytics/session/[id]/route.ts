/**
 * GET /api/admin/analytics/session/[id]?limit=60
 *
 * Admin-only: die letzten Analytics-Events einer anonymen Sitzung (Drilldown
 * aus der "Anonyme Besucher"-Tabelle). Nur Events ohne user_id (eingeloggte
 * Aktivität läuft über den User-Drilldown).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const limit = Math.min(
    Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '60', 10)),
    200,
  );

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service role missing' }, { status: 500 });
  }
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data, error } = await svc
    .from('analytics_events')
    .select('event_type, event_data, page, created_at')
    .eq('session_id', id)
    .is('user_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[admin/analytics/session] query failed:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}
