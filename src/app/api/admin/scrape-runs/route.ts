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

    const source = searchParams.get('source');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

    // Build query
    let query = supabase
      .from('scrape_runs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (source) {
      query = query.eq('source_name', source);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: runs, count, error } = await query;

    if (error) {
      console.error('Scrape runs query error:', error);
      return NextResponse.json({ error: 'Fehler beim Laden der Scrape-Runs' }, { status: 500 });
    }

    return NextResponse.json({ runs: runs || [], total: count || 0 });
  } catch (err) {
    console.error('Scrape runs error:', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Scrape-Runs' }, { status: 500 });
  }
}
