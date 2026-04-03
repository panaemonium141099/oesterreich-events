import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required — refusing to fall back to anon key which bypasses RLS');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const limitParam = searchParams.get('limit');
  const limit = limitParam
    ? Math.min(Math.max(1, parseInt(limitParam, 10)), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const bundesland = searchParams.get('bundesland');

  try {
    const today = new Date().toISOString().slice(0, 10);

    let query = supabase
      .from('events')
      .select(
        'id, title, description, start_date, end_date, location_name, address, postal_code, district, bundesland, latitude, longitude, category, image_url, price_text, price_min, price_max, ticket_url, source_name, source_url, organizer, visibility, event_score',
        { count: 'exact' }
      )
      .or('visibility.eq.public,visibility.is.null')
      .gte('start_date', today)
      .gt('event_score', 30)
      .order('event_score', { ascending: false })
      .limit(limit);

    if (bundesland && bundesland !== 'all') {
      query = query.eq('bundesland', bundesland);
    }

    const { data: events, error, count } = await query;

    if (error) {
      console.error('Supabase query error (featured):', error);
      return NextResponse.json(
        { error: 'Fehler beim Laden der Featured Events' },
        { status: 500 }
      );
    }

    const res = NextResponse.json({
      events: events ?? [],
      total: count ?? 0,
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (err) {
    console.error('API Error (featured):', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Featured Events' },
      { status: 500 }
    );
  }
}
