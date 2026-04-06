# fn-10-spotify-artist-alerts-follow-artists.3 Refactor Spotify OAuth Callback and Artist Follow API Routes

## Description
Refactor the Spotify OAuth callback to store tokens in `spotify_tokens` (server-only), import top 50 artists to `imported_spotify_artists` staging table, and auto-follow the top 10 into `followed_artists`. Create CRUD API routes for artist follows and a Spotify connectivity status endpoint.

**Size:** M
**Files:** `src/app/auth/spotify/callback/route.ts`, `src/app/api/artists/follow/route.ts`, `src/app/api/artists/following/route.ts`, `src/app/api/spotify/status/route.ts`, `src/lib/spotify.ts`

## Approach

- Refactor callback:
  1. Exchange code for tokens (existing)
  2. Store access_token, refresh_token, access_token_expires_at in `spotify_tokens` via service_role client (NOT user client)
  3. Fetch top 50 artists via `getTopArtists()` with the fresh access token
  4. Upsert all 50 into `imported_spotify_artists` with rank (1-50)
  5. Auto-follow top 10 (rank 1-10) by inserting into `followed_artists` (source: spotify)
  6. Redirect to `/artists?spotify=connected`
- Remove the 5000-event fetch + `matchArtistsToEvents()` from the callback entirely
- New API routes:
  - `POST /api/artists/follow` -- insert into followed_artists (body: { artist_name, spotify_artist_id?, source })
  - `DELETE /api/artists/follow` -- hard DELETE from followed_artists (body: { artist_name } or { id })
  - `GET /api/artists/following` -- list user followed artists (with pagination)
  - `GET /api/spotify/status` -- server-side check if user has entry in spotify_tokens (returns { connected: boolean })
- All routes require auth (Supabase session check)

## Key context

- Token refresh: `refreshSpotifyToken()` must now read/write from `spotify_tokens` via service_role, not from profiles
- The callback uses the fresh access token from code exchange -- no refresh needed during callback itself
- `profiles.spotify_connected` and `profiles.spotify_refresh_token` are deprecated but NOT removed yet
- Hard delete on unfollow -- no soft delete, no active flag. Re-follow = fresh INSERT
- Existing `spotify_artist_matches` table is NOT migrated or modified (migration deferred, out of scope)

## Acceptance
- [ ] Callback stores tokens in `spotify_tokens` table via service_role (not user client)
- [ ] Callback imports top 50 artists to `imported_spotify_artists` with rank
- [ ] Callback auto-follows top 10 artists in `followed_artists` (source: spotify)
- [ ] Callback no longer fetches events or runs client-side matching
- [ ] `GET /api/spotify/status` returns connectivity status without exposing tokens
- [ ] `POST /api/artists/follow` creates a followed_artists row (auth required)
- [ ] `DELETE /api/artists/follow` hard-deletes a followed_artists row
- [ ] `GET /api/artists/following` returns paginated list of user followed artists
- [ ] All API routes validate auth and return 401 for unauthenticated requests
- [ ] `refreshSpotifyToken()` reads/writes from spotify_tokens via service_role
- [ ] Redirect goes to `/artists?spotify=connected`
- [ ] Existing tests still pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
