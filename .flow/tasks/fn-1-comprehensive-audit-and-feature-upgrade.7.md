# fn-1-comprehensive-audit-and-feature-upgrade.7 Multi-Tag System DB Schema and API

## Description
Implement multi-category/tag system at the database and API level. Currently events have a single `category TEXT` column. Add a Supabase `event_tags` junction table and update the events API to support filtering by multiple tags. Keep backwards compatibility — existing `category` param still works.

**Size:** M
**Files:** supabase migration (new), src/app/api/events/route.ts, src/types/events.ts, src/types/database.ts, src/lib/categories.ts, src/lib/db/schema.ts

## Approach
- Create Supabase migration: `event_tags` table with `event_id UUID REFERENCES events(id)`, `tag TEXT`, primary key `(event_id, tag)`, GIN index on tag for array queries
- Add RLS policy on `event_tags` — public read, admin/god write
- Run migration to populate `event_tags` from existing `category` column (`INSERT INTO event_tags SELECT id, category FROM events WHERE category IS NOT NULL`)
- Keep `category` column for backwards compatibility but deprecate it
- Update events API: add `tags` query param that accepts comma-separated tags, filter using `event_tags` join
- Keep existing `category` param working (single tag filter)
- Update `EventFilters` type to include `tags: string[]`
- Update `categorizeEvent()` in `src/lib/categories.ts` to return multiple tags based on keyword analysis
- Update SQLite schema in `src/lib/db/schema.ts` with `event_tags` table for staging DB consistency

## Key context
- Current 13 categories are hardcoded as union type in `src/types/events.ts:69-82`
- `tags` field already exists on the TypeScript `Event` type as `string[] | null` — stored as JSON in SQLite
- The existing `tags` field may already be used by some scrapers — check `src/lib/scrapers/index.ts` for tag handling
- 44 scrapers assign `category` as a string — they continue working via the migration, but new scrape runs should write to `event_tags`
## Acceptance
- [ ] `event_tags` Supabase migration created and applied
- [ ] RLS policy: public read, authenticated admin/god write
- [ ] Existing events migrated: `event_tags` populated from `category` column
- [ ] Events API accepts `tags` param for multi-tag filtering
- [ ] Existing `category` param still works (backwards compatible)
- [ ] `EventFilters` type updated with `tags: string[]`
- [ ] `categorizeEvent()` returns multiple tags
- [ ] SQLite schema updated with `event_tags` table
- [ ] `npm run build` succeeds
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
