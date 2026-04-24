import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: run, error: runError } = await supabase
      .from('pipeline_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: 'Pipeline-Run nicht gefunden' }, { status: 404 });
    }

    const { data: scraperStats, error: statsError } = await supabase
      .from('scraper_stats')
      .select('*')
      .eq('run_id', id)
      .order('started_at', { ascending: true });

    if (statsError) {
      console.error('Scraper stats query error:', statsError);
    }

    return NextResponse.json({ run, scraper_stats: scraperStats || [] });
  } catch (err) {
    console.error('Pipeline run detail error:', err);
    return NextResponse.json({ error: 'Fehler beim Laden des Pipeline-Runs' }, { status: 500 });
  }
}
