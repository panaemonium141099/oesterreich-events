# fn-25-ortsdatenqualitat-quelltreue-resolver.5 A5 Anreise-/Vertrauens-Gate ohne exact/verified/Adress-String

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
location-trust.ts: vertraut nur noch location_resolution.allowed.route, manual, json-ld-venue; Adress-String und exact/verified reichen nicht mehr. 8 Tests. PR #196.
## Evidence
- Commits: 1a4000e
- Tests: npx vitest run src/__tests__/lib/location-trust.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/196