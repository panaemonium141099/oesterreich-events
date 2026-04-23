import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { EventFilters } from '@/types/events';
import { computeStudentScore, isFreeEvent, MIN_STUDENT_SCORE } from '@/lib/utils/student-score';

// Force dynamic — never cache event data server-side
export const dynamic = 'force-dynamic';

/** Lazy Supabase client — validates env vars at call time, not module load time */
function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Default and maximum page sizes for cursor-based pagination */
const DEFAULT_PAGE_SIZE = 50;

/** Synonym map: common German search terms → category names (module-level, allocated once) */
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
const MAX_PAGE_SIZE = 5000;

/** Compute a relevance score combining quality and recency (0-100). */
function computeRelevance(event: Record<string, unknown>, nowMs: number): number {
  const qualityScore = typeof event.event_score === 'number' ? event.event_score : 0;

  // Recency: how soon the event starts (0-7 days: 1.0, 7-30: 0.7, 30+: 0.4)
  let recency = 0.4;
  const startDate = event.start_date;
  if (typeof startDate === 'string') {
    const daysUntil = (new Date(startDate).getTime() - nowMs) / 86_400_000;
    if (daysUntil <= 7) recency = 1.0;
    else if (daysUntil <= 30) recency = 0.7;
  }

  // Weighted combination: quality * 0.7 + recency * 0.3 (scaled to 100)
  return qualityScore * 0.7 + recency * 100 * 0.3;
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Service unavailable', code: 'ENV_MISSING' },
      { status: 503 }
    );
  }

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

  // ── Enrichment filters (from Claude classification) ──
  const studentFriendly = searchParams.get('studentFriendly');
  if (studentFriendly === 'true') filters.studentFriendly = true;

  const familyFriendly = searchParams.get('familyFriendly');
  if (familyFriendly === 'true') filters.familyFriendly = true;

  const priceTier = searchParams.get('priceTier');
  if (priceTier && ['gratis', 'günstig', 'mittel', 'premium', 'unbekannt'].includes(priceTier)) {
    filters.priceTier = priceTier as NonNullable<typeof filters.priceTier>;
  }

  const audience = searchParams.get('audience');
  if (audience) filters.audience = audience.split(',').map(t => t.trim()).filter(Boolean);

  const vibe = searchParams.get('vibe');
  if (vibe) filters.vibe = vibe.split(',').map(t => t.trim()).filter(Boolean);

  const setting = searchParams.get('setting');
  if (setting) filters.setting = setting.split(',').map(t => t.trim()).filter(Boolean);

  // v3: Anlass-Tags (ausgehen, date-night, afterwork, saufen-gehen, …).
  // Comma-separated. Matches events whose occasion_tags overlap ANY.
  const occasion = searchParams.get('occasion');
  if (occasion) filters.occasion = occasion.split(',').map(t => t.trim()).filter(Boolean);

  // v3: Binary price/barrier flags (happy-hour, studentenrabatt, barrierefrei, …).
  // Comma-separated. Matches events whose price_flags overlap ANY.
  const priceFlagsParam = searchParams.get('priceFlags');
  if (priceFlagsParam) filters.priceFlags = priceFlagsParam.split(',').map(t => t.trim()).filter(Boolean);

  const language = searchParams.get('language');
  if (language && ['deutsch', 'dialekt', 'englisch', 'mehrsprachig', 'ohne-sprache'].includes(language)) {
    filters.language = language as NonNullable<typeof filters.language>;
  }

  // Pagination params
  const limitParam = searchParams.get('limit');
  const requestedLimit = limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE;
  filters.limit = Math.min(Math.max(1, requestedLimit), MAX_PAGE_SIZE);

  const cursor = searchParams.get('cursor');
  if (cursor) filters.cursor = cursor;

  // Legacy offset support (backwards compatible)
  const offset = searchParams.get('offset');
  if (offset) filters.offset = parseInt(offset, 10);

  // Sort mode: 'date' (default), 'score', or 'relevance'
  const sortParam = searchParams.get('sort');
  if (sortParam === 'score') filters.sort = 'score';
  if (sortParam === 'relevance') filters.sort = 'relevance';

  // Source name filter (god-role only — no auth check here, UI hides it for non-god)
  const sourceName = searchParams.get('sourceName');

  // Venue-centric filters
  const venueId = searchParams.get('venue_id');
  if (venueId) filters.venueId = venueId;

  const studentOnly = searchParams.get('student_only');
  if (studentOnly === 'true') filters.studentOnly = true;

  const localnessMin = searchParams.get('localness_min');
  if (localnessMin) filters.localnessMin = parseInt(localnessMin, 10);

  // Quality gate for landing page pagination parity
  const minQuality = searchParams.get('minQuality');

  // City filter for landing page pagination parity (venue.city + address fallback)
  const cityFilter = searchParams.get('city');

  // Student score mode: compute student relevance at query time, filter/sort by score
  const studentScoreMode = searchParams.get('studentScore') === 'true';

  // Free-only filter: only events with explicitly known free price
  const freeOnly = searchParams.get('freeOnly') === 'true';

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

  // Include unmapped events (NULL coordinates) in a separate array
  const includeUnmapped = searchParams.get('includeUnmapped') === 'true';

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
          'id, title, description, start_date, end_date, location_name, address, postal_code, district, bundesland, latitude, longitude, category, tags, image_url, price_text, price_min, price_max, ticket_url, source_name, source_url, organizer, visibility, event_score, slug, ' +
          'audience, vibe, setting, language, price_tier, duration_type, is_student_friendly, is_family_friendly, suggested_description, suggested_price_text, ' +
          'occasion_tags, price_flags',
          needsCount ? { count: 'exact' } : undefined
        );

    // Only show public events (scraped events default to 'public')
    query = query.or('visibility.eq.public,visibility.is.null');

    // Publish status filter: by default only show published or low-confidence events
    // Admin/god users can pass includeAll=true to see all statuses
    const includeAll = searchParams.get('includeAll') === 'true';
    if (!includeAll) {
      query = query.or('publish_status.eq.published,publish_status.eq.published_low_confidence,publish_status.is.null');
    }

    // Only show future/current events by default
    const today = new Date().toISOString().slice(0, 10);
    query = query.gte('start_date', today);

    // Only show events within Austria (exclude German/Swiss events from Feratel etc.)
    // Austria bounding box: lat 46.3-49.1, lng 9.5-17.2
    // Also exclude 0,0 coordinates (not geocoded)
    query = query.gte('latitude', 46.3).lte('latitude', 49.1).gte('longitude', 9.5).lte('longitude', 17.2);

    // Apply filters
    if (filters.bundesland && filters.bundesland !== 'all') {
      query = query.eq('bundesland', filters.bundesland);
    }

    if (filters.district) {
      query = query.eq('district', filters.district);
    }

    if (sourceName) {
      query = query.eq('source_name', sourceName);
    }

    // Venue-centric filters
    if (filters.venueId) {
      query = query.eq('venue_id', filters.venueId);
    }

    if (filters.studentOnly || filters.localnessMin) {
      // Both student_only and localness_min require a venue lookup.
      // Fetch qualifying venue IDs, then filter events by those.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let venueQuery = (supabase.from('venues') as any).select('id');

      if (filters.studentOnly) {
        venueQuery = venueQuery.eq('is_student_relevant', true);
      }
      if (filters.localnessMin) {
        venueQuery = venueQuery.gte('localness_score', filters.localnessMin);
      }

      const { data: qualifyingVenues } = await venueQuery;

      if (qualifyingVenues && qualifyingVenues.length > 0) {
        const venueIds = qualifyingVenues.map((v: { id: string }) => v.id);
        query = query.in('venue_id', venueIds);
      } else {
        // No venues match criteria -- return empty
        const res = NextResponse.json({ events: [], total: 0, nextCursor: null, hasMore: false });
        res.headers.set('X-Total-Count', '0');
        return res;
      }
    }

    // Quality gate: minimum quality_score (for landing page pagination parity)
    if (minQuality) {
      const minQ = parseInt(minQuality, 10);
      if (!isNaN(minQ)) {
        query = query.gte('quality_score', minQ);
      }
    }

    // City filter: deterministic city matching via venue.city + address fallback
    if (cityFilter) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cityVenues } = await (supabase.from('venues') as any)
        .select('id')
        .ilike('city', cityFilter);

      const cityVenueIds = (cityVenues ?? []).map((v: { id: string }) => v.id);

      if (cityVenueIds.length > 0) {
        // Events at matching venues OR events with city in address
        query = query.or(
          `venue_id.in.(${cityVenueIds.join(',')}),address.ilike.%${cityFilter}%`,
        );
      } else {
        // No venues match — fall back to address-only matching
        query = query.ilike('address', `%${cityFilter}%`);
      }
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

    // ── Enrichment filters ──
    // These apply to events classified by the Claude-based enrichment
    // step. Events without enrichment data fall out of these filters —
    // acceptable because the wizard-type UX these power is only
    // meaningful against enriched rows anyway.
    if (filters.studentFriendly) {
      query = query.eq('is_student_friendly', true);
    }
    if (filters.familyFriendly) {
      query = query.eq('is_family_friendly', true);
    }
    if (filters.priceTier) {
      query = query.eq('price_tier', filters.priceTier);
    }
    if (filters.language) {
      query = query.eq('language', filters.language);
    }
    if (filters.audience && filters.audience.length > 0) {
      // PostgREST `ov` operator on text[] columns (GIN-indexed):
      // matches when the column shares ANY element with the filter list.
      query = query.overlaps('audience', filters.audience);
    }
    if (filters.vibe && filters.vibe.length > 0) {
      query = query.overlaps('vibe', filters.vibe);
    }
    if (filters.setting && filters.setting.length > 0) {
      query = query.overlaps('setting', filters.setting);
    }
    // v3 additions — occasion_tags + price_flags. Same `ov` semantics.
    if (filters.occasion && filters.occasion.length > 0) {
      query = query.overlaps('occasion_tags', filters.occasion);
    }
    if (filters.priceFlags && filters.priceFlags.length > 0) {
      query = query.overlaps('price_flags', filters.priceFlags);
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

    if (filters.sort === 'relevance') {
      // Relevance sort: fetch by score descending, then re-rank in memory
      // combining quality_score * 0.7 + recency * 0.3
      // (interaction_popularity deferred until event_interactions table exists)
      query = query.order('event_score', { ascending: false, nullsFirst: false });
      query = query.order('id', { ascending: false });

      // Cursor-based pagination uses same logic as score sort
      if (filters.cursor) {
        const { data: cursorEvent } = await supabase
          .from('events')
          .select('event_score, id')
          .eq('id', filters.cursor)
          .single();

        if (cursorEvent) {
          const cursorScore = cursorEvent.event_score;
          if (cursorScore !== null && cursorScore !== undefined && cursorScore > 0) {
            query = query.or(
              `event_score.lt.${cursorScore},` +
              `and(event_score.eq.${cursorScore},id.lt.${cursorEvent.id}),` +
              `event_score.is.null`
            );
          } else if (cursorScore !== null && cursorScore !== undefined) {
            query = query.or(
              `and(event_score.eq.0,id.lt.${cursorEvent.id}),` +
              `event_score.is.null`
            );
          } else {
            query = query.or(
              `and(event_score.is.null,id.lt.${cursorEvent.id})`
            );
          }
        }
      }
    } else if (filters.sort === 'score') {
      // Score sort: highest score first (NULLS LAST), then id descending for stability
      query = query.order('event_score', { ascending: false, nullsFirst: false });
      query = query.order('id', { ascending: false });

      // Cursor-based pagination for score sort:
      // NULL scores are treated as 0 via COALESCE semantics.
      // Use (score < cursor_score) OR (score = cursor_score AND id < cursor_id)
      // For NULL scores: (score IS NULL AND cursor_score > 0) OR (score IS NULL AND cursor_score = 0 AND id < cursor_id)
      if (filters.cursor) {
        const { data: cursorEvent } = await supabase
          .from('events')
          .select('event_score, id')
          .eq('id', filters.cursor)
          .single();

        if (cursorEvent) {
          const cursorScore = cursorEvent.event_score;
          if (cursorScore !== null && cursorScore !== undefined && cursorScore > 0) {
            // Cursor has a positive score. Include: lower scores, same score + lower id, all NULLs
            query = query.or(
              `event_score.lt.${cursorScore},` +
              `and(event_score.eq.${cursorScore},id.lt.${cursorEvent.id}),` +
              `event_score.is.null`
            );
          } else if (cursorScore !== null && cursorScore !== undefined) {
            // Cursor score is exactly 0 (non-null). Include: same score(0) + lower id, all NULLs
            query = query.or(
              `and(event_score.eq.0,id.lt.${cursorEvent.id}),` +
              `event_score.is.null`
            );
          } else {
            // Cursor score IS NULL. Continue within the NULL block: only lower ids.
            query = query.or(
              `and(event_score.is.null,id.lt.${cursorEvent.id})`
            );
          }
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
    // Student score mode loads all candidates (offset-paged after scoring in JS)
    const fetchLimit = studentScoreMode ? 500 : filters.limit + 1;
    if (filters.offset && !filters.cursor && !studentScoreMode) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allFetched: any[] = events || [];

    // Relevance re-ranking: combine quality_score and recency in memory
    if (filters.sort === 'relevance' && allFetched.length > 0) {
      const now = Date.now();
      allFetched = [...allFetched].sort((a, b) => {
        const scoreA = computeRelevance(a as Record<string, unknown>, now);
        const scoreB = computeRelevance(b as Record<string, unknown>, now);
        return scoreB - scoreA;
      });
    }

    // Free-only filter: only events with explicitly known free price
    if (freeOnly) {
      allFetched = allFetched.filter((e) =>
        isFreeEvent(e as { price_min: number | null; price_text: string | null }),
      );
    }

    // Student score mode: compute score, filter, sort, offset-paginate
    if (studentScoreMode) {
      const scored = allFetched
        .map((e) => {
          const ev = e as Record<string, unknown>;
          return {
            event: e,
            studentScore: computeStudentScore({
              title: String(ev.title ?? ''),
              category: (ev.category as string) ?? null,
              price_min: (ev.price_min as number) ?? null,
              price_text: (ev.price_text as string) ?? null,
              start_date: String(ev.start_date ?? ''),
            }),
          };
        })
        .filter((s) => s.studentScore >= MIN_STUDENT_SCORE);

      // Sort by studentScore DESC, then start_date ASC (for time-critical contexts),
      // then event_score DESC as tiebreaker
      scored.sort((a, b) => {
        if (b.studentScore !== a.studentScore) return b.studentScore - a.studentScore;
        const aDate = new Date(String((a.event as Record<string, unknown>).start_date)).getTime();
        const bDate = new Date(String((b.event as Record<string, unknown>).start_date)).getTime();
        if (aDate !== bDate) return aDate - bDate;
        return ((b.event as Record<string, unknown>).event_score as number ?? 0) -
               ((a.event as Record<string, unknown>).event_score as number ?? 0);
      });

      // Offset pagination (not cursor — score is computed at query time)
      const offsetVal = filters.offset ?? 0;
      const studentTotal = scored.length;
      const studentPage = scored.slice(offsetVal, offsetVal + filters.limit);
      const studentHasMore = offsetVal + filters.limit < studentTotal;

      const responseBody = {
        events: studentPage.map((s) => s.event),
        total: studentTotal,
        hasMore: studentHasMore,
        nextCursor: null, // offset-based, no cursor
      };

      const response = NextResponse.json(responseBody);
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      response.headers.set('X-Total-Count', String(studentTotal));
      return response;
    }

    const hasMore = allFetched.length > filters.limit;
    const pageEvents = hasMore ? allFetched.slice(0, filters.limit) : allFetched;
    const nextCursor = hasMore && pageEvents.length > 0
      ? String((pageEvents[pageEvents.length - 1] as Record<string, unknown>).id)
      : null;

    const totalCount = count ?? 0;

    // Fetch unmapped events (NULL coordinates) separately when requested
    // These are NOT mixed into the main bbox-filtered results
    let unmappedEvents: unknown[] | undefined;
    if (includeUnmapped && !suggestMode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let unmappedQuery = (supabase.from('events') as any).select(
        'id, title, description, start_date, end_date, location_name, address, postal_code, district, bundesland, latitude, longitude, category, image_url, price_text, price_min, price_max, ticket_url, source_name, source_url, organizer, visibility, event_score, slug'
      );
      unmappedQuery = unmappedQuery.or('visibility.eq.public,visibility.is.null');
      if (!includeAll) {
        unmappedQuery = unmappedQuery.or('publish_status.eq.published,publish_status.eq.published_low_confidence,publish_status.is.null');
      }
      unmappedQuery = unmappedQuery.gte('start_date', today);
      // Match events where either coordinate is NULL
      unmappedQuery = unmappedQuery.or('latitude.is.null,longitude.is.null');

      // Apply same content filters (bundesland, category, search) but NOT bbox
      if (filters.bundesland && filters.bundesland !== 'all') {
        unmappedQuery = unmappedQuery.eq('bundesland', filters.bundesland);
      }
      if (filters.category) {
        unmappedQuery = unmappedQuery.eq('category', filters.category);
      }
      if (filters.search) {
        const sanitizedSearch = filters.search.replace(/[,.*()%_\\]/g, '').trim();
        if (sanitizedSearch) {
          const normalized = sanitizedSearch.toLowerCase();
          const synonymCategories = SEARCH_SYNONYMS[normalized] ?? [];
          let orClause = `title.ilike.%${sanitizedSearch}%,location_name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,category.ilike.%${sanitizedSearch}%`;
          for (const cat of synonymCategories) {
            const safeCat = cat.replace(/,/g, '');
            orClause += `,category.eq.${safeCat}`;
          }
          unmappedQuery = unmappedQuery.or(orClause);
        }
      }

      unmappedQuery = unmappedQuery.order('start_date', { ascending: true }).limit(200);

      const { data: unmappedData } = await unmappedQuery;
      unmappedEvents = unmappedData || [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseBody: Record<string, any> = {
      events: pageEvents,
      total: totalCount,
      nextCursor,
      hasMore,
    };
    if (unmappedEvents !== undefined) {
      responseBody.unmappedEvents = unmappedEvents;
    }

    const response = NextResponse.json(responseBody);

    // Prevent stale browser cache — events change frequently (scraper runs, coord fixes)
    response.headers.set('Cache-Control', 'no-store, max-age=0');

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
