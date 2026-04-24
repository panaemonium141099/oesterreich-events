/**
 * Last.fm API client — used strictly as a BACKEND similarity data source.
 *
 * Context: after Spotify's Nov-2024 quota clampdown the `/recommendations`
 * endpoint is dead for new apps and `/artists/{id}/related-artists` returns
 * 403. Last.fm's `artist.getSimilar` endpoint has been the industry-standard
 * crowdsourced artist-similarity source since 2005 — better coverage for
 * niche / indie acts than Spotify's algorithm ever was.
 *
 * From the user's perspective this is invisible: we surface the result as
 * "Ähnliche Artists wie die du folgst", still inside our Spotify-branded UI.
 * Last.fm is never mentioned to end users — it's purely a server-side data
 * pipeline that feeds the Spotify /search endpoint for hydration (cover,
 * Spotify ID, genres).
 *
 * API docs: https://www.last.fm/api/show/artist.getSimilar
 *
 * Auth: single API key via LASTFM_API_KEY env var. No OAuth, no rate-limit
 * that matters at our volume (their docs suggest 5 req/sec as the polite
 * ceiling; we stay well under).
 */

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

export interface LastFmSimilarArtist {
  /** Artist name as Last.fm spells it. Usually matches Spotify, but
   *  feature-guest / "&" / "and" variants do drift. Our hydrator does a
   *  Spotify /search so small spelling diffs self-heal. */
  name: string;
  /** 0.0 - 1.0 similarity score — Last.fm's crowd-aggregated measure. */
  match: number;
  /** Last.fm's own artist page URL, useful for debugging / attribution. */
  url?: string;
  /** Last.fm MusicBrainz ID, sometimes null for indie acts. */
  mbid?: string;
}

interface LastFmApiResponse {
  similarartists?: {
    artist?: Array<{
      name: string;
      match: string; // API returns stringified float
      url?: string;
      mbid?: string;
    }>;
  };
  error?: number;
  message?: string;
}

/**
 * Fetch similar artists for a single seed name from Last.fm.
 *
 * Returns at most `limit` entries, sorted by match score descending.
 * Returns `[]` on any API error (soft-fail — the caller averages over
 * multiple seeds anyway so a single miss shouldn't break the feature).
 */
