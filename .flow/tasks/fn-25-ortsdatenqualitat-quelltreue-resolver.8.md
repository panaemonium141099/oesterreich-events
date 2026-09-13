# fn-25-ortsdatenqualitat-quelltreue-resolver.8 B2 Eventim-Mapper: eventCity, eventVenueId, Originalkoordinaten erhalten; PLZ-Zentren nur als Gebietsangabe

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Eventim-Mapper: kein PLZ-Mittelpunkt als Position, eventCity->city, eventVenueId->source_venue_id, coords_precision venue. Tests parse.test erweitert. PR #197.
## Evidence
- Commits: b4259f1
- Tests: npx vitest run src/__tests__/lib/eventim/parse.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/197