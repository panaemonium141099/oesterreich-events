import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);
    const cursor = searchParams.get('cursor'); // overall_score cursor for pagination

    // Query uncertain pairs from dedup log
    let query = supabase
      .from('event_dedup_log')
      .select('*', { count: 'exact' })
      .eq('decision', 'uncertain')
      .order('overall_score', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('overall_score', parseFloat(cursor));
    }

    const { data: logEntries, count, error } = await query;

    if (error) {
      console.error('Uncertain queue query error:', error);
      return NextResponse.json({ error: 'Failed to load uncertain queue' }, { status: 500 });
    }

    const entries = logEntries || [];
    const hasMore = entries.length > limit;
    const items = hasMore ? entries.slice(0, limit) : entries;

    // Collect all event IDs to fetch titles
    const eventIds = new Set<string>();
    for (const entry of items) {
      eventIds.add(entry.event_a_id);
      eventIds.add(entry.event_b_id);
    }

    // Fetch event titles and sources
    const { data: events } = await supabase
      .from('events')
      .select('id,title,source_name,start_date,location_name,publish_status')
      .in('id', Array.from(eventIds));

    const eventsMap = new Map(
      (events || []).map((e: { id: string; title: string; source_name: string | null; start_date: string; location_name: string | null; publish_status: string | null }) => [e.id, e])
    );

    // Build response items with event details
    const pairs = items.map((entry) => {
      const eventA = eventsMap.get(entry.event_a_id);
      const eventB = eventsMap.get(entry.event_b_id);
      return {
        id: entry.id,
        event_a_id: entry.event_a_id,
        event_b_id: entry.event_b_id,
        event_a_title: eventA?.title ?? 'Unknown',
        event_a_source: eventA?.source_name ?? null,
        event_a_date: eventA?.start_date ?? null,
        event_a_location: eventA?.location_name ?? null,
        event_b_title: eventB?.title ?? 'Unknown',
        event_b_source: eventB?.source_name ?? null,
        event_b_date: eventB?.start_date ?? null,
        event_b_location: eventB?.location_name ?? null,
        title_score: entry.title_score,
        datetime_score: entry.datetime_score,
        venue_score: entry.venue_score,
        geo_score: entry.geo_score,
        url_score: entry.url_score,
        overall_score: entry.overall_score,
        decision: entry.decision,
      };
    });

    const nextCursor = hasMore && items.length > 0
      ? String(items[items.length - 1].overall_score)
      : null;

    return NextResponse.json({
      pairs,
      total: count ?? 0,
      nextCursor,
    });
  } catch (err) {
    console.error('Uncertain queue error:', err);
    return NextResponse.json({ error: 'Failed to load uncertain queue' }, { status: 500 });
  }
}
