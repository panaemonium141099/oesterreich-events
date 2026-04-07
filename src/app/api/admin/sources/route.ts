import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();

    // Fetch all scrape runs for aggregation
    const { data: runs, error: runsError } = await supabase
      .from('scrape_runs')
      .select('source_name, status, avg_quality_score, started_at, items_inserted, parser_errors');

    if (runsError) {
      console.error('Sources scrape_runs query error:', runsError);
      return NextResponse.json({ error: 'Fehler beim Laden der Quellen' }, { status: 500 });
    }

    // Fetch event counts per source from events table
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('source_name')
      .not('source_name', 'is', null);

    if (eventError) {
      console.error('Sources events query error:', eventError);
      return NextResponse.json({ error: 'Fehler beim Laden der Quellen' }, { status: 500 });
    }

    // Count events per source
    const eventCounts: Record<string, number> = {};
    (eventData || []).forEach((e: { source_name: string | null }) => {
      if (e.source_name) {
        eventCounts[e.source_name] = (eventCounts[e.source_name] || 0) + 1;
      }
    });

    // Aggregate scrape run metrics per source
    const sourceMap: Record<string, {
      source_name: string;
      total_runs: number;
      success_count: number;
      error_count: number;
      avg_quality_score: number | null;
      last_run_at: string | null;
      total_events_inserted: number;
      avg_parser_errors: number;
      total_events: number;
    }> = {};

    (runs || []).forEach((run: {
      source_name: string;
      status: string;
      avg_quality_score: number | null;
      started_at: string;
      items_inserted: number | null;
      parser_errors: number | null;
    }) => {
      const name = run.source_name;
      if (!sourceMap[name]) {
        sourceMap[name] = {
          source_name: name,
          total_runs: 0,
          success_count: 0,
          error_count: 0,
          avg_quality_score: null,
          last_run_at: null,
          total_events_inserted: 0,
          avg_parser_errors: 0,
          total_events: eventCounts[name] || 0,
        };
      }

      const src = sourceMap[name];
      src.total_runs++;

      if (run.status === 'success' || run.status === 'completed') {
        src.success_count++;
      } else if (run.status === 'error' || run.status === 'failed') {
        src.error_count++;
      }

      // Track quality scores for averaging
      if (run.avg_quality_score != null) {
        if (src.avg_quality_score === null) {
          src.avg_quality_score = run.avg_quality_score;
        } else {
          // Running average
          src.avg_quality_score =
            (src.avg_quality_score * (src.total_runs - 1) + run.avg_quality_score) / src.total_runs;
        }
      }

      // Last run
      if (!src.last_run_at || run.started_at > src.last_run_at) {
        src.last_run_at = run.started_at;
      }

      // Sum inserted events
      src.total_events_inserted += run.items_inserted || 0;

      // Sum parser errors for averaging later
      src.avg_parser_errors += run.parser_errors || 0;
    });

    // Finalize averages
    const sources = Object.values(sourceMap).map((src) => {
      if (src.total_runs > 0) {
        src.avg_parser_errors = src.avg_parser_errors / src.total_runs;
      }
      if (src.avg_quality_score !== null) {
        src.avg_quality_score = Math.round(src.avg_quality_score * 100) / 100;
      }
      src.avg_parser_errors = Math.round(src.avg_parser_errors * 100) / 100;
      return src;
    });

    // Sort by last_run_at descending
    sources.sort((a, b) => {
      if (!a.last_run_at && !b.last_run_at) return 0;
      if (!a.last_run_at) return 1;
      if (!b.last_run_at) return -1;
      return b.last_run_at.localeCompare(a.last_run_at);
    });

    return NextResponse.json({ sources });
  } catch (err) {
    console.error('Sources error:', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Quellen' }, { status: 500 });
  }
}
