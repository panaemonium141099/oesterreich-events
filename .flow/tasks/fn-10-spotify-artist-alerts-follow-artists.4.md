# fn-10-spotify-artist-alerts-follow-artists.4 Spotify Search API Integration with Client Credentials Flow

## Description
Add Spotify artist search API using Client Credentials flow (app-level token, no user context needed). This allows both Spotify-connected and non-connected users to search for artists to follow.

**Size:** M
**Files:** `src/app/api/artists/search/route.ts`, `src/lib/spotify.ts`

## Approach

- Add Client Credentials flow to `src/lib/spotify.ts`: `getClientCredentialsToken()` -- uses SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET to get app-level access token
- Cache the client credentials token in memory (1 hour TTL, refresh on expiry)
- New API route `GET /api/artists/search?q=<query>&limit=10`
  - Calls Spotify `GET /v1/search?type=artist&market=AT&q=<query>`
  - Returns: `{ artists: [{ id, name, image_url, genres, popularity }] }`
- Rate limit: debounce client-side (300ms), server-side max 20 requests per minute per user
- Auth required for the API route (prevents abuse)
- Handle Spotify 429 responses with `Retry-After` header

## Key context

- Client Credentials flow is different from Authorization Code flow -- it does NOT require user OAuth, only the app client_id + client_secret
- This works even in Spotify Development Mode (no user limit for app-level search)
- The `market=AT` parameter localizes results to Austria
- Existing `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` env vars should already be set
## Acceptance
- [ ] `getClientCredentialsToken()` added to `src/lib/spotify.ts` with caching
- [ ] `GET /api/artists/search?q=<query>` returns Spotify artist search results
- [ ] Search works for all authenticated users (not just Spotify-connected)
- [ ] Results include artist id, name, image_url, genres, popularity
- [ ] Rate limiting: Spotify 429 responses handled gracefully with retry
- [ ] Auth required -- returns 401 for unauthenticated requests
- [ ] Empty/short queries return empty array (no Spotify call)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
