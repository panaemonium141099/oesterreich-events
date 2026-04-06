import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/artists/events
 * Returns upcoming events matched to the authenticated user's followed artists.
 * Joins artist_event_notifications with events for future events only.
 * Query params: limit (default 50, max 200), cursor (ISO timestamp for pagination)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const cursor = searchParams.get('cursor');

    const limit = limitParam
      ? Math.min(Math.max(1, parseInt(limitParam, 10)), MAX_LIMIT)
      : DEFAULT_LIMIT;

    // Get the user's followed artist count to determine if tab should show
    const { count: followedCount } = await supabase
      .from('followed_artists')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (!followedCount || followedCount === 0) {
      return NextResponse.json({
        events: [],
        total: 0,
        next_cursor: null,
        has_followed_artists: false,
      });
    }

    // Query artist_event_notifications joined with events
    // Only future events (start_date >= now)
    const now = new Date().toISOString();

    let query = supabase
      .from('artist_event_notifications')
      .select(`
        id,
        artist_name,
        match_score,
        match_source,
        created_at,
        event_id,
        events!inner (
          id,
          title,
          description,
          start_date,
          end_date,
          location_name,
          address,
          bundesland,
          district,
          latitude,
          longitude,
          category,
          price_text,
          image_url,
          organizer,
          tags,
          ticket_url,
          event_score
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .gte('events.start_date', now)
      .order('events(start_date)', { ascending: true })
      .limit(limit);

    if (cursor) {
      query = query.gt('events.start_date', cursor);
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Artist events query error:', error);
      return NextResponse.json({ error: 'Failed to fetch artist events' }, { status: 500 });
    }

    // Group by event_id -- multiple artists may match the same event
    const eventMap = new Map<string, {
      event: Record<string, unknown>;
      matched_artists: { name: string; match_score: number; match_source: string }[];
    }>();

    for (const notification of notifications || []) {
      const event = notification.events as unknown as Record<string, unknown>;
      const eventId = notification.event_id;

      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, {
          event,
          matched_artists: [],
        });
      }

      eventMap.get(eventId)!.matched_artists.push({
        name: notification.artist_name,
        match_score: notification.match_score,
        match_source: notification.match_source,
      });
    }

    // Get Spotify image URLs for matched artist names
    const allArtistNames = [...new Set(
      (notifications || []).map(n => n.artist_name.toLowerCase())
    )];

    let artistImages: Record<string, string> = {};
    if (allArtistNames.length > 0) {
      const { data: followedData } = await supabase
        .from('followed_artists')
        .select('artist_name_normalized, spotify_image_url')
        .eq('user_id', user.id)
        .not('spotify_image_url', 'is', null);

      if (followedData) {
        for (const fa of followedData) {
          if (fa.spotify_image_url) {
            artistImages[fa.artist_name_normalized] = fa.spotify_image_url;
          }
        }
      }
    }

    // Convert to array sorted by start_date
    const events = Array.from(eventMap.values()).map(({ event, matched_artists }) => ({
      ...event,
      matched_artists: matched_artists.map(a => ({
        ...a,
        image_url: artistImages[a.name.toLowerCase()] || null,
      })),
      best_match_score: Math.max(...matched_artists.map(a => a.match_score)),
    }));

    const nextCursor = events.length === limit && events.length > 0
      ? (events[events.length - 1] as Record<string, unknown>).start_date as string
      : null;

    return NextResponse.json({
      events,
      total: count ?? 0,
      next_cursor: nextCursor,
      has_followed_artists: true,
    });
  } catch (err) {
    console.error('GET /api/artists/events error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
