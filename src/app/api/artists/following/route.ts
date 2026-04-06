import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/artists/following
 * Returns paginated list of user's followed artists.
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

    let query = supabase
      .from('followed_artists')
      .select('id, artist_name, artist_name_normalized, spotify_artist_id, spotify_image_url, source, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: artists, error, count } = await query;

    if (error) {
      console.error('List following error:', error);
      return NextResponse.json({ error: 'Failed to list followed artists' }, { status: 500 });
    }

    const nextCursor = artists && artists.length === limit
      ? artists[artists.length - 1].created_at
      : null;

    return NextResponse.json({
      artists: artists ?? [],
      total: count ?? 0,
      next_cursor: nextCursor,
    });
  } catch (err) {
    console.error('GET /api/artists/following error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
