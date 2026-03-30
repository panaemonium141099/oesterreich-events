import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { EventFilters } from '@/types/events';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const filters: EventFilters = {};

  const bundesland = searchParams.get('bundesland');
  if (bundesland) filters.bundesland = bundesland;

  const district = searchParams.get('district');
  if (district) filters.district = district;

  const category = searchParams.get('category');
  if (category) filters.category = category;

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

  const limit = searchParams.get('limit');
  if (limit) filters.limit = parseInt(limit, 10);

  const offset = searchParams.get('offset');
  if (offset) filters.offset = parseInt(offset, 10);

  try {
    // Build the query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabase
      .from('events')
      .select('id, title, description, start_date, end_date, location_name, address, postal_code, district, bundesland, latitude, longitude, category, image_url, price_text, price_min, price_max, source_name, source_url, organizer, visibility', { count: 'exact' }) as any;

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

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.dateFrom) {
      query = query.gte('start_date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('start_date', filters.dateTo + 'T23:59:59');
    }

    if (filters.search) {
      // Sanitize search input: strip PostgREST special characters to prevent filter injection
      const sanitizedSearch = filters.search.replace(/[,.*()]/g, '').trim();
      if (sanitizedSearch) {
        query = query.or(`title.ilike.%${sanitizedSearch}%,location_name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
      }
    }

    if (filters.priceMin !== undefined) {
      query = query.or(`price_min.gte.${filters.priceMin},price_min.is.null`);
    }

    if (filters.priceMax !== undefined) {
      query = query.or(`price_max.lte.${filters.priceMax},price_max.is.null`);
    }

    // Evening only: filter for events starting at 17:00 or later
    // We handle this client-side since Supabase doesn't have easy time extraction
    // But we can use a workaround: events with time >= 17:00 on their start_date

    // Order by start_date
    query = query.order('start_date', { ascending: true });

    // Single request — Supabase max rows must be set to 50000 in dashboard
    // Settings → API → Max Rows
    const queryLimit = filters.limit || 50000;
    const queryOffset = filters.offset || 0;
    query = query.range(queryOffset, queryOffset + queryLimit - 1);

    const { data: events, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Fehler beim Laden der Events' },
        { status: 500 }
      );
    }

    // Client-side evening filter (events starting at 17:00 or later)
    let filteredEvents = events || [];
    if (filters.eveningOnly) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filteredEvents = filteredEvents.filter((event: any) => {
        const startDate = String(event.start_date || '');
        if (!startDate) return false;
        if (!startDate.includes('T')) return true;
        const hour = new Date(startDate).getHours();
        if (hour === 0) return true; // Unknown time
        return hour >= 17;
      });
    }

    return NextResponse.json({
      events: filteredEvents,
      total: filters.eveningOnly ? filteredEvents.length : (count ?? 0),
    });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Events' },
      { status: 500 }
    );
  }
}
