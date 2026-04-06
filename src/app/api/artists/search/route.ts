import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { searchSpotifyArtists, SpotifyRateLimitError } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

/**
 * GET /api/artists/search?q=<query>&limit=10
 *
 * Search for artists via the Spotify Search API (Client Credentials flow).
 * Works for all authenticated users -- does NOT require Spotify OAuth.
 *
 * Auth required to prevent abuse.
 * Returns: { artists: [{ id, name, image_url, genres, popularity }] }
 */
export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q');
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 20) : 10;

  // Empty or too-short queries return empty array (no Spotify call)
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ artists: [] });
  }

  try {
    const artists = await searchSpotifyArtists(q.trim(), limit);

    const res = NextResponse.json({ artists });
    res.headers.set('Cache-Control', 'private, max-age=60');
    return res;
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      const response = NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
      if (err.retryAfter) {
        response.headers.set('Retry-After', String(err.retryAfter));
      }
      return response;
    }

    console.error('Artist search error:', err);
    return NextResponse.json(
      { error: 'Failed to search artists' },
      { status: 500 }
    );
  }
}
