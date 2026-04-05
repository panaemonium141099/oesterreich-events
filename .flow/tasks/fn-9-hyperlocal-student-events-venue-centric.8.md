# fn-9-hyperlocal-student-events-venue-centric.8 Event Series Detection: Recurring event grouping + series table

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Implemented event series detection pipeline that groups recurring events by normalized title + venue/city, detects weekly recurrence patterns via day-of-week analysis, and generates iCal RRULE strings. Includes confidence scoring and 57 comprehensive tests.
## Evidence
- Commits: 7cc515083556c0cb516dd36e41676e348f9a1861
- Tests: npm test -- --run
- PRs: