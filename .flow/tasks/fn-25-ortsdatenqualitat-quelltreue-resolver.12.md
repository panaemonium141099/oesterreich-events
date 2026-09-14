# fn-25-ortsdatenqualitat-quelltreue-resolver.12 C3 Resolver mit Genauigkeit, Herkunft, Konfliktregeln und erlaubter Ausspielung; alle Geo-Schreibpfade über den Vertrag

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Resolver mit Belegen (source_venue_map, Venue-Kandidat mit zweitem Beleg, Adress-Geocode), Evidenzlader, re-resolve mit updated_at-Schutz, Adress-Geocoder-Nachtjob, Vertrag in Inserate/Lineup-Pfaden, Migration 20260913210000 auf Prod. PR #199.
## Evidence
- Commits: a122735
- Tests: npx vitest run src/__tests__/lib/location-resolver.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/199