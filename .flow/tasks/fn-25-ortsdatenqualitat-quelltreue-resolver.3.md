# fn-25-ortsdatenqualitat-quelltreue-resolver.3 A3 Schreibpfad konservativ: keine Namensersetzung, keine Text-/Wort-Koordinaten, keine PLZ aus Koordinaten; Rohfelder + Entscheidungsspalten additiv

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Schreibpfad ohne Namensersetzung: src/lib/location/conservative-resolution.ts (Rohname, Quellkoordinaten mit Genauigkeitsangabe, PLZ nur aus genannten Angaben, Konflikt statt Raten), neue Spalten per Migration 20260913200000 (auf Prod angewendet), CONFIDENCE_RANK neu geordnet, 5-km-Sperre entfernt. PR #196 gemerged.
## Evidence
- Commits: 1a4000e
- Tests: npx vitest run src/__tests__/lib/location-conservative-resolution.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/196