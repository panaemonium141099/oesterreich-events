# fn-10-spotify-artist-alerts-follow-artists.2 Database Schema: spotify_tokens, imported_spotify_artists, followed_artists, artist_event_notifications, notification_preferences, matching_cursor

## Description
Create six new database tables (`spotify_tokens`, `imported_spotify_artists`, `followed_artists`, `artist_event_notifications`, `notification_preferences`, `matching_cursor`), enable `pg_trgm` extension, add GIN index on `events.title`, write RLS policies, and add unique partial index on `notifications(user_id, event_id)` WHERE `type = 'spotify_match'`.

**Size:** M
**Files:** `supabase/migrations/20260407_artist_alerts_schema.sql`, `src/types/database.ts`

## Approach

- Follow existing migration pattern in `supabase/migrations/`
- Enable `pg_trgm` extension with `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- Create GIN trigram index on `events.title` using `gin_trgm_ops`
- `spotify_tokens`: server-only table, RLS denies ALL for authenticated role (only service_role access)
- `imported_spotify_artists`: staging table for Spotify top artists, unique on `(user_id, spotify_artist_id)`
- `followed_artists`: hard delete (no `active` column), unique on `(user_id, artist_name_normalized)`, `artist_name_normalized` is a generated column (`lower(artist_name)` -- check if `unaccent` available, else just lowercase)
- `artist_event_notifications`: unique on `(user_id, event_id, artist_name)` for per-artist dedup
- `notification_preferences`: unique on `user_id`, no `email_override` column (use Supabase Auth email only)
- `matching_cursor`: singleton row (id = 'artist_matching') for incremental state tracking
- Unique partial index on `notifications`: `CREATE UNIQUE INDEX idx_notifications_artist_dedup ON notifications(user_id, event_id) WHERE type = 'spotify_match'` -- ensures max 1 notification per user+event
- RLS: users can only CRUD their own rows in followed_artists, imported_spotify_artists, notification_preferences
- RLS: spotify_tokens has NO authenticated access (server-only)
- Update `src/types/database.ts` with TypeScript interfaces for all new tables

## Key context

- `pg_trgm` word_similarity operator `<%` uses default threshold 0.6
- The `notifications` table check constraint already includes `spotify_match` type -- no change needed
- The existing `spotify_artist_matches` table is NOT dropped (kept as-is, migration deferred)
- `profiles.spotify_refresh_token` and `profiles.spotify_connected` columns are deprecated but NOT removed (backward compat)
- No GIN index on events.description (by design -- too expensive for HTML content)

## Acceptance
- [ ] `spotify_tokens` table created with encrypted columns, NO authenticated RLS access
- [ ] `imported_spotify_artists` table created with unique (user_id, spotify_artist_id)
- [ ] `followed_artists` table created with hard delete semantics (no active column), unique on (user_id, artist_name_normalized)
- [ ] `artist_event_notifications` table created with unique on (user_id, event_id, artist_name)
- [ ] `notification_preferences` table created with unique on user_id, no email_override
- [ ] `matching_cursor` table created with singleton row pattern
- [ ] Unique partial index on notifications(user_id, event_id) WHERE type = spotify_match
- [ ] `pg_trgm` extension enabled
- [ ] GIN index on events.title using gin_trgm_ops
- [ ] RLS policies: spotify_tokens server-only, others user-scoped
- [ ] TypeScript types in `src/types/database.ts` updated for all new tables
- [ ] Migration applies cleanly to Supabase

## Done summary
Created 6 new database tables (spotify_tokens, imported_spotify_artists, followed_artists, artist_event_notifications, notification_preferences, matching_cursor) with RLS policies, indexes, and unique constraints. Updated TypeScript types. Migration applied cleanly to Supabase production.
## Evidence
- Commits: f622e8afd18beae5dfa4e3844b16dd0bdaf6cdba
- Tests: npm test (450 passed), npx tsc --noEmit (clean), Supabase migration applied + verified via SQL queries
- PRs: