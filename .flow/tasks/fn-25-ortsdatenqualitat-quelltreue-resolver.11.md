# fn-25-ortsdatenqualitat-quelltreue-resolver.11 C2 PLZ-/Gemeinde-/Bezirksreferenz als Mengen; vollständige PLZ-Tabelle; keine Mehrheits-/Alphabetentscheide

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
PLZ-Referenz aus RTR (2.234 PLZ) als Mengen; districtFromPlz nur eindeutig, districtsForPlz, districtFromGemeinde; Schreibpfad bevorzugt belegte Gemeinde; Attribution /quellen. PR #199.
## Evidence
- Commits: a122735
- Tests: npx vitest run src/__tests__/lib/plz-district.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/199