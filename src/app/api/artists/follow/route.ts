import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeArtistName,
  classifyName,
  qualifiesForDescriptionMatch,
  isFalsePositiveMatch,
  matchExactNames,
  matchFuzzyNames,
  matchDescriptionNames,
  insertArtistEventMatches,
  createGroupedNotifications,
  type MatchResult,
} from '@/lib/artist-matching';

export const dynamic = 'force-dynamic';

/**
 * Run a lightweight single-artist match against recent events.
 * Called after a user follows an artist so they see results immediately.
 */
async function matchSingleArtist(
  supabase: SupabaseClient,
  userId: string,
  artistName: string
): Promise<number> {
  const normalized = normalizeArtistName(artistName);
  const tier = classifyName(normalized);
  if (tier === 'skip') return 0;

  // Match against ALL existing events (epoch) — this is a fresh follow,
  // so we need to check all events, not just recently updated ones.
  // The RPC functions filter on `updated_at > p_since` AND `start_date >= now()`.
  const since = '1970-01-01T00:00:00Z';

  let titleMatches: Array<{ event_id: string; event_title: string; matched_name: string; score: number }> = [];

  if (tier === 'exact') {
    titleMatches = await matchExactNames(supabase, [normalized], since);
  } else {
    titleMatches = await matchFuzzyNames(supabase, [normalized], since);
  }

  // Secondary: description matching for 6+ char names
  let descMatches: typeof titleMatches = [];
  if (qualifiesForDescriptionMatch(normalized)) {
    const titleEventIds = new Set(titleMatches.map(m => m.event_id));
    descMatches = await matchDescriptionNames(supabase, [normalized], since, titleEventIds);
  }

  // Filter out false positives (cover bands, tribute shows, repertoire references)
  const fpFilter = (m: { matched_name: string; event_title: string }) =>
    !isFalsePositiveMatch(m.matched_name, m.event_title);
  titleMatches = titleMatches.filter(fpFilter);
  descMatches = descMatches.filter(fpFilter);

  // Build MatchResults for this user
  const allMatches: MatchResult[] = [
    ...titleMatches.map(m => ({
      user_id: userId,
      event_id: m.event_id,
      event_title: m.event_title,
      artist_name: artistName,
      match_score: m.score,
      match_source: 'title' as const,
    })),
    ...descMatches.map(m => ({
      user_id: userId,
      event_id: m.event_id,
      event_title: m.event_title,
      artist_name: artistName,
      match_score: m.score,
      match_source: 'description' as const,
    })),
  ];

  if (allMatches.length === 0) return 0;

  // Insert matches and create notifications
  await insertArtistEventMatches(supabase, allMatches);
  await createGroupedNotifications(supabase, allMatches);

  return allMatches.length;
}

/**
 * POST /api/artists/follow
 * Follow an artist. Inserts into followed_artists.
 * Then runs immediate matching against existing events.
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

    // Run immediate matching so user sees events right away
    let matchCount = 0;
    try {
      matchCount = await matchSingleArtist(supabase, user.id, artist_name.trim());
    } catch (matchErr) {
      // Non-fatal: follow succeeded, matching is best-effort
      console.error('Auto-match after follow failed:', matchErr);
    }

    return NextResponse.json({ followed_artist: data, matches_found: matchCount }, { status: 201 });
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
