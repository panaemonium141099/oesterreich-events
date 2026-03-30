// Spotify API integration helpers

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

export function getSpotifyAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'user-top-artists user-read-recently-played',
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
