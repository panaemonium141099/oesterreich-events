# fn-4-massive-event-source-expansion-new.1 Infrastructure: ticket_url Field + Wirtschaft Category + Pipeline Prep

## Description
Add missing infrastructure to support the new scraper niches before building any scrapers.

**Size:** M
**Files:** `src/types/events.ts`, `src/lib/categories.ts`, `src/lib/db/queries.ts`, `src/lib/db/schema.ts`, `src/lib/db/supabase-sync.ts`

## Approach

1. Add `ticket_url?: string` to `ScrapedEvent` interface at `src/types/events.ts:34`
2. Add `ticket_url` column to SQLite events table in `src/lib/db/schema.ts`
3. Update `upsertEvent()` in `src/lib/db/queries.ts` to handle ticket_url field
4. Update `toSupabaseRow()` in `src/lib/db/supabase-sync.ts` to include ticket_url
5. Add "Wirtschaft" category to `src/lib/categories.ts` with keywords: wirtschaft, business, messe, kongress, konferenz, seminar, workshop, networking, karriere, jobmesse, branchentreffen, fachtagung, symposium, handelsmesse, gewerbe, unternehmer, startup, gruender, innovation
6. Update `categorizeEvent()` and `categorizeEventMulti()` to include new category

## Key context

- The scoring algorithm at `src/scripts/calculate-scores.ts` already awards +15 for ticket_url presence, but ScrapedEvent never passes it through
- The Supabase `Event` type already has ticket_url (line 26 of events.ts), so production DB schema is ready
- Categories are defined with priority order in `src/lib/categories.ts` — place "Wirtschaft" low priority so it doesn't override more specific categories
## Acceptance
- [ ] `ticket_url?: string` added to ScrapedEvent interface
- [ ] SQLite schema includes ticket_url column (with migration for existing DB)
- [ ] upsertEvent() stores ticket_url in SQLite
- [ ] toSupabaseRow() includes ticket_url in Supabase sync
- [ ] "Wirtschaft" category added with 15+ keywords covering business, trade, conferences
- [ ] categorizeEvent() and categorizeEventMulti() handle new category
- [ ] `npm run build` passes
- [ ] `npm test` passes
## Done summary
Added ticket_url field to ScrapedEvent interface and full pipeline (SQLite schema with migration, upsertEvent, toSupabaseRow). Added "Wirtschaft" category with 30 business/trade keywords, integrated into CATEGORIES, PRIORITY_ORDER, TagChip colors, PopularCategories images, and categoryImages fallbacks.
## Evidence
- Commits: e693ec24680d7724abed6012f9d0ae9c6fdd010b
- Tests: npm test (127 passed), npx tsc --noEmit (0 errors)
- PRs: