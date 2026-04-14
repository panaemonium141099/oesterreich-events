# fn-12-festival-lineup-ingestion-pipeline.6 Lineup orchestrator and derived event generator

## Description

Build the `FestivalLineupOrchestrator` that reads festivals from the database, dispatches to the correct lineup scraper, upserts `festival_artists` rows (with app-normalized names), generates derived events in the `events` table, and backlinks `festival_artists.derived_event_id` + touches `updated_at`. Create the CLI script.

**Size:** M
**Files:** `src/lib/lineup/orchestrator.ts`, `src/lib/lineup/derive-events.ts`, `src/scripts/scrape-festival-lineups.ts`, `package.json` (add script)

## Approach

**Orchestrator** (`orchestrator.ts`):
- Query `festivals` WHERE `direct_lineup_candidate = true` AND `lineup_url IS NOT NULL`
- Look up scraper from `src/lib/lineup/scrapers/index.ts` by slug; skip if no scraper (log warning)
- Run scraper, collect `FestivalLineupResult`
- Compute lineup hash: `sha256(sorted normalized artist names joined by '|')`
- Compare with `festivals.lineup_hash` -- skip if unchanged
- If changed: compute diff between scraped artists and existing `festival_artists` rows for this festival.
  - **Added artists**: upsert new `festival_artists` rows with `artist_name_normalized` computed by normalization module from task 3 (app-side, NOT DB-generated). ON CONFLICT (festival_id, artist_name_normalized) DO UPDATE.
  - **Removed artists** (in DB but not in fresh scrape): if `derived_event_id IS NOT NULL`, call `delete_derived_event` RPC (task 1) for atomic cleanup. If `derived_event_id IS NULL` (never derived), delete the `festival_artists` row directly. The orchestrator owns removals -- the watcher (task 8) only triggers re-scrapes, not deletions.
- Update `festivals.lineup_hash` and `lineup_last_checked_at`
- Track stats: festivals_checked, festivals_changed, artists_added, artists_removed
- Follow `RegistryBasedScraper.ts` orchestration pattern

**Derived event generator** (`derive-events.ts`):
- For each `festival_artists` row WHERE `derived_event_id IS NULL`:
  - Compose title: "{artist_name_raw} at {festival.canonical_name}"
  - Inherit location from parent event (via `festivals.parent_event_id`); if no parent, use festival city/state (coords NULL)
  - Set `source_type = 'derived'`, `source_name = 'festival-lineup'`, `parent_event_id`
  - Set `start_date` from day_label (if resolvable) or festival.starts_at
  - Generate `content_fingerprint` via `src/lib/dedup/fingerprint.ts:generateFingerprint()`
  - Upsert into `events` (ON CONFLICT content_fingerprint DO UPDATE), capture returned `id`
  - **Backlink**: `UPDATE festival_artists SET derived_event_id = <id>, updated_at = now() WHERE id = <row_id>`
  - The `updated_at` touch is critical: task 7's RPC filters on `updated_at > p_since` to find newly-derivated rows
- Derived events bypass `deduplicateEvents()` entirely.

**CLI script** (`scrape-festival-lineups.ts`):
- `--dry-run`, `--festival <slug>`, `--force` (ignore hash)
- Add `"scrape:festival-lineups"` to package.json

## Key context

- `artist_name_normalized` is populated by the app using `normalizeArtistName()` from task 3 -- same normalizer used by the matching RPC (task 7). Both sides are app-driven, ensuring consistency.
- `updated_at` touch on backlink is the incremental-matching trigger. Without it, pre-existing rows with `created_at` before the cursor would never be matched.

## Acceptance
- [ ] Orchestrator queries festivals with `direct_lineup_candidate = true`
- [ ] `festival_artists.artist_name_normalized` populated by app-side `normalizeArtistName()` (not DB generated)
- [ ] Derived events generated with `source_type = 'derived'` and `parent_event_id`
- [ ] `festival_artists.derived_event_id` backlinked + `updated_at` touched
- [ ] Lineup hash comparison skips unchanged festivals
- [ ] Removed artists (in DB but not in scrape) cleaned up via `delete_derived_event` RPC
- [ ] Derived events bypass dedup (ON CONFLICT content_fingerprint)
- [ ] Title format: "{Artist} at {Festival}"
- [ ] CLI with `--dry-run`, `--festival`, `--force`
- [ ] `npm run scrape:festival-lineups` in package.json
- [ ] Stats printed

## Done summary
Built the FestivalLineupOrchestrator that queries eligible festivals, dispatches to registered lineup scrapers, computes lineup hash diffs, upserts/removes festival_artists with app-side normalizeArtistName(), generates derived "Artist at Festival" events with source_type='derived' and content_fingerprint dedup, backlinks derived_event_id + touches updated_at, and provides a CLI script with --dry-run/--festival/--force/--verbose flags.
## Evidence
- Commits: 0d23b17f329474b19ae62cf0770f7f1222503567
- Tests: npx vitest run src/__tests__/lineup/, npx tsc --noEmit | grep orchestrator
- PRs: