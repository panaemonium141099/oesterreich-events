// Spotify API integration helpers

import { createClient } from '@supabase/supabase-js';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

/**
 * Create a Supabase client with service_role key for server-only operations.
 * Used for spotify_tokens table which has no authenticated RLS access.
 */
function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key);
}

// --- Client Credentials flow (app-level token, no user context) ---

let cachedClientToken: { token: string; expiresAt: number } | null = null;

/**
 * Get an app-level access token via the Client Credentials flow.
 * This does NOT require user OAuth -- only SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET.
 * The token is cached in memory with a 5-minute safety margin before expiry.
 */
export async function getClientCredentialsToken(): Promise<string> {
  // Return cached token if still valid (with 5 min safety margin)
  if (cachedClientToken && Date.now() < cachedClientToken.expiresAt - 5 * 60 * 1000) {
    return cachedClientToken.token;
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get client credentials token: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number; token_type: string };

  cachedClientToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedClientToken.token;
}

export interface SpotifySearchArtist {
  id: string;
  name: string;
  image_url: string | null;
  genres: string[];
  popularity: number;
}

// In-memory search cache to avoid hitting Spotify rate limits on repeated queries
const searchCache = new Map<string, { results: SpotifySearchArtist[]; expiresAt: number }>();
const SEARCH_CACHE_TTL = 120_000; // 2 minutes

/**
 * Search for artists via the Spotify Search API using Client Credentials token.
 * Localizes results to Austria (market=AT).
 * Results are cached in memory for 2 minutes per query to avoid rate limiting.
 */
export async function searchSpotifyArtists(
  query: string,
  limit: number = 10
): Promise<SpotifySearchArtist[]> {
  // Check cache first
  const cacheKey = `${query.toLowerCase().trim()}:${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.results;
  }

  const token = await getClientCredentialsToken();

  const params = new URLSearchParams({
    q: query,
    type: 'artist',
    market: 'AT',
    limit: String(Math.min(limit, 20)),
  });

  const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Handle rate limiting
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    throw new SpotifyRateLimitError(
      `Spotify rate limited. Retry after ${retryAfter || 'unknown'} seconds.`,
      retryAfter ? parseInt(retryAfter, 10) : undefined
    );
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify search failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const artists = data.artists?.items || [];

  const results = artists.map((a: SpotifyArtist & { images?: { url: string }[] }) => ({
    id: a.id,
    name: a.name,
    image_url: a.images?.[0]?.url || null,
    genres: a.genres || [],
    popularity: a.popularity || 0,
  }));

  // Cache the results
  searchCache.set(cacheKey, { results, expiresAt: Date.now() + SEARCH_CACHE_TTL });

  // Evict old entries periodically (keep cache small)
  if (searchCache.size > 200) {
    const now = Date.now();
    for (const [key, val] of searchCache) {
      if (now > val.expiresAt) searchCache.delete(key);
    }
  }

  return results;
}

export class SpotifyRateLimitError extends Error {
  retryAfter?: number;
  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'SpotifyRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export function getSpotifyAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'user-top-read user-read-recently-played user-follow-read',
    show_dialog: 'true',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(code: string, redirectUri: string) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to exchange Spotify code');
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>;
}

/**
 * Low-level token refresh against the Spotify API.
 * Does NOT persist anything -- callers must handle storage.
 */
export async function refreshSpotifyToken(refreshToken: string) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to refresh Spotify token');
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }>;
}

/**
 * Refresh Spotify token for a user via the spotify_tokens table.
 * Reads refresh_token from spotify_tokens (service_role), calls Spotify API,
 * and writes updated tokens back. Returns the fresh access_token.
 */
export async function refreshSpotifyTokenForUser(userId: string): Promise<string> {
  const supabase = getServiceRoleClient();

  // Read current tokens
  const { data: tokenRow, error: readError } = await supabase
    .from('spotify_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .single();

  if (readError || !tokenRow) {
    throw new Error(`No Spotify tokens found for user ${userId}`);
  }

  // Refresh via Spotify API
  const freshTokens = await refreshSpotifyToken(tokenRow.refresh_token);

  // Calculate expiry timestamp
  const expiresAt = new Date(Date.now() + freshTokens.expires_in * 1000).toISOString();

  // Write back to spotify_tokens
  const { error: writeError } = await supabase
    .from('spotify_tokens')
    .update({
      access_token: freshTokens.access_token,
      // Spotify may or may not return a new refresh_token
      ...(freshTokens.refresh_token ? { refresh_token: freshTokens.refresh_token } : {}),
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (writeError) {
    throw new Error(`Failed to update spotify_tokens for user ${userId}: ${writeError.message}`);
  }

  return freshTokens.access_token;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string; width: number; height: number }[];
  popularity: number;
}

export async function getTopArtists(accessToken: string): Promise<SpotifyArtist[]> {
  const res = await fetch('https://api.spotify.com/v1/me/top/artists?limit=50&time_range=medium_term', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch top artists');
  }

  const data = await res.json();
  return data.items as SpotifyArtist[];
}

export async function getSpotifyProfile(accessToken: string) {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch Spotify profile');
  }

  return res.json() as Promise<{ id: string; display_name: string }>;
}

/**
 * Match artists against event titles/descriptions.
 * Returns matches with artist info and event data.
 */
export function matchArtistsToEvents(
  artists: SpotifyArtist[],
  events: { id: string; title: string; description: string | null; location_name: string | null; start_date: string }[]
): { artist: SpotifyArtist; event: typeof events[0]; matchType: 'artist_exact' | 'artist_similar'; score: number }[] {
  const matches: { artist: SpotifyArtist; event: typeof events[0]; matchType: 'artist_exact' | 'artist_similar'; score: number }[] = [];

  for (const artist of artists) {
    const artistLower = artist.name.toLowerCase();

    for (const event of events) {
      const titleLower = event.title.toLowerCase();
      const descLower = (event.description || '').toLowerCase();

      // Exact match in title
      if (titleLower.includes(artistLower)) {
        matches.push({
          artist,
          event,
          matchType: 'artist_exact',
          score: 1.0,
        });
        continue;
      }

      // Match in description
      if (descLower.includes(artistLower)) {
        matches.push({
          artist,
          event,
          matchType: 'artist_similar',
          score: 0.7,
        });
      }
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Deduplicate by event
  const seen = new Set<string>();
  return matches.filter(m => {
    const key = `${m.artist.id}-${m.event.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
