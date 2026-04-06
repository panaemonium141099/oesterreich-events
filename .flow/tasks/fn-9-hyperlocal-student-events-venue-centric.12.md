# fn-9-hyperlocal-student-events-venue-centric.12 API: /api/venues endpoint + enhance /api/events with venue filters

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Created /api/venues endpoint with cursor pagination, bbox, type, bundesland, student_only, has_events, and search filters. Enhanced /api/events with venue_id, student_only, and localness_min query parameters for venue-centric filtering. Added 13 Vitest tests for the venues API.
## Evidence
- Commits: 5c80916a1a24957606dcd1548a387c361328e632
- Tests: npx vitest run src/__tests__/api/venues.test.ts, npm test -- --run
- PRs: