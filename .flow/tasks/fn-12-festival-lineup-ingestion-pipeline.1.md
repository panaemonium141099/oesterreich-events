# fn-12-festival-lineup-ingestion-pipeline.1 Database schema migration: festivals, festival_artists, events extensions

## Description

Create a Supabase migration that adds the `festivals` and `festival_artists` tables, extends the `events` table with `parent_event_id`, widens existing constraints, adds a cleanup RPC, and sets up RLS + indexes. Also update `src/types/database.ts` for all schema changes.

**Size:** M
**Files:** `supabase/migrations/YYYYMMDD_festival_lineup_schema.sql`, `src/types/database.ts`

## Approach

- `festivals` table: uuid PK, canonical_name, slug (unique), website_url, lineup_url, city, state, starts_at, ends_at, genres, registry_source, spotify_priority, direct_lineup_candidate, lineup_fetch_mode, lineup_status (default 'unknown'), lineup_hash, lineup_last_checked_at, parent_event_id (FK to events), created_at, updated_at
- `festival_artists` table: uuid PK, festival_id (FK to festivals ON DELETE CASCADE), artist_name_raw NOT NULL, **artist_name_normalized TEXT NOT NULL** (regular stored column, NOT a generated column -- the app-side normalization from task 3 is richer than what `lower()` can do: diacritics, feat/b2b stripping, etc.), day_label, stage_name, billing, source_url, source_type, confidence_score, spotify_artist_id, matched_by, derived_event_id (FK to events ON DELETE SET NULL, nullable), created_at, **updated_at** (with DEFAULT now(), updated when derived_event_id is set)
- Add `events.parent_event_id UUID REFERENCES events(id) ON DELETE SET NULL`
- **Widen `events.source_type` via self-contained `DO $$ ... $$` block**: introspect whether the column uses a Postgres ENUM or a CHECK constraint and apply the correct ALTER. No manual probing required -- the migration is idempotent.
- **Widen `artist_event_notifications.match_source` CHECK** (named constraint at `20260407_artist_alerts_schema.sql:127`): use `DROP CONSTRAINT IF EXISTS` for robustness across environments, then recreate to include `'lineup'`.
- **Cleanup RPC** `delete_derived_event(p_event_id UUID)`: single-transaction `SECURITY DEFINER` function with fixed `search_path = 'public'` and `REVOKE ALL ... GRANT EXECUTE TO service_role`. Delete order (respects FK ON DELETE SET NULL on festival_artists.derived_event_id): `festival_artists WHERE derived_event_id = p_event_id` FIRST, then `notifications WHERE event_id = p_event_id`, `saved_events WHERE event_id = p_event_id`, `artist_event_notifications WHERE event_id = p_event_id`, `events WHERE id = p_event_id` LAST. Includes a guard: verify `events.source_type = 'derived'` for p_event_id (no-op if not derived, prevents accidental parent event deletion).
- **Re-create existing matching RPCs via `CREATE OR REPLACE FUNCTION`** in the NEW migration file (do NOT edit the old `20260407_artist_matching_functions.sql`). The three functions (`match_exact_artist_title`, `match_fuzzy_artist_titles`, `match_artist_descriptions`) must add a null-safe filter: `AND e.source_type IS DISTINCT FROM 'derived'` to exclude derived events from fuzzy/exact title matching. Derived events contain artist names in their titles ("Volbeat at Nova Rock 2026"), which would cause false positives. Derived events are matched only via the deterministic lineup lookup RPC (task 7).
- Btree index on `festival_artists(artist_name_normalized)` for equality joins
- Partial index on `events(parent_event_id) WHERE parent_event_id IS NOT NULL`
- Unique constraint on `festival_artists(festival_id, artist_name_normalized)` -- v1 stores ONE row per artist per festival. `day_label`/`stage_name` are best-effort metadata that may be overwritten on re-scrape. Multi-slot appearances (same artist different days) are collapsed.
- RLS: `festivals` and `festival_artists` public-read using `USING (true)`. Service-role-only for writes.
- **Update `src/types/database.ts`**: add `'derived'` to `source_type` union, add `parent_event_id` to events type, add `festivals` and `festival_artists` table types. Do NOT update `match_source` TS types here -- owned by task 7 which also updates `MatchResult`.

## Key context

- `artist_name_normalized` is a regular column because the normalization pipeline (task 3) strips diacritics, removes feat/b2b/DJ Set modifiers, handles "&" exceptions -- far beyond what a SQL `lower()` generated column can do. The app writes the normalized value at insert time.
- `festival_artists.updated_at` is needed for incremental matching (task 7) -- the RPC filters on `updated_at > p_since` to catch rows that were recently backlinked with derived_event_id.
- The cleanup RPC ensures atomic deletion without relying on FK cascade assumptions for `saved_events`.

## Acceptance
- [ ] `festivals` table created with all columns, PK, unique slug
- [ ] `festival_artists` table with `artist_name_normalized` as regular NOT NULL column (not generated)
- [ ] `festival_artists` includes `derived_event_id` nullable FK and `updated_at` column
- [ ] `events.parent_event_id` added as nullable UUID FK with ON DELETE SET NULL
- [ ] `events.source_type` constraint widened via self-contained DO block (handles both ENUM and CHECK)
- [ ] `artist_event_notifications.match_source` CHECK widened to include `'lineup'`
- [ ] Cleanup RPC `delete_derived_event` created for atomic multi-table deletion
- [ ] `src/types/database.ts` updated for all new columns/tables/constraints
- [ ] RLS with `USING (true)` for public SELECT
- [ ] Btree index on `festival_artists(artist_name_normalized)`
- [ ] Unique partial index on `events(content_fingerprint) WHERE source_type = 'derived' AND content_fingerprint IS NOT NULL` (scoped to derived to avoid legacy collisions)
- [ ] Cleanup RPC guards against non-derived events (no-op if `source_type != 'derived'`)
- [ ] Cleanup RPC deletes festival_artists FIRST (before events) to avoid ON DELETE SET NULL nullifying the FK
- [ ] Cleanup RPC is `SECURITY DEFINER` with EXECUTE restricted to `service_role`
- [ ] Existing matching RPCs exclude `source_type = 'derived'` via `CREATE OR REPLACE` in the new migration file (not by editing old migration)
- [ ] Migration applies cleanly

## Done summary
Created Supabase migration adding festivals and festival_artists tables, extended events with parent_event_id and widened source_type/match_source constraints, added delete_derived_event cleanup RPC, and updated matching RPCs to exclude derived events. Updated src/types/database.ts with all schema changes.
## Evidence
- Commits: 27be700062ccbec47ad3c938a3cfde6a6f0e9653
- Tests: npm test (728 passed, 26 failed from unrelated Overpass API timeouts), Supabase migration applied successfully, Security advisor verified no new issues
- PRs: