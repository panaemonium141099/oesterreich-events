# fn-18-freizeitaktivitaeten-poi-bestand.2 Deskline-Ingest-Script + woechentliche GH-Action

## Description
Deskline-`infrastructures`-Ingest als Standalone-Script mit Run-Bookkeeping + woechentlicher GH-Actions-Job. Kein Eintrag in der Scraper-Registry (die ist hart auf events verdrahtet, src/lib/scrapers/index.ts:494-571).

**Size:** M
**Files:** src/scripts/import-activities.ts, src/lib/activities/deskline-client.ts, .github/workflows/ingest-activities.yml, package.json (Script-Eintrag), FeratelScraper.ts (nur: REGIONS exportieren)

## Approach
- REGIONS (131 Slugs) aus src/lib/scrapers/FeratelScraper.ts:28-181 exportieren und importieren; fetch-Muster mit DW-Source/DW-SessionId-Headern + 429-Backoff analog FeratelScraper.ts:444-481; Concurrency <=6.
- Feldliste = bekanntes Schema (id,name,type,topics,location{town,coordinate},openingTimes,openStatus,images{copyright,license,author,urls},plainDescriptions,guestCards,onlineBookable); pageSize 400.
- Pipeline pro Objekt: UTF-8-Mojibake-Normalisierung -> GESPERRT-Praefix -> open_status + Name strippen -> Topic-Whitelist (Task 1) -> Gemeinde-Match -> Slug -> price_hint -> content_fingerprint.
- Run-Bookkeeping (Epic E6): Jeder Lauf schreibt eine poi_activity_runs-Zeile (regions_ok/regions_failed, is_complete = alle 131 Regionen versucht und 0 failed). Pro gesichteter Row: last_seen_run_id + seen_regions aktualisieren. `--region`/`--dry-run`-Laeufe schreiben is_complete=false und loesen NIE Prune aus.
- Prune: visible=false nur fuer Rows, deren last_seen_run_id aelter ist als die letzten 2 kompletten Laeufe. Teil-/Fehllaeufe koennen nichts verstecken (Test!).
- Dedup (Epic E11): primaer upsert onConflict (source,source_id); sekundaer nach jedem Lauf Fingerprint-Duplikate markieren (duplicate_of auf kanonische Row — aelteste sichtbare gewinnt — Nicht-Kanonische visible=false). Mirror-Overlap-Report loggen (GUID-Annahme bestaetigen/widerlegen).
- Upsert in 500er-Batches; JEDE Row traegt ALLE Spalten (PostgREST-NULL-Clobber-Falle, supabase-sync.ts:334-350); ANALYZE poi_activities am Ende; explizites process.exit(0) (CLAUDE.md-Muster).
- Flags: --region <slug>, --dry-run. Workflow analog .github/workflows/import-eventim.yml (cron woechentlich + workflow_dispatch mit dry_run, timeout-minutes, SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY aus Secrets).
## Approach
- REGIONS (131 Slugs) aus src/lib/scrapers/FeratelScraper.ts:28-181 exportieren und importieren; fetch-Muster mit DW-Source/DW-SessionId-Headern + 429-Backoff analog FeratelScraper.ts:444-481; Concurrency <=6.
- Feldliste = bekanntes Schema (id,name,type,topics,location{town,coordinate},openingTimes,openStatus,images{copyright,license,author,urls},plainDescriptions,guestCards,onlineBookable); pageSize 400.
- Pipeline pro Objekt: UTF-8-Mojibake-Normalisierung ("fA1/4r"-Muster) -> GESPERRT-Praefix -> open_status + Name strippen -> Topic-Whitelist (Task 1) -> Gemeinde-Match -> Slug -> price_hint.
- Upsert in 500er-Batches, onConflict (source,source_id); JEDE Row traegt ALLE Spalten (PostgREST-NULL-Clobber-Falle, supabase-sync.ts:334-350); last_seen_at je Lauf; visible=false nach 2 kompletten Laeufen ohne Sichtung, Regionen mit Fehlern vom Prune ausgenommen (Epic E6); ANALYZE poi_activities am Ende; explizites process.exit(0) (CLAUDE.md-Muster).
- Mirror-Verify (Gap-Analyse): einmalig zwei ueberlappende Regionen importieren und GUID-Overlap-Report loggen — bestaetigt/widerlegt die Dedup-Annahme.
- Flags: --region <slug>, --dry-run. Workflow analog .github/workflows/import-eventim.yml (cron woechentlich + workflow_dispatch mit dry_run, timeout-minutes, SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY aus Secrets).
## Acceptance
- [ ] `npx tsx src/scripts/import-activities.ts --region burgenland --dry-run` liefert >=2.000 POIs mit Koordinaten + Gemeinde-Zuordnung; schreibt is_complete=false und veraendert visible nicht
- [ ] Vollimport dokumentiert >=20.000 sichtbare Zeilen in poi_activities (nach Whitelist + Dedup); danach Index-Migration (Task 1) angewendet + ANALYZE
- [ ] Prune-Sicherheit getestet: simulierter Fehllauf (regions_failed nicht leer) versteckt keine Rows; erst 2 komplette Laeufe ohne Sichtung setzen visible=false
- [ ] Mirror-Overlap-Report im Log (GUID-Annahme verifiziert); Fingerprint-Dedup markiert Duplikate deterministisch (duplicate_of gesetzt, Kanonische bleibt sichtbar)
- [ ] ingest-activities.yml laeuft via workflow_dispatch gruen; Secrets-Doku (GitHub UND Vercel) im Workflow-Kommentar
- [ ] Vitest: Ingest-Transform (Mojibake, GESPERRT, NULL-Clobber-Schutz: jede Batch-Row enthaelt alle Spalten), Prune-Logik, Fingerprint-Dedup-Regel
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
