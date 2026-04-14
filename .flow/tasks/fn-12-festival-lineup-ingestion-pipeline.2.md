# fn-12-festival-lineup-ingestion-pipeline.2 TypeScript types and festival seed script

## Description

Add TypeScript interfaces for the new `festivals` and `festival_artists` tables, extend `Event`/`ScrapedEvent` types with `parent_event_id` and `source_type`, and build a CLI seed script that imports the 172-entry mica austria registry JSON into the `festivals` table. Include a deterministic parent-event linking strategy.

**Size:** M
**Files:** `src/types/festivals.ts`, `src/types/events.ts` (extend), `src/scripts/seed-festivals.ts`, `data/festival-seed-registry.json`, `package.json` (add script)

## Approach

- New `src/types/festivals.ts`: `Festival`, `FestivalArtist` (including optional `derived_event_id`), `FestivalLineupResult`, `LineupFetchMode`, `LineupStatus` interfaces
- Extend `Event` and `ScrapedEvent` in `src/types/events.ts` with optional `parent_event_id: string` and `source_type: string`
- Seed script reads from `data/festival-seed-registry.json` (copy seed JSON to data/ dir)
- Parse fields: start_date, end_date, name, genres, city, state, website, slug, spotify_priority_inferred, direct_lineup_candidate_inferred, registry_source
- Batch upsert into `festivals` table using Supabase client (ON CONFLICT slug DO UPDATE)
- **Parent-event linking strategy** (deterministic scoring):
  1. Search `events` WHERE `title ILIKE '%' || festival_name_tokens || '%'` AND `start_date` overlaps festival date range AND (`location_name ILIKE '%' || festival.city || '%'` OR `bundesland = festival.state`)
  2. Score each candidate: +1 for city found in `location_name`, +1 for `bundesland` match, +1 for date overlap, +2 for all festival name words found in `title`
  3. Link only if exactly ONE candidate scores >= 3 (high confidence). If zero or multiple candidates found, leave `parent_event_id` as NULL.
  4. Log unlinked festivals for manual review.
- Support `--dry-run` flag (following pattern from `match-artists.ts`)
- Add `"seed:festivals": "tsx --env-file=.env.local src/scripts/seed-festivals.ts"` to package.json

## Key context

- Seed JSON: 172 entries, start_date M/D/YYYY, end_date may be empty, genres comma-separated codes
- Genre codes: K=Klassik, J=Jazz, P=Pop/Rock, E=Elektronik, H=Hip-Hop, G=Global, N=Neue Musik, I=Interdisziplinar
- Follow `src/scripts/match-artists.ts` for CLI argument parsing
- Parent-event linking is best-effort. NULL parent_event_id is acceptable.

## Acceptance
- [ ] `Festival` and `FestivalArtist` TypeScript interfaces exported from `src/types/festivals.ts`
- [ ] `FestivalArtist` includes optional `derived_event_id: string`
- [ ] `Event` type extended with optional `parent_event_id` and `source_type` fields
- [ ] Seed JSON copied to `data/festival-seed-registry.json`
- [ ] `seed-festivals.ts` script parses all 172 entries and upserts into `festivals` table
- [ ] Parent-event linking uses scoring heuristic (title token match + date overlap + `location_name` contains city + `bundesland` match)
- [ ] Does NOT set parent_event_id when multiple candidates found (ambiguous)
- [ ] `--dry-run` flag prints what would be inserted without writing
- [ ] Date parsing handles M/D/YYYY format and empty end_date
- [ ] `npm run seed:festivals` script added to package.json

## Done summary
Added TypeScript interfaces for festivals/festival_artists tables, extended Event/ScrapedEvent types with parent_event_id and source_type, created seed-festivals.ts CLI script that imports 172-entry mica austria registry with M/D/YYYY date parsing, batch Supabase upsert (ON CONFLICT slug), deterministic parent-event linking via scoring heuristic, and --dry-run support.
## Evidence
- Commits: 380bf7639611e995c82bdd20f0b2ef472a90ff75
- Tests: npx tsc --noEmit src/types/festivals.ts src/types/events.ts, npx tsc --noEmit src/scripts/seed-festivals.ts, npm test (785 passed, 26 pre-existing failures), npx vitest run src/__tests__/lineup/ (57 passed), npx tsx --env-file=.env.local src/scripts/seed-festivals.ts --dry-run (172 entries parsed)
- PRs: