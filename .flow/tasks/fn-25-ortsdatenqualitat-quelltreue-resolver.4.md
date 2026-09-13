# fn-25-ortsdatenqualitat-quelltreue-resolver.4 A4 Nachtlauf: normalize/geocoding/master-coords standardmäßig aus; Master-Trigger und Bulk-RPC stilllegen

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Nachtlauf: normalize/geocoding/master_coords nur mit --legacy-geo, Skripte mit LEGACY_GEO_OK-Guard; Trigger trg_apply_master_coords entfernt, apply_master_coords_bulk No-op (Migration 20260913201000 auf Prod angewendet, verifiziert: 4 Trigger uebrig, RPC liefert 0 + WARNING). PR #196.
## Evidence
- Commits: 1a4000e
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/196