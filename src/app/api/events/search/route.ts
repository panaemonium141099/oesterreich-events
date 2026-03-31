import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Lightweight event search endpoint for chat inline search.
 * Returns minimal event data (max 10 results) for quick display.
 *
 * GET /api/events/search?q=<query>
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json({ events: [] });
  }

  // Sanitize search input: strip PostgREST special characters and SQL wildcards
  const sanitized = q.replace(/[,.*()%_\\]/g, '').trim();
  if (!sanitized) {
    return NextResponse.json({ events: [] });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_date, location_name, image_url, category')
      .or('visibility.eq.public,visibility.is.null')
      .gte('start_date', today)
      .or(`title.ilike.%${sanitized}%,location_name.ilike.%${sanitized}%`)
      .order('start_date', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Event search error:', error);
      return NextResponse.json(
        { error: 'Fehler bei der Event-Suche' },
        { status: 500 }
      );
    }

    return NextResponse.json({ events: data || [] });
  } catch (err) {
    console.error('Event search API error:', err);
    return NextResponse.json(
      { error: 'Fehler bei der Event-Suche' },
      { status: 500 }
    );
  }
}
