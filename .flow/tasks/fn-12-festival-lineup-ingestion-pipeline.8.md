# fn-12-festival-lineup-ingestion-pipeline.8 Watcher job, notification wiring, and documentation

## Description

Lineup change detection, notification wiring using `festival_name` from `MatchResult`, post-scrape hook, and documentation.

**Size:** M
**Files:** `src/lib/lineup/watcher.ts`, `src/lib/artist-matching.ts` (notification copy in `createGroupedNotifications`), `src/lib/post-scrape-hook.ts`, `CLAUDE.md`, `CHANGELOG.md`

## Approach

**Lineup watcher** (`watcher.ts`):
- `detectLineupChanges()`: compare normalized name sets, return `{ added, removed, unchanged }`
- Watcher triggers re-scrape via the orchestrator (task 6) which owns the diff + deletions via `delete_derived_event` RPC. Watcher does NOT own deletion logic directly.
- `runLineupWatcher()`: re-check festivals with `lineup_last_checked_at` older than 24h

**Notification wiring** (in `artist-matching.ts:createGroupedNotifications()`):
- When `match_source = 'lineup'`, use `MatchResult.festival_name` (from RPC, task 7) for copy: "Artist spielt beim {festival_name}". No title-parsing needed -- festival_name is carried through the match result.
- Keep `type = 'spotify_match'`. Differentiate via body/title copy keyed on `match_source`.

**Post-scrape hook**: scrapers -> lineup scraping + derivation -> artist matching

**Docs**: CLAUDE.md table count (30), paths, scripts. CHANGELOG.md new phase section.

## Key context

- `createGroupedNotifications()` is where match notification title/body is composed
- `MatchResult.festival_name` (added in task 7) provides the festival name without parsing
- `delete_derived_event` RPC (task 1) handles atomic multi-table cleanup

## Acceptance
- [ ] `detectLineupChanges()` returns added/removed/unchanged
- [ ] Watcher triggers orchestrator for re-scrape (orchestrator owns add/remove via RPC)
- [ ] `createGroupedNotifications()` stores `festival_name` on group for lineup matches; uses "Artist spielt beim {festival_name}" copy (derived events can only be lineup-matched, never fuzzy-matched, so mixed groups don't occur)
- [ ] Notification type stays `'spotify_match'`
- [ ] Post-scrape hook: scrapers -> lineup -> matching
- [ ] `runLineupWatcher()` re-checks festivals older than 24h
- [ ] CLAUDE.md + CHANGELOG.md updated
- [ ] All existing tests pass

## Done summary
Added lineup watcher (detectLineupChanges + runLineupWatcher) for stale festival re-checks, updated notification copy to use lineup-specific German phrasing, wired the lineup pipeline into the post-scrape hook (scrapers -> lineup -> matching), and updated CLAUDE.md (table count 30, new paths/scripts) and CHANGELOG.md (fn-12 phase section).
## Evidence
- Commits: 79248f79d59f11564c7a6db84234a3e80347af84
- Tests: npx vitest run (815 passed, 26 pre-existing failures from external API timeouts), npx vitest run src/__tests__/lib/artist-matching.test.ts (30 passed, 4 pre-existing failures), npx vitest run src/__tests__/lineup/normalize.test.ts (57 passed)
- PRs: