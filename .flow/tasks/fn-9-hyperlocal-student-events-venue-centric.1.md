# fn-9-hyperlocal-student-events-venue-centric.1 DB Schema: Create venues + event_series tables, extend events

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Created venues (25 columns) and event_series tables in Supabase with RLS policies (public read, admin write), extended events table with venue_id/event_series_id/content_fingerprint columns, added TypeScript types (Venue, EventSeries, VenueInsert, EventSeriesInsert), and 10 new Vitest tests. Applied 5 migrations total including security fix for trigger search_path.
## Evidence
- Commits: e33bb5a35614767eab4125a419dd60573aff924d
- Tests: npm test (166 passed), npx tsc --noEmit (clean)
- PRs: