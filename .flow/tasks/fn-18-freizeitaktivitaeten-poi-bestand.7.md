## Description
OSM-Volumen-Slice in strikt getrennter Tabelle + Abschluss-Doku des Epics.

**Size:** M
**Files:** supabase/migrations/<ts>_osm_pois.sql, supabase/migrations/<ts>_osm_pois_indexes.sql (separat, nach Bulk-Load; ANALYZE-Ops-Note im Header), src/scripts/import-osm-pois.ts, Gemeinde-Hub-Sektion (Erweiterung), src/app/[locale]/quellen/page.tsx, CLAUDE.md, docs/MASTERPLAN.md, CHANGELOG.md

## Approach
- ODbL-Regeln (Epic-Entscheidung, OSMF Collective-Database-Guideline): osm_pois strikt getrennt befuellen; NIEMALS Merge/Dedup/Join-Schreibpfade zwischen osm_pois und poi_activities/Venues; Anzeige-Verknuepfung nur zur Laufzeit (Geo-Query).
- Import: Vorlage src/scripts/import-osm-venues.ts + fetch-overpass-all (package.json:60-62). Bevorzugt Geofabrik austria-latest.osm.pbf + osmium tags-filter mit kuratierter Whitelist (leisure=playground/park/swimming_*, tourism=museum/viewpoint/attraction/zoo, attraction=summer_toboggan/water_slide, sport=climbing/toboggan, natural=beach...); Fallback Overpass-batched falls osmium-Toolchain im CI zu schwer. Entscheidung nach Probelauf im Task dokumentieren.
- Batches <=500, Indizes nach Load (separate Migration wie Task 1); ANALYZE osm_pois ist dokumentierter Ops-Schritt via Dashboard (PostgREST kann kein Maintenance-SQL — gleiche Regel wie Task 2), NICHT Script-Schritt.
- Anzeige NUR in Gemeinde-Hub-Listen (mit OSM-Marker/Badge) — KEINE eigenen Detailseiten (Thin-Content + ODbL-Herausgabe-Umfang klein halten).
- Attribution: "(c) OpenStreetMap contributors" + ODbL-Link auf /quellen UND an der Hub-Sektion.
- Abschluss-Doku: CLAUDE.md (Wichtige Pfade: /aktivitaet, /api/activities, import-activities; Betrieb: ingest-activities.yml; Bekannte Issues: Viator-Rate-Limit), MASTERPLAN (Monetarisierung Viator/GYG, Roadmap-Status), CHANGELOG-Eintrag.

## Acceptance
- [ ] >=50.000 AT-POIs in osm_pois (kuratierte Whitelist, mit Koordinaten + Gemeinde-Zuordnung)
- [ ] Kein Code-/SQL-Pfad merged oder deduped osm_pois mit poi_activities/Venues (Review-Check dokumentiert)
- [ ] Hub-Listen zeigen OSM-Eintraege mit Quellen-Badge; Attribution "(c) OpenStreetMap contributors" + ODbL-Link auf /quellen und an der Sektion
- [ ] CLAUDE.md, MASTERPLAN, CHANGELOG aktualisiert (Doku-Gaps aus Scout-Report abgearbeitet)
- [ ] Import reproduzierbar dokumentiert (Kommando + Laufzeit + Zeilenzahl); ANALYZE als Ops-Schritt im Migrations-Header dokumentiert

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
