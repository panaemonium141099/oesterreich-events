import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Verify the caller is an authenticated admin/god user. Returns null on success, or an error Response. */
async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const severity = searchParams.get('severity');
    const flagType = searchParams.get('flagType');
    const resolved = searchParams.get('resolved');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

    // Build query - join with events to get title and source_name
    let query = supabase
      .from('quality_flags')
      .select('*, events!inner(title, source_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (severity) {
      query = query.eq('severity', severity);
    }
    if (flagType) {
      query = query.eq('flag_type', flagType);
    }
    if (resolved === 'true') {
      query = query.not('resolved_at', 'is', null);
    } else if (resolved === 'false') {
      query = query.is('resolved_at', null);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Quality flags query error:', error);
      return NextResponse.json({ error: 'Fehler beim Laden der Quality-Flags' }, { status: 500 });
    }

    // Flatten the joined event data
    const flags = (data || []).map((flag) => {
      const { events, ...rest } = flag as Record<string, unknown>;
      const eventData = events as { title: string; source_name: string } | null;
      return {
        ...rest,
        event_title: eventData?.title || null,
        event_source: eventData?.source_name || null,
      };
    });

    return NextResponse.json({ flags, total: count || 0 });
  } catch (err) {
    console.error('Quality flags error:', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Quality-Flags' }, { status: 500 });
  }
}
