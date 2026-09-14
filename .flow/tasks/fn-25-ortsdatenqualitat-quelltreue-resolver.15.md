# fn-25-ortsdatenqualitat-quelltreue-resolver.15 C6 Regressionssuite Review §9 inkl. Integrationstest nach DB-Triggern

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Regressionssuite: location-conservative-resolution (27), location-resolver (11), gemeinde-context (5), source-coords-policy (4), location-trust (8), location-gating (8), plz-district (+3); Integrationspruefung verify-location-contract.ts gegen Prod (14 Pruefungen, bestanden; Befund conflict->needs_review behoben). PR #200.
## Evidence
- Commits: PR200
- Tests: npx tsx --env-file=.env.local src/scripts/verify-location-contract.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/200