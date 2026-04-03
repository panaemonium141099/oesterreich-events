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
const MAX_PAGE_SIZE = 200000;

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

  // Sort mode: 'date' (default) or 'score'
  const sortParam = searchParams.get('sort');
  if (sortParam === 'score') filters.sort = 'score';

  // Lightweight suggest mode: returns only id/title/category/location_name, skips exact count
  // Used by the autocomplete typeahead in FilterBar to avoid heavyweight DB queries on every keystroke
  const suggestMode = searchParams.get('suggest') === 'true';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseQuery = (supabase.from('events') as any);
    // Skip exact count for large queries — causes Supabase timeout on 77k+ events
    // Only count when: no cursor, limit small, AND a bundesland filter is set (not 'all')
    const hasBundeslandFilter = filters.bundesland && filters.bundesland !== 'all';
    const needsCount = !filters.cursor && (filters.limit <= 10000) && (hasBundeslandFilter || !!filters.search || !!filters.category);
    let query = suggestMode
      ? baseQuery.select('id, title, category, location_name')
      : baseQuery.select(
          'id, title, description, start_date, end_date, location_name, address, postal_code, district, bundesland, latitude, longitude, category, image_url, price_text, price_min, price_max, ticket_url, source_name, source_url, organizer, visibility, event_score',
          needsCount ? { count: 'exact' } : undefined
        );

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
      const sanitizedSearch = filters.search.replace(/[,.*()%_\\]/g, '').trim();
      if (sanitizedSearch) {
        // Synonym map: common German search terms → category names
        // Allows searching "festival" to return Nova Rock, Donauinselfest etc.
        const SEARCH_SYNONYMS: Record<string, string[]> = {
          festival: ['Musik', 'Feste & Brauchtum'],
          festivals: ['Musik', 'Feste & Brauchtum'],
          konzert: ['Musik'],
          konzerte: ['Musik'],
          rock: ['Musik'],
          metal: ['Musik'],
          jazz: ['Musik'],
          theater: ['Kultur'],
          kunst: ['Kultur'],
          ausstellung: ['Kultur'],
          kino: ['Kultur'],
          markt: ['Märkte'],
          märkte: ['Märkte'],
          flohmarkt: ['Märkte'],
          wein: ['Wein & Kulinarik'],
          kulinarik: ['Wein & Kulinarik'],
          essen: ['Wein & Kulinarik'],
          foodtruck: ['Wein & Kulinarik'],
          laufen: ['Sport'],
          rennen: ['Sport'],
          fußball: ['Sport'],
          schwimmen: ['Sport'],
          familie: ['Familie'],
          kinder: ['Familie'],
          wandern: ['Natur'],
          natur: ['Natur'],
          outdoor: ['Natur'],
          nightlife: ['Nightlife'],
          club: ['Nightlife'],
          party: ['Nightlife'],
          vortrag: ['Bildung'],
          seminar: ['Bildung'],
          yoga: ['Gesundheit'],
          gesundheit: ['Gesundheit'],
        };

        const normalized = sanitizedSearch.toLowerCase();
        const synonymCategories = SEARCH_SYNONYMS[normalized] ?? [];

        // Base search: title, location, description, category name
        let orClause = `title.ilike.%${sanitizedSearch}%,location_name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,category.ilike.%${sanitizedSearch}%`;

        // Append exact category matches for synonym terms
        for (const cat of synonymCategories) {
          // Escape commas in category name for PostgREST or-clause
          const safeCat = cat.replace(/,/g, '');
          orClause += `,category.eq.${safeCat}`;
        }

        query = query.or(orClause);
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

    if (filters.sort === 'score') {
      // Score sort: highest score first, then id descending for stability
      query = query.order('event_score', { ascending: false });
      query = query.order('id', { ascending: false });

      // Cursor-based pagination for score sort:
      // Use (event_score < cursor_score) OR (event_score = cursor_score AND id < cursor_id)
      if (filters.cursor) {
        const { data: cursorEvent } = await supabase
          .from('events')
          .select('event_score, id')
          .eq('id', filters.cursor)
          .single();

        if (cursorEvent) {
          const cursorScore = cursorEvent.event_score ?? 0;
          query = query.or(
            `event_score.lt.${cursorScore},` +
            `and(event_score.eq.${cursorScore},id.lt.${cursorEvent.id})`
          );
        }
      }
    } else {
      // Default: order by start_date, then id for stable cursor pagination
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

    // NOTE: Dedup moved to client-side. Server returns all events as-is
    // to not break cursor-based pagination (dedup was eating events and
    // causing the progressive loader to stop after ~6k of 77k events).
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
