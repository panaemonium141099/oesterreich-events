// src/app/api/admin/scraper-health/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: stats, error } = await supabase
      .from('scraper_stats')
      .select('scraper_name, status, events_found, duration_ms, started_at')
      .gte('started_at', sevenDaysAgo)
      .order('started_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const byName: Record<string, {
      runs: number;
      failures: number;
      last_success_at: string | null;
      last_events_found: number;
      total_duration_ms: number;
    }> = {};

    for (const row of stats || []) {
      if (!byName[row.scraper_name]) {
        byName[row.scraper_name] = {
          runs: 0,
          failures: 0,
          last_success_at: null,
          last_events_found: 0,
          total_duration_ms: 0,
        };
      }
      const entry = byName[row.scraper_name];
      if (row.status !== 'skipped') {
        entry.runs++;
        entry.total_duration_ms += row.duration_ms || 0;
      }
      if (row.status === 'failed') entry.failures++;
      if (row.status === 'success' && !entry.last_success_at) {
        entry.last_success_at = row.started_at;
        entry.last_events_found = row.events_found;
      }
    }

    const scrapers = Object.entries(byName).map(([name, data]) => {
      let health: 'healthy' | 'degraded' | 'failing' | 'inactive';
      if (data.runs === 0) health = 'inactive';
      else if (data.failures >= 3) health = 'failing';
      else if (data.failures >= 1) health = 'degraded';
      else health = 'healthy';

      return {
        name,
        display_name: name,
        category: 'Sonstige',
        last_success_at: data.last_success_at,
        last_events_found: data.last_events_found,
        runs_last_7d: data.runs,
        failures_last_7d: data.failures,
        avg_duration_ms: data.runs > 0 ? Math.round(data.total_duration_ms / data.runs) : 0,
        health,
      };
    });

    const healthOrder: Record<string, number> = { failing: 0, degraded: 1, healthy: 2, inactive: 3 };
    scrapers.sort((a, b) => (healthOrder[a.health] ?? 4) - (healthOrder[b.health] ?? 4));

    return NextResponse.json({ scrapers });
  } catch (err) {
    console.error('Scraper health error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
