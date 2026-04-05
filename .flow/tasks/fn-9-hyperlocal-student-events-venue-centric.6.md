# fn-9-hyperlocal-student-events-venue-centric.6 JSON-LD Connector: Schema.org Event extraction from venue pages

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Implemented JSON-LD connector that extracts Schema.org Event objects from venue web pages. Handles @graph arrays, all Event subtypes, nested subEvents, location/price/organizer/image extraction, venue data fallback, and date filtering. Includes 34 comprehensive tests.
## Evidence
- Commits: ac62d406e4ceeaadb5fb9dd23c21ba60b41b0c36
- Tests: npx vitest run src/__tests__/lib/connectors/json-ld-connector.test.ts
- PRs: