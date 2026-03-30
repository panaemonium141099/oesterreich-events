import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exchangeSpotifyCode, getTopArtists, getSpotifyProfile, matchArtistsToEvents } from '@/lib/spotify';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/profile?spotify_error=denied`);
  }

  try {
    const supabase = await createServerSupabaseClient();

    // Verify user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/auth/login`);
    }

    const redirectUri = `${origin}/auth/spotify/callback`;

    // Exchange code for tokens
    const tokens = await exchangeSpotifyCode(code, redirectUri);

    // Get Spotify profile
    const spotifyProfile = await getSpotifyProfile(tokens.access_token);

    // Update profile with Spotify info
    await supabase
      .from('profiles')
      .update({
        spotify_connected: true,
        spotify_refresh_token: tokens.refresh_token,
        spotify_user_id: spotifyProfile.id,
      })
      .eq('id', user.id);

    // Get top artists and match against events
    try {
      const artists = await getTopArtists(tokens.access_token);

      // Get upcoming events
      const { data: events } = await supabase
        .from('events')
        .select('id, title, description, location_name, start_date')
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(5000);

      if (events && artists.length > 0) {
        const matches = matchArtistsToEvents(artists, events);

        // Save matches (clear old ones first)
        await supabase
          .from('spotify_artist_matches')
          .delete()
          .eq('user_id', user.id);

        if (matches.length > 0) {
          await supabase.from('spotify_artist_matches').insert(
            matches.slice(0, 100).map(m => ({
              user_id: user.id,
              spotify_artist_id: m.artist.id,
              artist_name: m.artist.name,
              event_id: m.event.id,
              match_type: m.matchType,
              match_score: m.score,
            }))
          );
        }
      }
    } catch (matchErr) {
      // Non-critical: matching can fail silently
      console.error('Spotify matching error:', matchErr);
    }

    return NextResponse.redirect(`${origin}/profile?spotify=connected`);
  } catch (err) {
    console.error('Spotify callback error:', err);
    return NextResponse.redirect(`${origin}/profile?spotify_error=failed`);
  }
}