export async function getSimilarArtists(
  artistName: string,
  limit = 30,
): Promise<LastFmSimilarArtist[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    throw new Error(
      'LASTFM_API_KEY not set. Register at https://www.last.fm/api/account/create and add the key to .env.local + Vercel.',
    );
  }

  const params = new URLSearchParams({
    method: 'artist.getsimilar',
    artist: artistName,
    autocorrect: '1',
    limit: String(Math.min(limit, 100)),
    api_key: apiKey,
    format: 'json',
  });

  const res = await fetch(`${LASTFM_BASE}?${params}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    // Last.fm sometimes 500s transiently — don't blow up the whole
    // aggregated request, just return empty for this seed.
    console.warn(`[lastfm] ${res.status} for artist="${artistName}"`);
    return [];
  }

  const data = (await res.json()) as LastFmApiResponse;
  if (data.error) {
    console.warn(`[lastfm] error ${data.error}: ${data.message} (artist="${artistName}")`);
    return [];
  }

  const raw = data.similarartists?.artist ?? [];
  return raw.map(a => ({
    name: a.name,
    match: parseFloat(a.match) || 0,
    url: a.url,
    mbid: a.mbid,
  }));
}

/**
 * Top artists in a given country, ranked by Last.fm scrobble volume.
 * This is "what users in {country} are actually listening to right now",
 * which is a far better AT-discovery signal than editorial curation.
 *
 * Note: Last.fm scrobbles skew toward tech-savvy / music-enthusiast
 * demographic, so results lean alternative / indie compared to global
 * charts — which is arguably a better fit for an event-discovery site
 * anyway (the casual-Spotify mainstream is over-indexed everywhere else).
 */
interface LastFmGeoResponse {
  topartists?: {
    artist?: Array<{
      name: string;
      mbid?: string;
      url?: string;
      listeners?: string;
    }>;
  };
  error?: number;
  message?: string;
}

export interface LastFmTopArtist {
  name: string;
  mbid?: string;
  url?: string;
  listeners: number;
}

export async function getTopArtistsByCountry(
  country: string,
  limit = 50,
): Promise<LastFmTopArtist[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    method: 'geo.gettopartists',
    country,
    limit: String(Math.min(limit, 1000)),
    api_key: apiKey,
    format: 'json',
  });

  try {
    const res = await fetch(`${LASTFM_BASE}?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[lastfm geo] ${res.status} for country="${country}"`);
      return [];
    }
    const data = (await res.json()) as LastFmGeoResponse;
    if (data.error) {
      console.warn(`[lastfm geo] error ${data.error}: ${data.message}`);
      return [];
    }
    const raw = data.topartists?.artist ?? [];
    return raw.map(a => ({
      name: a.name,
      mbid: a.mbid || undefined,
      url: a.url,
      listeners: parseInt(a.listeners ?? '0', 10) || 0,
    }));
  } catch (err) {
    console.warn(`[lastfm geo] fetch failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/** Like LastFmSimilarArtist but carries the seed that drove this pick the
 *  strongest — used by the UI to render "Weil du {seedName} folgst". */
export interface LastFmSimilarArtistWithSeed extends LastFmSimilarArtist {
  /** The one seed-artist name with the HIGHEST individual Last.fm match
   *  score against this similar artist. If multiple seeds matched equally,
   *  the first-encountered wins (seed-order-stable). */
  seedName: string;
}

/**
 * Aggregate similar-artist results across multiple seeds.
 *
 * For each seed we fetch Last.fm's top-`perSeed` similar artists, then
 * merge into a single ranked list:
 *   - drop any artist whose name is in the seed set (don't recommend
 *     back what the user already follows)
 *   - sum match scores when the same artist is similar to multiple
 *     seeds (cross-seed overlap → stronger signal)
 *   - remember the seed with the highest individual match for each
 *     aggregated artist, so the UI can show "Weil du X folgst"
 *   - return top `total` by summed score
 *
 * This is a better signal than just taking Last.fm's per-seed top 30 and
 * deduping: it surfaces artists that sit at the INTERSECTION of the user's
 * taste cluster, not just broad neighbours of one seed.
 */
export async function getAggregatedSimilarArtists(
  seedNames: string[],
  perSeed = 50,
  total = 30,
): Promise<LastFmSimilarArtistWithSeed[]> {
  const seedLower = new Set(seedNames.map(n => n.toLowerCase()));
  // Fetch seeds in parallel — Last.fm's rate limit is 5 req/s which is
  // more than enough headroom for up to 5 seed queries.
  const perSeedResults = await Promise.all(
    seedNames.slice(0, 5).map(async name => ({
      seed: name,
      list: await getSimilarArtists(name, perSeed),
    })),
  );

  interface Entry {
    artist: LastFmSimilarArtist;
    totalMatch: number;
    bestSeed: string;
    bestSeedMatch: number;
  }
  const merged = new Map<string, Entry>();
  for (const { seed, list } of perSeedResults) {
    for (const a of list) {
      if (seedLower.has(a.name.toLowerCase())) continue; // skip seeds themselves
      const key = a.name.toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        existing.totalMatch += a.match;
        if (a.match > existing.bestSeedMatch) {
          existing.bestSeedMatch = a.match;
          existing.bestSeed = seed;
        }
      } else {
        merged.set(key, {
          artist: { ...a },
          totalMatch: a.match,
          bestSeed: seed,
          bestSeedMatch: a.match,
        });
      }
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.totalMatch - a.totalMatch)
    .slice(0, total)
    .map(e => ({
      ...e.artist,
      match: e.totalMatch, // report aggregated score, not per-seed
      seedName: e.bestSeed,
    }));
}
