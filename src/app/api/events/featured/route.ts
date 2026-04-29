import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

    // Featured events require quality_score >= 50 and prefer events with image + description.
    // visibility + publish_status sind seit 2026-04-29 NOT NULL — kein OR IS NULL mehr nötig.
    // count='estimated' statt 'exact' weil Top-Events-Carousel die Total-Zahl nicht anzeigt.
    let query = supabase
      .from('events')
      .select(
        'id, slug, title, description, start_date, end_date, location_name, address, postal_code, district, bundesland, latitude, longitude, category, image_url, price_text, price_min, price_max, ticket_url, source_name, source_url, organizer, visibility, event_score, quality_score',
        { count: 'estimated' }
      )
      .eq('visibility', 'public')
      .eq('publish_status', 'published')
      .gte('start_date', today)
      .gt('event_score', 30)
      .gte('quality_score', 50)
      .not('image_url', 'is', null)
      .not('description', 'is', null)
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
    // Edge-Cache: 5 Min frisch + 10 Min stale-while-revalidate.
    // /api/events/featured bekommt mehrere Hundert Hits/min auf Landing
    // (jeder Browser ruft es beim Hero-Load); Cold-Start war 13 s.
    // Mit s-maxage cached Vercel den ersten Aufruf 5 min — restliche
    // Nutzer kriegen ihn instant (<50 ms) bis er stale wird, dann SWR.
    // Top Events ändern sich eh nur mit jedem Pipeline-Lauf (1× pro Tag).
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600'
    );
    return res;
  } catch (err) {
    console.error('API Error (featured):', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Featured Events' },
      { status: 500 }
    );
  }
}
