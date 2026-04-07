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

    // Count distinct clusters
    const { count: totalClusters } = await supabase
      .from('events')
      .select('dedup_cluster_id', { count: 'exact', head: true })
      .not('dedup_cluster_id', 'is', null)
      .not('duplicate_of', 'is', null);

    // Count events that are in clusters (marked as duplicate)
    const { count: eventsInClusters } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('publish_status', 'duplicate');

    // Count uncertain entries in dedup log
    const { count: uncertainCount } = await supabase
      .from('event_dedup_log')
      .select('id', { count: 'exact', head: true })
      .eq('decision', 'uncertain');

    // Count garbage-suppressed events (suppressed with quality_score = 0)
    const { count: garbageSuppressed } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('publish_status', 'suppressed')
      .eq('quality_score', 0);

    return NextResponse.json({
      totalClusters: totalClusters ?? 0,
      eventsInClusters: eventsInClusters ?? 0,
      uncertainCount: uncertainCount ?? 0,
      garbageSuppressed: garbageSuppressed ?? 0,
    });
  } catch (err) {
    console.error('Dedup stats error:', err);
    return NextResponse.json({ error: 'Failed to load dedup stats' }, { status: 500 });
  }
}
