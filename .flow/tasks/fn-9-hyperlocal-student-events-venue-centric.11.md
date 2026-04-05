# fn-9-hyperlocal-student-events-venue-centric.11 Scoring Enhancement: Localness + student relevance bonuses

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Enhanced the event scoring algorithm with venue/series bonuses: +10 for student-relevant venues, +5 for local venue types (bar/pub/nightclub), +5 for recurring series events, and +10 for student org sources. Extracted pure scoring logic to a testable module with 22 unit tests.
## Evidence
- Commits: 05e3aa54cb3a46c4eecf6632ec1fcbf20af1361a
- Tests: npx vitest run src/__tests__/calculate-scores.test.ts (22 passed), npx vitest run (436 passed, 22 files)
- PRs: