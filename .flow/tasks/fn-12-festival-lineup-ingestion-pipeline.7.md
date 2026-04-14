# fn-12-festival-lineup-ingestion-pipeline.7 Extend artist matching with direct lineup lookup

## Description

Extend the artist matching engine with a direct-lookup step. This task owns TS type updates for both `MatchResult.match_source` and `database.ts` `match_source` union. The RPC carries `festival_name` for notification copy.

**Size:** M
**Files:** `src/lib/artist-matching.ts` (extend), `src/types/database.ts` (match_source union), `supabase/migrations/YYYYMMDD_lineup_matching_functions.sql`

## Approach

**New RPC function** (`lineup_matching_functions.sql`):
- `match_lineup_artists(p_artist_names TEXT[], p_since TIMESTAMPTZ)`:
  - `WHERE fa.artist_name_normalized = ANY(p_artist_names)` (btree equality)
  - `JOIN festivals f ON f.id = fa.festival_id WHERE f.starts_at >= current_date`
  - Filter: `fa.updated_at > p_since` AND `fa.derived_event_id IS NOT NULL`
  - JOIN `events e` ON `e.id = fa.derived_event_id` to get event title
  - Return: `derived_event_id UUID NOT NULL`, **`event_title TEXT`** (from joined events row, needed for MatchResult hydration), `parent_event_id UUID`, `festival_id UUID`, **`festival_name TEXT`** (from festivals, for notification copy), `artist_name_raw TEXT`, `artist_name_normalized TEXT`
- Constraint naming: use `DROP CONSTRAINT IF EXISTS` for robustness if referenced.

**Extend `runMatchingPipeline`**:
- Step 0 (before title matching): Direct lineup lookup
- **Authoritative normalization for equality matching**: The lineup normalizer (`normalizeArtistName` from `src/lib/lineup/normalize.ts`) is the single authoritative normalizer for direct-lookup equality. Both sides use it: lineup data is normalized with it at insert time (task 6), and followed artist names are normalized with it at lookup time (this step). The DB-stored `followed_artists.artist_name_normalized` (which is just `lower()`) is NOT sufficient for lineup joins -- the app must re-normalize using the lineup normalizer before passing to the RPC.
- Matches get `match_source = 'lineup'`
- **Extend `MatchResult`** to include optional `festival_name: string` for lineup matches (used by notification copy in task 8). Hydrate `event_title` from the RPC's `event_title` return field. When building notification groups, store `festival_name` on the group object for lineup matches so `createGroupedNotifications()` can use it for copy without parsing.
- Insert notifications against derived_event_id. Use the **user's followed artist display name** (not lineup raw name) for `artist_event_notifications.artist_name` to keep dedup stable across lineup formatting changes.
- Derived events are excluded from fuzzy/exact/description RPCs (task 1 filter). Lineup matching runs IN ADDITION TO (not instead of) fuzzy matching -- a followed artist can match both a lineup entry and a separate concert event.
- ON CONFLICT DO NOTHING

**TS type updates (owned by this task)**:
- `src/lib/artist-matching.ts`: `MatchResult.match_source: 'title' | 'description' | 'lineup'`
- `src/types/database.ts`: `artist_event_notifications.match_source` union includes `'lineup'`

## Key context

- `updated_at > p_since` catches newly-derivated rows. First-time backfill requires `--reset-cursor`.
- Lineup normalizer is the authoritative normalizer for both sides of the equality join (followed artist names normalized with it for lookup, lineup names normalized with it at insert time in task 6).
- `festival_name` in return shape avoids brittle title-parsing for notification copy.

## Done summary
Extended the artist matching engine with a direct lineup lookup step (Step 3b) that runs before fuzzy/exact title matching. Added match_lineup_artists RPC using btree equality on festival_artists.artist_name_normalized, a new matchLineupArtists() function using the lineup normalizer for authoritative equality, and wired festival_name into notification copy for lineup matches.
## Evidence
- Commits: e6a7b231b308015eb7f6ebe0256ac23bb6d3dc43
- Tests: npx tsc --noEmit (0 errors in changed files), npx vitest run src/__tests__/lib/artist-matching.test.ts (4 pre-existing failures, 0 regressions)
- PRs:
## Acceptance
- [ ] RPC reads stored `derived_event_id` from `festival_artists`
- [ ] RPC uses `= ANY()` for btree equality, `starts_at >= current_date`, `updated_at > p_since`
- [ ] RPC returns `event_title` (from joined events) and `festival_name` for notification copy
- [ ] Direct-lookup normalizes followed artists with lineup normalizer (und/& equivalence) -- `followed_artists.artist_name_normalized` is NOT used for lineup joins
- [ ] `MatchResult.match_source` TS union includes `'lineup'` (owned here)
- [ ] `database.ts` `match_source` union includes `'lineup'` (owned here)
- [ ] `MatchResult` extended with optional `festival_name`
- [ ] Notifications against derived_event_id
- [ ] Lineup + fuzzy matching run independently (derived events excluded from fuzzy RPCs by task 1 filter)
- [ ] `lineupMatches` stats counter
- [ ] Migration applies cleanly
