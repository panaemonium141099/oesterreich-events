# fn-9-hyperlocal-student-events-venue-centric.5 ICS Connector: node-ical parser with RRULE expansion + DST handling

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
ICS Connector implemented with node-ical parser, RRULE expansion (90-day window), and DST-safe date handling via luxon. Supports single/recurring/all-day events, EXDATE exclusions, GEO coordinates, organizer extraction, and configurable venue defaults. 16 Vitest tests pass.
## Evidence
- Commits: 8a082be2ab197e591d9236603a414444d4ad8c55, ac62d406e4ceeaadb5fb9dd23c21ba60b41b0c36
- Tests: npx vitest run src/__tests__/lib/connectors/ics-connector.test.ts (16 passed)
- PRs: