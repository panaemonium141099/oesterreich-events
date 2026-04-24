import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

    let query = supabase
      .from('pipeline_runs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: runs, count, error } = await query;

    if (error) {
      console.error('Pipeline runs query error:', error);
      return NextResponse.json({ error: 'Fehler beim Laden der Pipeline-Runs' }, { status: 500 });
    }

    return NextResponse.json({ runs: runs || [], total: count || 0 });
  } catch (err) {
    console.error('Pipeline runs error:', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Pipeline-Runs' }, { status: 500 });
  }
}
