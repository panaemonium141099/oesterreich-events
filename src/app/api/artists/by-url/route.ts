import { NextRequest, NextResponse } from 'next/server';
import {
  getSpotifyArtistById,
  getSpotifyArtistFromTrack,
  parseSpotifyArtistId,
  parseSpotifyTrackId,
  SpotifyRateLimitError,
} from '@/lib/spotify';

export const dynamic = 'force-dynamic';

/**
 * Resolve a pasted Spotify URL into a single artist.
 *
 * Accepts three kinds of input:
 *   - Spotify artist URL/URI/ID  → returns that artist
 *   - Spotify track URL/URI      → returns the track's primary artist
 *   - Bare 22-char base62 ID     → treated as an artist ID
 *
 * UX purpose: quickest path to add ONE artist you already know. User
 * copies the share-link off Spotify, pastes it here, gets an instant
 * preview + follow button. No OAuth, no rate-limit concerns.
 */
export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 });

  try {
    // 1. Artist URL / URI / bare ID
    const artistId = parseSpotifyArtistId(url);
    if (artistId) {
      const artist = await getSpotifyArtistById(artistId);
      if (!artist) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Artist nicht gefunden.' },
          { status: 404 },
        );
      }
      return NextResponse.json({ artist });
    }

    // 2. Track URL → fall back to the primary artist of the track
    const trackId = parseSpotifyTrackId(url);
    if (trackId) {
      const artist = await getSpotifyArtistFromTrack(trackId);
      if (!artist) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Track nicht gefunden.' },
          { status: 404 },
        );
      }
      return NextResponse.json({ artist, fromTrack: true });
    }

    return NextResponse.json(
      {
        error: 'INVALID_URL',
        message: 'Kein Spotify-Artist- oder Track-Link erkannt.',
      },
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', retryAfter: err.retryAfter ?? null },
        { status: 429 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[artists/by-url] error:', msg);
    return NextResponse.json({ error: 'INTERNAL', message: msg }, { status: 500 });
  }
}
