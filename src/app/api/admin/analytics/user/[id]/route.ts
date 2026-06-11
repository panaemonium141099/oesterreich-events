/**
 * GET /api/admin/analytics/user/[id]?limit=50
 *
 * Admin-only: die letzten Analytics-Events eines einzelnen Nutzers (Drilldown
 * aus der Nutzer-Aktivitäts-Tabelle). Zeigt die Roh-Aktivität: Typ, Seite,
 * Daten, Zeitpunkt.
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
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[admin/analytics/user] query failed:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}
