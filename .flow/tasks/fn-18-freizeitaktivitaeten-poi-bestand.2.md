# fn-18-freizeitaktivitaeten-poi-bestand.2 Deskline-Ingest-Script + woechentliche GH-Action

## Description
Deskline-`infrastructures`-Ingest als Standalone-Script + woechentlicher GH-Actions-Job. Kein Eintrag in der Scraper-Registry (die ist hart auf events verdrahtet, src/lib/scrapers/index.ts:494-571).

**Size:** M
**Files:** src/scripts/import-activities.ts, src/lib/activities/deskline-client.ts, .github/workflows/ingest-activities.yml, package.json (Script-Eintrag), FeratelScraper.ts (nur: REGIONS exportieren)

## Approach
- REGIONS (131 Slugs) aus src/lib/scrapers/FeratelScraper.ts:28-181 exportieren und importieren; fetch-Muster mit DW-Source/DW-SessionId-Headern + 429-Backoff analog FeratelScraper.ts:444-481; Concurrency <=6.
- Feldliste = bekanntes Schema (id,name,type,topics,location{town,coordinate},openingTimes,openStatus,images{copyright,license,author,urls},plainDescriptions,guestCards,onlineBookable); pageSize 400.
- Pipeline pro Objekt: UTF-8-Mojibake-Normalisierung ("fA1/4r"-Muster) -> GESPERRT-Praefix -> open_status + Name strippen -> Topic-Whitelist (Task 1) -> Gemeinde-Match -> Slug -> price_hint.
- Upsert in 500er-Batches, onConflict (source,source_id); JEDE Row traegt ALLE Spalten (PostgREST-NULL-Clobber-Falle, supabase-sync.ts:334-350); last_seen_at je Lauf; visible=false nach 2 kompletten Laeufen ohne Sichtung, Regionen mit Fehlern vom Prune ausgenommen (Epic E6); ANALYZE poi_activities am Ende; explizites process.exit(0) (CLAUDE.md-Muster).
- Mirror-Verify (Gap-Analyse): einmalig zwei ueberlappende Regionen importieren und GUID-Overlap-Report loggen — bestaetigt/widerlegt die Dedup-Annahme.
- Flags: --region <slug>, --dry-run. Workflow analog .github/workflows/import-eventim.yml (cron woechentlich + workflow_dispatch mit dry_run, timeout-minutes, SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY aus Secrets).
## Acceptance
- [ ] `npx tsx src/scripts/import-activities.ts --region burgenland --dry-run` liefert >=2.000 POIs mit Koordinaten + Gemeinde-Zuordnung
- [ ] Vollimport dokumentiert >=20.000 sichtbare Zeilen in poi_activities (nach Whitelist + Dedup); danach Index-Migration (Task 1) angewendet + ANALYZE
- [ ] Mirror-Overlap-Report im Log (Annahme verifiziert oder Dedup-Strategie angepasst)
- [ ] ingest-activities.yml laeuft via workflow_dispatch gruen; Secrets-Doku (GitHub UND Vercel) im Workflow-Kommentar
- [ ] Vitest: Ingest-Transform (Mojibake, GESPERRT, NULL-Clobber-Schutz: jede Batch-Row enthaelt alle Spalten)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
