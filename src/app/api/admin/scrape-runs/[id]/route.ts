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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Fetch the scrape run
    const { data: run, error: runError } = await supabase
      .from('scrape_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: 'Scrape-Run nicht gefunden' }, { status: 404 });
    }

    // Fetch associated raw events (limited to 100)
    const { data: rawEvents, error: rawError } = await supabase
      .from('raw_events')
      .select('*')
      .eq('scrape_run_id', id)
      .limit(100);

    if (rawError) {
      console.error('Raw events query error:', rawError);
    }

    return NextResponse.json({ run, rawEvents: rawEvents || [] });
  } catch (err) {
    console.error('Scrape run detail error:', err);
    return NextResponse.json({ error: 'Fehler beim Laden des Scrape-Runs' }, { status: 500 });
  }
}
