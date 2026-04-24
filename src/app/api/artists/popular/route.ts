import { NextResponse } from 'next/server';
import { searchSpotifyArtists, type SpotifySearchArtist, SpotifyRateLimitError } from '@/lib/spotify';
import { getTopArtistsByCountry } from '@/lib/lastfm';
import { POPULAR_ARTISTS as FALLBACK_NAMES } from '@/lib/popular-artists';

export const dynamic = 'force-dynamic';
// Last.fm's geo chart shifts slowly — 24 h edge cache is plenty. The
// hydrated response is identical across users so we only pay the Spotify
// /search fan-out once per day cluster-wide.
export const revalidate = 86_400;

/**
 * "Beliebte Artists in Österreich" — the starter-discovery grid shown
 * to users before they've built up their own follow list.
 *
 * Data source:
 *   PRIMARY   Last.fm `geo.gettopartists&country=Austria` — real Austrian
 *             scrobble counts, picks up Wanda, Bilderbuch, Voodoo Jürgens,
 *             Seiler & Speer, Raf Camora, Parov Stelar etc. organically
 *             alongside the big international acts Austrians stream.
 *   FALLBACK  Hardcoded curated list in src/lib/popular-artists.ts when
 *             Last.fm returns < 10 results (network blip, API key issue,
 *             rate-limit). Keeps the starter block non-empty even if the
 *             primary source fails silently.
 *
 * Each name is then hydrated via Spotify /search (top-1 result) so the
 * UI can render with Spotify cover, Spotify ID, genres — identical shape
 * to every other AddArtistsPanel result. Edge-cached 24 h because the
 * chart changes on a glacial timescale.
 */
export async function GET() {
  try {
    // 1. Try Last.fm AT chart first — real listening data.
    const atTop = await getTopArtistsByCountry('Austria', 50);

    // 2. Fallback to curated list when Last.fm returns little/nothing.
    const names = atTop.length >= 10
      ? atTop.map(a => a.name)
      : FALLBACK_NAMES;

    // 3. Hydrate via Spotify /search with bounded concurrency to stay
    //    under Spotify's Client-Credentials rate budget.
    const CONCURRENCY = 6;
    const results: SpotifySearchArtist[] = [];
    for (let i = 0; i < names.length; i += CONCURRENCY) {
      const chunk = names.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async name => {
          try {
            const matches = await searchSpotifyArtists(name, 1);
            const top = matches[0];
            if (!top) return null;
            // Loose name-match guard: Last.fm sometimes emits typos /
            // tribute-band names that Spotify's top-1 result mis-matches.
            // Drop when the two names share <30% token overlap.
            if (!nameRoughlyMatches(top.name, name)) return null;
            return top;
          } catch (err) {
            if (err instanceof SpotifyRateLimitError) throw err;
            return null;
          }
        }),
      );
      for (const r of chunkResults) if (r) results.push(r);
    }

    // Dedup by Spotify ID (Last.fm can emit both "Wanda" and "WANDA" as
    // separate scrobble entries that collapse to the same Spotify artist).
    const seen = new Set<string>();
    const unique = results.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    return NextResponse.json(
      { artists: unique, source: atTop.length >= 10 ? 'lastfm-at' : 'fallback' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, max-age=600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', retryAfter: err.retryAfter ?? null },
        { status: 429 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[artists/popular] error:', msg);
    return NextResponse.json({ error: 'INTERNAL', message: msg }, { status: 500 });
  }
}

function nameRoughlyMatches(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase()
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
  return shared / shorter.size >= 0.3;
}
