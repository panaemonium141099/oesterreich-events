import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Edge-cached: s-maxage in der Response bestimmt die TTL pro URL.
// Route bleibt automatisch dynamic wegen request.nextUrl.searchParams.

/** Lazy Supabase client -- validates env vars at call time, not module load time */
function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Service unavailable', code: 'ENV_MISSING' },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;

  // Pagination
  const limitParam = searchParams.get('limit');
  const requestedLimit = limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE;
  const limit = Math.min(Math.max(1, requestedLimit), MAX_PAGE_SIZE);
  const cursor = searchParams.get('cursor');

  // Filters
  const type = searchParams.get('type'); // bar, pub, nightclub, etc.
  const bundesland = searchParams.get('bundesland');
  const studentOnly = searchParams.get('student_only') === 'true';
  const hasEvents = searchParams.get('has_events') === 'true';
  const search = searchParams.get('search');

  // Bounding box filter: bbox=south_lat,west_lng,north_lat,east_lng
  const bboxParam = searchParams.get('bbox');
  let bbox: [number, number, number, number] | null = null;
  if (bboxParam) {
    const parts = bboxParam.split(',').map(Number);
    if (parts.length === 4 && parts.every(n => !isNaN(n))) {
      bbox = parts as [number, number, number, number];
    }
  }

  try {
    // Select columns for venue listing (omit large osm_tags by default)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseQuery = (supabase.from('venues') as any);
    let query = baseQuery.select(
      'id, name, type, subtype, address, postal_code, city, bundesland, latitude, longitude, website, event_feed_type, registry_source, is_student_relevant, localness_score, scrape_status, last_scraped_at',
      { count: 'exact' }
    );

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }

    if (bundesland && bundesland !== 'all') {
      query = query.eq('bundesland', bundesland);
    }

    if (studentOnly) {
      query = query.eq('is_student_relevant', true);
    }

    if (search) {
      const sanitized = search.replace(/[,.*()%_\\]/g, '').trim();
      if (sanitized) {
        query = query.or(
          `name.ilike.%${sanitized}%,city.ilike.%${sanitized}%,address.ilike.%${sanitized}%`
        );
      }
    }

    // Bounding box filter
    if (bbox) {
      const [southLat, westLng, northLat, eastLng] = bbox;
      query = query
        .gte('latitude', southLat)
        .lte('latitude', northLat)
        .gte('longitude', westLng)
        .lte('longitude', eastLng);
    }

    // has_events: only venues that have at least one associated event
    // We use an RPC or subquery approach -- filter venues where id exists in events.venue_id
    if (hasEvents) {
      // Get distinct venue_ids from events table
      const { data: venueIds } = await supabase
        .from('events')
        .select('venue_id')
        .not('venue_id', 'is', null);

      if (venueIds && venueIds.length > 0) {
        const uniqueIds = [...new Set(venueIds.map((r: { venue_id: string }) => r.venue_id))];
        query = query.in('id', uniqueIds);
      } else {
        // No venues have events -- return empty
        return NextResponse.json({
          venues: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        });
      }
    }

    // Order by name for stable cursor pagination
    query = query.order('name', { ascending: true });
    query = query.order('id', { ascending: true });

    // Cursor-based pagination
    if (cursor) {
      const { data: cursorVenue } = await supabase
        .from('venues')
        .select('name, id')
        .eq('id', cursor)
        .single();

      if (cursorVenue) {
        query = query.or(
          `name.gt.${cursorVenue.name},` +
          `and(name.eq.${cursorVenue.name},id.gt.${cursorVenue.id})`
        );
      }
    }

    // Fetch one extra to check for next page
    const fetchLimit = limit + 1;
    query = query.limit(fetchLimit);

    const { data: venues, error, count } = await query;

    if (error) {
      console.error('Supabase query error (venues):', error);
      return NextResponse.json(
        { error: 'Fehler beim Laden der Venues' },
        { status: 500 }
      );
    }

    const allFetched = venues || [];
    const hasMore = allFetched.length > limit;
    const pageVenues = hasMore ? allFetched.slice(0, limit) : allFetched;
    const nextCursor = hasMore && pageVenues.length > 0
      ? String((pageVenues[pageVenues.length - 1] as Record<string, unknown>).id)
      : null;

    const totalCount = count ?? 0;

    const response = NextResponse.json({
      venues: pageVenues,
      total: totalCount,
      nextCursor,
      hasMore,
    });

    // Venues sind Stammdaten — 1 h Edge + 24 h SWR.
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );
    response.headers.set('X-Total-Count', String(totalCount));
    if (nextCursor) {
      response.headers.set('X-Next-Cursor', nextCursor);
    }

    return response;
  } catch (err) {
    console.error('API Error (venues):', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Venues' },
      { status: 500 }
    );
  }
}
