import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractCity } from '@/lib/utils/city';

export const dynamic = 'force-dynamic';

const MIN_QUALITY_SCORE = 50;
const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 8;
// Fetch more candidates for client-side ranking
const CANDIDATE_MULTIPLIER = 5;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * GET /api/events/related?eventId=...&limit=4
 *
 * Returns related events ranked by relevance:
 *   Same venue: +4, Same city: +3, Same category: +2, Within 7 days: +1
 * Filtered to published events with quality_score >= 50.
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const eventId = searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json(
      { error: 'eventId is required' },
      { status: 400 },
    );
  }

  const limitParam = searchParams.get('limit');
  const limit = limitParam
    ? Math.min(Math.max(1, parseInt(limitParam, 10)), MAX_LIMIT)
    : DEFAULT_LIMIT;

  // 1. Load the source event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'id, category, bundesland, address, venue_id, start_date, location_name',
    )
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ events: [] });
  }

  // Derive city from venue if available
  let venueCity: string | null = null;
  if (event.venue_id) {
    const { data: venue } = await supabase
      .from('venues')
      .select('city')
      .eq('id', event.venue_id)
      .single();
    venueCity = venue?.city ?? null;
  }

  const sourceCity = extractCity(
    { address: event.address, bundesland: event.bundesland },
    venueCity,
  );

  // 2. Fetch candidates — broad filter on bundesland or category
  const today = new Date().toISOString().split('T')[0];
  let query = supabase
    .from('events')
    .select(
      'id, title, start_date, end_date, location_name, image_url, category, bundesland, address, venue_id, event_score, quality_score',
    )
    .neq('id', eventId)
    .eq('publish_status', 'published')
    .gte('quality_score', MIN_QUALITY_SCORE)
    .gte('start_date', today)
    .order('event_score', { ascending: false })
    .limit(limit * CANDIDATE_MULTIPLIER);

  // Narrow candidates: same bundesland OR same category
  if (event.bundesland && event.category) {
    query = query.or(
      `bundesland.eq.${event.bundesland},category.eq.${event.category}`,
    );
  } else if (event.bundesland) {
    query = query.eq('bundesland', event.bundesland);
  } else if (event.category) {
    query = query.eq('category', event.category);
  }

  const { data: candidates, error: candidatesError } = await query;

  if (candidatesError || !candidates || candidates.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // 3. Rank candidates
  const sourceDate = new Date(event.start_date).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const ranked = candidates
    .map((c) => {
      let score = 0;

      // Same venue: +4
      if (event.venue_id && c.venue_id && c.venue_id === event.venue_id) {
        score += 4;
      }

      // Same city: +3
      if (sourceCity) {
        const candidateCity = extractCity(
          { address: c.address, bundesland: c.bundesland },
          null, // No venue join for candidates to keep it fast
        );
        if (
          candidateCity &&
          candidateCity.toLowerCase() === sourceCity.toLowerCase()
        ) {
          score += 3;
        }
      }

      // Same category: +2
      if (event.category && c.category === event.category) {
        score += 2;
      }

      // Within 7 days: +1
      const candidateDate = new Date(c.start_date).getTime();
      if (Math.abs(candidateDate - sourceDate) <= sevenDaysMs) {
        score += 1;
      }

      return { ...c, _rankScore: score };
    })
    .sort((a, b) => {
      // Primary: rank score DESC
      if (b._rankScore !== a._rankScore) return b._rankScore - a._rankScore;
      // Secondary: event_score DESC
      return (b.event_score ?? 0) - (a.event_score ?? 0);
    })
    .slice(0, limit);

  // Strip internal scoring field
  const events = ranked.map(({ _rankScore, ...rest }) => rest);

  return NextResponse.json({ events });
}
