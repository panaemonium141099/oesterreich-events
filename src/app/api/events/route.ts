import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { EventFilters } from '@/types/events';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required — refusing to fall back to anon key which bypasses RLS');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Default and maximum page sizes for cursor-based pagination */
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50000;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const filters: EventFilters = {};

  const bundesland = searchParams.get('bundesland');
  if (bundesland) filters.bundesland = bundesland;

  const district = searchParams.get('district');
  if (district) filters.district = district;

  const category = searchParams.get('category');
  if (category) filters.category = category;

  const tags = searchParams.get('tags');
  if (tags) filters.tags = tags.split(',').map(t => t.trim()).filter(Boolean);

  const dateFrom = searchParams.get('dateFrom');
  if (dateFrom) filters.dateFrom = dateFrom;

  const dateTo = searchParams.get('dateTo');
  if (dateTo) filters.dateTo = dateTo;

  const priceMin = searchParams.get('priceMin');
  if (priceMin) filters.priceMin = parseFloat(priceMin);

  const priceMax = searchParams.get('priceMax');
  if (priceMax) filters.priceMax = parseFloat(priceMax);

  const search = searchParams.get('search');
  if (search) filters.search = search;

  const eveningOnly = searchParams.get('eveningOnly');
  if (eveningOnly === 'true') filters.eveningOnly = true;

  // Pagination params
  const limitParam = searchParams.get('limit');
  const requestedLimit = limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE;
  filters.limit = Math.min(Math.max(1, requestedLimit), MAX_PAGE_SIZE);

  const cursor = searchParams.get('cursor');
  if (cursor) filters.cursor = cursor;

  // Legacy offset support (backwards compatible)
  const offset = searchParams.get('offset');
  if (offset) filters.offset = parseInt(offset, 10);

  // Bounding box filter: bbox=south_lat,west_lng,north_lat,east_lng
  const bboxParam = searchParams.get('bbox');
  if (bboxParam) {
    const parts = bboxParam.split(',').map(Number);
    if (parts.length === 4 && parts.every(n => !isNaN(n))) {
      filters.bbox = parts as [number, number, number, number];
    }
  }

  try {
    // Build the query — use untyped Supabase client (no Database generic),
    // so the chained filter methods return Record<string, unknown> rows
    let query = supabase
      .from('events')
      .select('id, title, description, start_date, end_date, location_name, address, postal_code, district, bundesland, latitude, longitude, category, image_url, price_text, price_min, price_max, source_name, source_url, organizer, visibility', { count: 'exact' });

    // Only show public events (scraped events default to 'public')
    query = query.or('visibility.eq.public,visibility.is.null');

    // Only show future/current events by default
    const today = new Date().toISOString().slice(0, 10);
    query = query.gte('start_date', today);

    // Apply filters
    if (filters.bundesland && filters.bundesland !== 'all') {
      query = query.eq('bundesland', filters.bundesland);
    }

    if (filters.district) {
      query = query.eq('district', filters.district);
    }

    if (filters.tags && filters.tags.length > 0) {
      // Multi-tag filter: find events that have ANY of the specified tags
      // Uses the event_tags junction table via a subquery
      const { data: taggedEventIds } = await supabase
        .from('event_tags')
        .select('event_id')
        .in('tag', filters.tags);

      if (taggedEventIds && taggedEventIds.length > 0) {
        const ids = taggedEventIds.map((r: { event_id: string }) => r.event_id);
        query = query.in('id', ids);
      } else {
        // No events match the tags — return empty
        const res = NextResponse.json({ events: [], total: 0 });
        res.headers.set('X-Total-Count', '0');
        return res;
      }
    } else if (filters.category) {
      // Backwards compatible: single category filter on the events table
      query = query.eq('category', filters.category);
    }

    if (filters.dateFrom) {
      query = query.gte('start_date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('start_date', filters.dateTo + 'T23:59:59');
    }

    if (filters.search) {
      // Sanitize search input: strip PostgREST special characters and SQL wildcards
      // to prevent filter injection and unintended ILIKE pattern matching
      const sanitizedSearch = filters.search.replace(/[,.*()%_\\]/g, '').trim();
      if (sanitizedSearch) {
        query = query.or(`title.ilike.%${sanitizedSearch}%,location_name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
      }
    }

    // Price filters intentionally include events with null prices (free/unpriced events)
    // so users searching by price range still see free events in results
    if (filters.priceMin !== undefined) {
      query = query.or(`price_min.gte.${filters.priceMin},price_min.is.null`);
    }

    if (filters.priceMax !== undefined) {
      query = query.or(`price_max.lte.${filters.priceMax},price_max.is.null`);
    }

    // Evening filter at database level: events starting at 17:00 or later
    // Uses start_date::time cast in PostgreSQL via Supabase RPC or filter
    // Since Supabase PostgREST doesn't support time extraction directly,
    // we use a workaround: filter where start_date contains 'T17', 'T18', ..., 'T23'
    // or has no time component (date-only events are included)
    if (filters.eveningOnly) {
      // Events with time >= 17:00 OR no time component (date-only, kept for backwards compat)
      // PostgREST supports gte on text-cast timestamps
      query = query.or(
        'start_date.like.*T17:%,' +
        'start_date.like.*T18:%,' +
        'start_date.like.*T19:%,' +
        'start_date.like.*T20:%,' +
        'start_date.like.*T21:%,' +
        'start_date.like.*T22:%,' +
        'start_date.like.*T23:%,' +
        'start_date.not.like.*T%'
      );
    }

    // Bounding box filter for viewport-based loading
    if (filters.bbox) {
      const [southLat, westLng, northLat, eastLng] = filters.bbox;
      query = query
        .gte('latitude', southLat)
        .lte('latitude', northLat)
        .gte('longitude', westLng)
        .lte('longitude', eastLng);
    }

    // Order by start_date, then id for stable cursor pagination
    query = query.order('start_date', { ascending: true });
    query = query.order('id', { ascending: true });

    // Cursor-based pagination: fetch events after the cursor event
    if (filters.cursor) {
      // Look up the cursor event's start_date to position the query
      const { data: cursorEvent } = await supabase
        .from('events')
        .select('start_date, id')
        .eq('id', filters.cursor)
        .single();

      if (cursorEvent) {
        // Get events that come after the cursor in sort order:
        // (start_date > cursor_date) OR (start_date = cursor_date AND id > cursor_id)
        query = query.or(
          `start_date.gt.${cursorEvent.start_date},` +
          `and(start_date.eq.${cursorEvent.start_date},id.gt.${cursorEvent.id})`
        );
      }
    }

    // Apply limit (fetch one extra to determine if there's a next page)
    const fetchLimit = filters.limit + 1;
    if (filters.offset && !filters.cursor) {
      // Legacy offset support
      query = query.range(filters.offset, filters.offset + fetchLimit - 1);
    } else {
      query = query.limit(fetchLimit);
    }

    const { data: events, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Fehler beim Laden der Events' },
        { status: 500 }
      );
    }

    const allFetched = events || [];
    const hasMore = allFetched.length > filters.limit;
    const pageEvents = hasMore ? allFetched.slice(0, filters.limit) : allFetched;
    const nextCursor = hasMore && pageEvents.length > 0
      ? String((pageEvents[pageEvents.length - 1] as Record<string, unknown>).id)
      : null;

    const totalCount = count ?? 0;

    const response = NextResponse.json({
      events: pageEvents,
      total: totalCount,
      nextCursor,
      hasMore,
    });

    // Pagination metadata headers
    response.headers.set('X-Total-Count', String(totalCount));
    if (nextCursor) {
      response.headers.set('X-Next-Cursor', nextCursor);
    }

    return response;
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Events' },
      { status: 500 }
    );
  }
}
