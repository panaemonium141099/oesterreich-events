import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/artists/follow
 * Follow an artist. Inserts into followed_artists.
 * Body: { artist_name: string, spotify_artist_id?: string, spotify_image_url?: string, source?: 'spotify' | 'manual' }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { artist_name, spotify_artist_id, spotify_image_url, source } = body;

    if (!artist_name || typeof artist_name !== 'string' || artist_name.trim().length === 0) {
      return NextResponse.json({ error: 'artist_name is required' }, { status: 400 });
    }

    const validSource = source === 'spotify' ? 'spotify' : 'manual';

    const { data, error } = await supabase
      .from('followed_artists')
      .upsert(
        {
          user_id: user.id,
          artist_name: artist_name.trim(),
          spotify_artist_id: spotify_artist_id || null,
          spotify_image_url: spotify_image_url || null,
          source: validSource,
        },
        { onConflict: 'user_id,artist_name_normalized' }
      )
      .select()
      .single();

    if (error) {
      console.error('Follow artist error:', error);
      return NextResponse.json({ error: 'Failed to follow artist' }, { status: 500 });
    }

    return NextResponse.json({ followed_artist: data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/artists/follow error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/artists/follow
 * Unfollow an artist. Hard deletes from followed_artists.
 * Body: { artist_name: string } or { id: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, artist_name } = body;

    if (!id && !artist_name) {
      return NextResponse.json({ error: 'id or artist_name is required' }, { status: 400 });
    }

    let query = supabase
      .from('followed_artists')
      .delete()
      .eq('user_id', user.id);

    if (id) {
      query = query.eq('id', id);
    } else {
      // Match by normalized name (lowercase)
      query = query.eq('artist_name_normalized', artist_name.trim().toLowerCase());
    }

    const { error, count } = await query;

    if (error) {
      console.error('Unfollow artist error:', error);
      return NextResponse.json({ error: 'Failed to unfollow artist' }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Artist not found in follows' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/artists/follow error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
