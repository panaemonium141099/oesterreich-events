# fn-29-de-gemeinde-registry-gemeindekalender.18 Nachtlauf DE: Shards, Cursor, Rückzug, Nachprüfung, Dedup, Abdeckungsreport je Land

## Description
Eigene DE-Shards (in `scrape-events.yml` oder eigenem Workflow), Fortsetzungs-Cursor wie `rotation-cursor.ts`, Post-Processing (`withdrawal`, `admission_recheck`, `dedup`, `dedup_audit`) für DE prüfen; Pipeline-Report mit Abdeckung je Land und je Integration (Gemeinden mit mindestens einem Termin). Ein Adapter kommt erst nach bestandenem Prüfstand in den Lauf.

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Nachtlauf grün mit dem ersten Adapter, Laufzeit im Budget
- [ ] Dedup-Audit DE nicht schlechter als AT
- [ ] Report je Land und Integration im Report-Schritt

## Done summary
DE-Nachtlauf live (PR #427, Nachbesserung PR #431). Job scrape-de mit 3 Shards in scrape-events.yml, 19 Adapter über DE_NACHTLAUF (nolis und de-amt-vg draußen), Sperre je Website über Adapter hinweg, Zeitbudget 180 min, Cursor für iKISS und verwaltungsportal. Dedup schreibt je Land (dedup_runs.country, Migration 20261102120000 in Prod), Audit je Land, Schritt coverage je Land, Bundesland und Integration.

Lauf 41510542764 (workflow_dispatch scraper=de): drei DE-Shards grün (31 min, 1 h 38, 3 h 16). Dedup DE written (677 neu, 28 Freigaben), AT valve_stopped unabhängig davon (Rückstau seit 18.10., eigene Session, PR #430). Audit DE 3 Restdubletten bei 74.345 sichtbaren (0,4 je 10.000) gegen AT 843 je 10.000. Abdeckung DE 2.135 von 10.749 Gemeinden (19,9 %). Rot war der Post-Job nur wegen AT-Ventil, AT-Audit und de-allgemein (500 Zeilen, Connect-Timeout zu api.lasstreffen.at während eines OOM am Server um 20:01).
Zweite Nacht (Lauf 41612655661, planmäßig): alle 13 Shards grün, DE erneut written (407 neu), iKISS 183 min, verwaltungsportal 181 min.
## Evidence
- Commits:
- Tests: vitest de-nachtlauf.test.ts grün, CI PR #431 grün
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/427, https://github.com/panaemonium141099/oesterreich-events/pull/431