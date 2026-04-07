import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface SourceMetrics {
  source_name: string;
  event_count: number;
  venue_match_count: number;
  venue_match_rate: number;
  earliest_event: string | null;
  latest_event: string | null;
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Check admin auth
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

    // Fetch all events with source_name, venue_id, and start_date
    const { data: events, error } = await supabase
      .from('events')
      .select('source_name, venue_id, start_date')
      .not('source_name', 'is', null);

    if (error) {
      console.error('Sources query error:', error);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    // Aggregate per source
    const sourceMap = new Map<
      string,
      {
        count: number;
        venueMatched: number;
        earliest: string | null;
        latest: string | null;
      }
    >();

    for (const e of events || []) {
      const name = e.source_name as string;
      let entry = sourceMap.get(name);
      if (!entry) {
        entry = { count: 0, venueMatched: 0, earliest: null, latest: null };
        sourceMap.set(name, entry);
      }
      entry.count++;
      if (e.venue_id) {
        entry.venueMatched++;
      }
      const date = e.start_date as string | null;
      if (date) {
        if (!entry.earliest || date < entry.earliest) entry.earliest = date;
        if (!entry.latest || date > entry.latest) entry.latest = date;
      }
    }

    const sources: SourceMetrics[] = Array.from(sourceMap.entries())
      .map(([source_name, data]) => ({
        source_name,
        event_count: data.count,
        venue_match_count: data.venueMatched,
        venue_match_rate:
          data.count > 0
            ? Math.round((data.venueMatched / data.count) * 100)
            : 0,
        earliest_event: data.earliest,
        latest_event: data.latest,
      }))
      .sort((a, b) => b.event_count - a.event_count);

    return NextResponse.json({ sources });
  } catch (err) {
    console.error('Admin sources error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
