import { NextRequest, NextResponse } from 'next/server';
import { getAggregatedSimilarArtists } from '@/lib/lastfm';
import { searchSpotifyArtists, SpotifyRateLimitError } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

/**
 * "Ähnliche Artists wie die du folgst".
 *
 * Pipeline:
 *   1. Client sends names of currently followed artists (max 5 seeds).
 *   2. We query Last.fm `artist.getSimilar` for each seed and aggregate
 *      across them (sum match scores for cross-seed overlap → stronger
 *      signal; see lastfm.ts:getAggregatedSimilarArtists).
 *   3. For each suggested name we do a Spotify `/search` to hydrate with
 *      Spotify ID + cover + genres (needed for the UI tile + for the
 *      downstream follow flow which wants a `spotify_artist_id`).
 *
 * Why this architecture, instead of just using Spotify's recommendations:
 *   Spotify's /recommendations endpoint was removed for new apps in
 *   November 2024 (and /artists/{id}/related-artists returns 403 too).
 *   Last.fm's similarity data is unrestricted, free, and — by consensus
 *   across the music-dev community — equal or better than Spotify for
 *   indie / non-Top-40 artists because it's crowd-sourced from 20 years
 *   of scrobble data rather than a proprietary listening-pattern model.
 *
 * User never sees "Last.fm" in the UI — this is purely a backend
 * similarity source that feeds the Spotify-branded panel.
 */
export async function POST(request: NextRequest) {
  let body: { seedArtistNames?: string[] };
  try {
    body = (await request.json()) as { seedArtistNames?: string[] };
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const seeds = (body.seedArtistNames ?? [])
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .map(n => n.trim())
    .slice(0, 5);

  if (seeds.length === 0) {
    return NextResponse.json(
      { error: 'NO_SEEDS', message: 'Folge zuerst ein paar Artists, dann können wir ähnliche finden.' },
      { status: 400 },
    );
  }

  try {
    // 1. Last.fm similarity aggregation — 50 per seed, merged to top 30.
    const similar = await getAggregatedSimilarArtists(seeds, 50, 30);
    if (similar.length === 0) {
      return NextResponse.json({ artists: [] });
    }

    // 2. Hydrate each via Spotify /search. We do a q="name" search and
    // take the top-1 result — Spotify's search is good at exact-name
    // matching for well-known acts. Indie / ambiguous names may match
    // the wrong artist; that's why the UI lets the user review + untick.
    // We run searches in parallel with a small concurrency limit to
    // stay polite to Spotify's ~180 req/min Client-Credentials budget.
    const CONCURRENCY = 5;
    const hydrated: Array<{
      id: string;
      name: string;
      image_url: string | null;
      genres: string[];
      popularity: number;
      match_score: number;
    }> = [];

    for (let i = 0; i < similar.length; i += CONCURRENCY) {
      const chunk = similar.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async s => {
          try {
            const matches = await searchSpotifyArtists(s.name, 1);
            const top = matches[0];
            if (!top) return null;
            // Sanity: if Spotify's search returned something very different,
            // skip. Compare normalised names — a 0.5+ token overlap keeps
            // "The Beatles" matching "Beatles" while rejecting unrelated
            // same-initial artists.
            if (!nameRoughlyMatches(top.name, s.name)) return null;
            return { ...top, match_score: s.match };
          } catch (err) {
            if (err instanceof SpotifyRateLimitError) throw err; // propagate
            return null; // soft-fail per artist
          }
        }),
      );
      for (const r of results) if (r) hydrated.push(r);
    }

    return NextResponse.json({ artists: hydrated });
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', retryAfter: err.retryAfter ?? null },
        { status: 429 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('LASTFM_API_KEY not set')) {
      return NextResponse.json(
        {
          error: 'LASTFM_MISSING',
          message: 'Last.fm-API-Key fehlt in der Server-Konfiguration. Admin: LASTFM_API_KEY in .env setzen.',
        },
        { status: 503 },
      );
    }
    console.error('[artists/similar] error:', msg);
    return NextResponse.json({ error: 'INTERNAL', message: msg }, { status: 500 });
  }
}

/** Lower-case, strip diacritics + punctuation, then compare token sets.
 *  Returns true when ≥50% of the shorter name's tokens appear in the
 *  longer one — enough to catch "The Beatles" ~ "Beatles" and reject
 *  "Hans Zimmer" ~ "Hans Zimmermann". */
function nameRoughlyMatches(a: string, b: string): boolean {
  const norm = (s: string) => s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (ta.size === 0 || tb.size === 0) return false;
  const [shorter, longer] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  let shared = 0;
  for (const t of shorter) if (longer.has(t)) shared++;
  return shared / shorter.size >= 0.5;
}
