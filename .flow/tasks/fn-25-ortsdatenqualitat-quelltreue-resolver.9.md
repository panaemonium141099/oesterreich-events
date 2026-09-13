# fn-25-ortsdatenqualitat-quelltreue-resolver.9 B3 Adapter-Prüfung: kultur-graz, mariazell, meinbezirk, feratel (DE-Regionen), Veranstalteradressen, Hauptstadt-Fallbacks

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Adapter-Pruefung: Gemeinde-Kalender (applyGemeindeContext), Feratel (place/town, Genauigkeit, keine Regions-Fallbacks, country), RegistryBased (source_venue_id), MeinBezirk, KulturGraz, Mariazell (Fliesstext-Orte), source-coords-policy fuer Clubs/Museen/Boudicca/Stadtkalender/Portale. PR #198.
## Evidence
- Commits: c097ade
- Tests: npx vitest run src/__tests__/lib/gemeinde-context.test.ts src/__tests__/lib/source-coords-policy.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/198