# fn-29-de-gemeinde-registry-gemeindekalender.18 Nachtlauf DE: Shards, Cursor, Rückzug, Nachprüfung, Dedup, Abdeckungsreport je Land

## Description
Eigene DE-Shards (in `scrape-events.yml` oder eigenem Workflow), Fortsetzungs-Cursor wie `rotation-cursor.ts`, Post-Processing (`withdrawal`, `admission_recheck`, `dedup`, `dedup_audit`) für DE prüfen; Pipeline-Report mit Abdeckung je Land und je Integration (Gemeinden mit mindestens einem Termin). Ein Adapter kommt erst nach bestandenem Prüfstand in den Lauf.

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Nachtlauf grün mit dem ersten Adapter, Laufzeit im Budget
- [ ] Dedup-Audit DE nicht schlechter als AT
- [ ] Report je Land und Integration im Report-Schritt

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
