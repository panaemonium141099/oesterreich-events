import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import {
  computeTrustScoreFromMetrics,
  aggregateMetrics,
  type SourceTrustScore,
} from '@/lib/pipeline/source-trust';

export async function GET() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();
    const today = new Date().toISOString().slice(0, 10);

    // Fetch all events with the fields we need (paginated for large tables)
    const allEvents: Array<Record<string, unknown>> = [];
    let from = 0;
    const pageSize = 5000;

    while (true) {
      const { data, error } = await supabase
        .from('events')
        .select('source_name, quality_score, venue_id, publish_status, latitude, longitude, description, image_url, ticket_url, start_date')
        .not('source_name', 'is', null)
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Source trust query error:', error);
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      allEvents.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Group by source_name
    const sourceMap = new Map<string, Array<Record<string, unknown>>>();
    for (const e of allEvents) {
      const name = e.source_name as string;
      let list = sourceMap.get(name);
      if (!list) {
        list = [];
        sourceMap.set(name, list);
      }
      list.push(e);
    }

    // Compute trust scores
    const results: SourceTrustScore[] = [];
    const entries = Array.from(sourceMap.entries());
    for (const [sourceName, events] of entries) {
      const metrics = aggregateMetrics(events as Parameters<typeof aggregateMetrics>[0], today);
      const score = computeTrustScoreFromMetrics(sourceName, metrics);
      results.push(score);
    }

    // Sort by trust score descending
    results.sort((a, b) => b.trustScore - a.trustScore);

    return NextResponse.json({ sources: results, totalEvents: allEvents.length });
  } catch (err) {
    console.error('Source trust API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
