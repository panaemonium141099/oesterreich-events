# fn-9-hyperlocal-student-events-venue-centric.9 Registry-Based Scraper: Orchestrate venue feed ingestion pipeline

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Implemented the registry-based venue feed ingestion orchestrator (RegistryBasedScraper) that queries Supabase for venues with active ICS/JSON-LD feeds, dispatches to the appropriate connector, runs content deduplication, attaches venue_id to events, and syncs to Supabase. Includes CLI script (scrape-venues.ts) with filtering options and 13 unit tests.
## Evidence
- Commits: 05e3aa5, a807bb0e3eda18fa22ff58ec0bd25eb2ee9399b2
- Tests: npx vitest run (436 tests, 22 files, all passing)
- PRs: