# fn-25-ortsdatenqualitat-quelltreue-resolver.14 C5 Ausspielungs-Gating nach Wissensstand (Detail, Karte, Umkreis, Hubs, API, JSON-LD, Widgets, Benachrichtigungen)

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
gating.ts (Pin/Route/Distanz/Gemeindeseite, Schalter NEXT_PUBLIC_LOCATION_GATING), Karten-Payload Bit 16 + MV-Spalten (Migration angewendet), Sammelmarker-Layer, Distanz-Gating Liste/Umkreis, JSON-LD geo, API-Felder. PR #200.
## Evidence
- Commits: PR200
- Tests: npx vitest run src/__tests__/lib/location-gating.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/200