import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MIN_QUALITY = 40;
const EVENTS_LIMIT = 20;
const SIMILAR_LIMIT = 6;

function getReadClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * GET /api/venues/[id]
 * Returns venue details, upcoming events (chronological), and similar venues.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getReadClient();
  const today = new Date().toISOString().split('T')[0];

  // 1. Load venue
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select(
      'id, name, type, subtype, address, postal_code, city, bundesland, latitude, longitude, website, facebook_url, instagram_url, is_student_relevant, localness_score',
    )
    .eq('id', id)
    .single();

  if (venueError || !venue) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
  }

  // 2. Load upcoming events (chronological — venue page = Spielplan)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, count: totalEvents } = await (supabase.from('events') as any)
    .select(
      'id, title, start_date, end_date, location_name, image_url, category, price_text, price_min, event_score, quality_score',
      { count: 'exact' },
    )
    .eq('venue_id', id)
    .in('publish_status', ['published', 'published_low_confidence'])
    .gte('start_date', today)
    .gte('quality_score', MIN_QUALITY)
    .order('start_date', { ascending: true })
    .limit(EVENTS_LIMIT);

  // 3. Availability check: 404 if no qualifying events
  if (!totalEvents || totalEvents === 0) {
    return NextResponse.json(
      { error: 'Venue has no upcoming events' },
      { status: 404 },
    );
  }

  // 4. Load similar venues (same type + same city, with qualifying events)
  let similarVenues: unknown[] = [];
  if (venue.city && venue.type) {
    // Find venues of same type in same city
    const { data: candidates } = await supabase
      .from('venues')
      .select('id, name, type, city')
      .eq('type', venue.type)
      .ilike('city', venue.city)
      .neq('id', id)
      .limit(20);

    if (candidates && candidates.length > 0) {
      // Filter to venues with qualifying events
      const candidateIds = candidates.map((v: { id: string }) => v.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: venueEventCounts } = await (supabase.from('events') as any)
        .select('venue_id')
        .in('venue_id', candidateIds)
        .in('publish_status', ['published', 'published_low_confidence'])
        .gte('start_date', today)
        .gte('quality_score', MIN_QUALITY);

      const activeVenueIds = new Set(
        (venueEventCounts ?? []).map((e: { venue_id: string }) => e.venue_id),
      );

      similarVenues = candidates
        .filter((v: { id: string }) => activeVenueIds.has(v.id))
        .slice(0, SIMILAR_LIMIT);
    }

    // Fallback: same type + same bundesland if not enough
    if (similarVenues.length < 3 && venue.bundesland) {
      const { data: blCandidates } = await supabase
        .from('venues')
        .select('id, name, type, city')
        .eq('type', venue.type)
        .eq('bundesland', venue.bundesland)
        .neq('id', id)
        .limit(20);

      if (blCandidates && blCandidates.length > 0) {
        const existingIds = new Set(
          (similarVenues as { id: string }[]).map((v) => v.id),
        );
        const newCandidates = blCandidates.filter(
          (v: { id: string }) => !existingIds.has(v.id),
        );
        const newIds = newCandidates.map((v: { id: string }) => v.id);

        if (newIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newEventCounts } = await (supabase.from('events') as any)
            .select('venue_id')
            .in('venue_id', newIds)
            .in('publish_status', ['published', 'published_low_confidence'])
            .gte('start_date', today)
            .gte('quality_score', MIN_QUALITY);

          const newActiveIds = new Set(
            (newEventCounts ?? []).map((e: { venue_id: string }) => e.venue_id),
          );

          const additional = newCandidates
            .filter((v: { id: string }) => newActiveIds.has(v.id))
            .slice(0, SIMILAR_LIMIT - similarVenues.length);

          similarVenues = [...similarVenues, ...additional];
        }
      }
    }
  }

  const res = NextResponse.json({
    venue,
    events: events ?? [],
    totalEvents: totalEvents ?? 0,
    similarVenues,
  });
  // Venue-Detail (Spielplan + ähnliche Venues) ändert sich nur durch
  // neu-gescrapete Events — 5 min Edge + 10 min SWR.
  res.headers.set(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=600'
  );
  return res;
}
