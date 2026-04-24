import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exchangeSpotifyCode, getTopArtists, getSpotifyProfile } from '@/lib/spotify';
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

/**
 * Spotify OAuth callback.
 *
 * 1. Exchange code for tokens
 * 2. Store tokens in spotify_tokens via service_role (NOT user client)
 * 3. Fetch top 50 artists and upsert into imported_spotify_artists
 * 4. Auto-follow top 10 into followed_artists (source: spotify)
 * 5. Redirect to /artists?spotify=connected
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/profile?spotify_error=denied`);
  }

  try {
    // User client -- for auth check and RLS-enabled operations
    const supabase = await createServerSupabaseClient();

    // Verify user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/auth/login`);
    }

    // Service role client -- for spotify_tokens (no authenticated RLS)
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceUrl || !serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Spotify token storage');
    }
    const serviceClient = createClient(serviceUrl, serviceKey);

    // MUST match byte-for-byte what was sent to /authorize. The client-side
    // buttons now use NEXT_PUBLIC_SITE_URL as the canonical origin, so we do
    // the same here. Fallback to `origin` (the host Spotify sent the user
    // back to) is kept for safety in dev / preview deployments where the
    // env var might not be set.
    const canonicalOrigin = process.env.NEXT_PUBLIC_SITE_URL || origin;
    const redirectUri = `${canonicalOrigin}/auth/spotify/callback`;

    // 1. Exchange code for tokens
    const tokens = await exchangeSpotifyCode(code, redirectUri);

    // 2. Get Spotify profile (for spotify_user_id)
    const spotifyProfile = await getSpotifyProfile(tokens.access_token);

    // 3. Store tokens in spotify_tokens via service_role
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: tokenError } = await serviceClient
      .from('spotify_tokens')
      .upsert(
        {
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          access_token_expires_at: expiresAt,
          spotify_user_id: spotifyProfile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (tokenError) {
      console.error('Failed to store spotify_tokens:', tokenError);
      throw new Error('Failed to store Spotify tokens');
    }

    // Also update the legacy profiles.spotify_connected flag (deprecated, but still read by UI)
    await supabase
      .from('profiles')
      .update({
        spotify_connected: true,
        spotify_user_id: spotifyProfile.id,
      })
      .eq('id', user.id);

    // 4. Fetch top 50 artists and import to staging table
    try {
      const artists = await getTopArtists(tokens.access_token);

      if (artists.length > 0) {
        // Clear old imported artists for this user, then insert fresh
        await supabase
          .from('imported_spotify_artists')
          .delete()
          .eq('user_id', user.id);

        const importRows = artists.map((artist, index) => ({
          user_id: user.id,
          artist_name: artist.name,
          spotify_artist_id: artist.id,
          spotify_image_url: artist.images?.[0]?.url || null,
          genres: artist.genres || [],
          popularity: artist.popularity || 0,
          rank: index + 1,
        }));

        await supabase
          .from('imported_spotify_artists')
          .insert(importRows);

        // 5. Auto-follow top 10 artists (source: spotify)
        const top10 = artists.slice(0, 10);

        for (const artist of top10) {
          // Upsert to avoid conflicts if already followed
          await supabase
            .from('followed_artists')
            .upsert(
              {
                user_id: user.id,
                artist_name: artist.name,
                spotify_artist_id: artist.id,
                spotify_image_url: artist.images?.[0]?.url || null,
                source: 'spotify',
              },
              { onConflict: 'user_id,artist_name_normalized' }
            );
        }

        // 6. Auto-match all followed artists against ALL existing events
        //    so the user sees matches immediately after Spotify import
        try {
          const since = '1970-01-01T00:00:00Z'; // epoch = match ALL events
          let totalMatches = 0;

          for (const artist of top10) {
            const normalized = normalizeArtistName(artist.name);
            const tier = classifyName(normalized);
            if (tier === 'skip') continue;

            let titleMatches: Array<{ event_id: string; event_title: string; matched_name: string; score: number }> = [];

            if (tier === 'exact') {
              titleMatches = await matchExactNames(supabase, [normalized], since);
            } else {
              titleMatches = await matchFuzzyNames(supabase, [normalized], since);
            }

            let descMatches: typeof titleMatches = [];
            if (qualifiesForDescriptionMatch(normalized)) {
              const titleEventIds = new Set(titleMatches.map(m => m.event_id));
              descMatches = await matchDescriptionNames(supabase, [normalized], since, titleEventIds);
            }

            // Filter out false positives (cover bands, tribute shows, repertoire refs)
            const fpFilter = (m: { matched_name: string; event_title: string }) =>
              !isFalsePositiveMatch(m.matched_name, m.event_title);
            titleMatches = titleMatches.filter(fpFilter);
            descMatches = descMatches.filter(fpFilter);

            const allMatches: MatchResult[] = [
              ...titleMatches.map(m => ({
                user_id: user.id,
                event_id: m.event_id,
                event_title: m.event_title,
                artist_name: artist.name,
                match_score: m.score,
                match_source: 'title' as const,
              })),
              ...descMatches.map(m => ({
                user_id: user.id,
                event_id: m.event_id,
                event_title: m.event_title,
                artist_name: artist.name,
                match_score: m.score,
                match_source: 'description' as const,
              })),
            ];

            if (allMatches.length > 0) {
              await insertArtistEventMatches(supabase, allMatches);
              await createGroupedNotifications(supabase, allMatches);
              totalMatches += allMatches.length;
            }
          }

          console.log(`Spotify auto-match: ${totalMatches} matches for ${top10.length} artists`);
        } catch (matchErr) {
          // Non-fatal: follow succeeded, matching is best-effort
          console.error('Spotify auto-match failed:', matchErr);
        }
      }
    } catch (importErr) {
      // Non-critical: artist import can fail silently
      console.error('Spotify artist import error:', importErr);
    }

    return NextResponse.redirect(`${origin}/artists?spotify=connected`);
  } catch (err) {
    console.error('Spotify callback error:', err);
    return NextResponse.redirect(`${origin}/profile?spotify_error=failed`);
  }
}
