import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();

    // Fetch all events with relevant fields for stats computation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events, error } = await (supabase.from('events') as any)
      .select('quality_score, publish_status, source_name, venue_id, latitude, longitude, description, image_url')
      .limit(100000);

    if (error) {
      console.error('[quality-stats] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const allEvents = (events ?? []) as Array<{
      quality_score: number | null;
      publish_status: string | null;
      source_name: string | null;
      venue_id: string | null;
      latitude: number | null;
      longitude: number | null;
      description: string | null;
      image_url: string | null;
    }>;

    const total = allEvents.length;

    // --- Score distribution ---
    const buckets = { '0-20': 0, '20-40': 0, '40-60': 0, '60-80': 0, '80-100': 0, 'null': 0 };
    let qualitySum = 0;
    let qualityCount = 0;

    for (const e of allEvents) {
      const qs = e.quality_score;
      if (qs === null || qs === undefined) {
        buckets['null']++;
      } else {
        qualitySum += qs;
        qualityCount++;
        if (qs < 20) buckets['0-20']++;
        else if (qs < 40) buckets['20-40']++;
        else if (qs < 60) buckets['40-60']++;
        else if (qs < 80) buckets['60-80']++;
        else buckets['80-100']++;
      }
    }

    const avgQuality = qualityCount > 0 ? Math.round(qualitySum / qualityCount) : 0;

    // --- Publish status counts ---
    const statusCounts: Record<string, number> = {};
    for (const e of allEvents) {
      const status = e.publish_status ?? 'null';
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    }

    // --- Source quality ---
    const sourceMap = new Map<string, { sum: number; count: number }>();
    for (const e of allEvents) {
      const src = e.source_name ?? 'unknown';
      const entry = sourceMap.get(src);
      const qs = e.quality_score ?? 0;
      if (entry) {
        entry.sum += qs;
        entry.count++;
      } else {
        sourceMap.set(src, { sum: qs, count: 1 });
      }
    }

    const sourceQuality = Array.from(sourceMap.entries())
      .map(([name, { sum, count }]) => ({
        source_name: name,
        event_count: count,
        avg_quality: Math.round(sum / count),
      }))
      .sort((a, b) => b.avg_quality - a.avg_quality);

    // --- Coverage metrics ---
    let withVenue = 0;
    let withCoords = 0;
    let withDescription = 0;
    let withImage = 0;

    for (const e of allEvents) {
      if (e.venue_id) withVenue++;
      if (e.latitude !== null && e.longitude !== null) withCoords++;
      if (e.description) withDescription++;
      if (e.image_url) withImage++;
    }

    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

    const response = {
      overall: {
        total,
        avgQuality,
        scoreBuckets: buckets,
      },
      publishStatus: statusCounts,
      sourceQuality,
      coverage: {
        withVenue: pct(withVenue),
        withCoords: pct(withCoords),
        withDescription: pct(withDescription),
        withImage: pct(withImage),
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[quality-stats] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
