# Ortsdaten: Produktionsstand und Inventar der Geo-Schreibpfade (2026-09-13)

Erhoben vor Beginn der Sanierung (Epic fn-25, Phase A1). Quelle: SSH auf
`157.180.42.4` (`/opt/app`, `/opt/supabase`), `psql` als `supabase_admin`,
Repo-Stand `2818fbd`. Der GitHub-Stand entspricht dem Deploy auf Hetzner
(`/opt/app/src` steht auf `2818fbd`).

## 1. Laufzeitumgebung

| Komponente | Stand |
|---|---|
| App-Container (`nextjs-app`) | Commit `2818fbd` (deploy.sh: `git reset --hard origin/master` bei jedem Push) |
| Postgres | 17.6, self-hosted Supabase v0.8.0, PostgREST `PGRST_DB_MAX_ROWS=1000` |
| Live-Bestand | 82.405 Events `published` mit `start_date >= now()` |

## 2. Laufende Jobs, die Ortsfelder schreiben

### GitHub Actions
| Workflow | Zeitplan | Skripte (Geo-Relevanz) |
|---|---|---|
| `scrape-events.yml` | täglich 03:17 Europe/Vienna | 10 Shards `scrape.ts --shard i/10` → `syncEventsToSupabase()`; danach Post-Job `scrape-pipeline.ts --trigger … --skip-scrapers --skip-venues` mit den Schritten `normalize` (`normalize-locations.ts`, **alle** Events), `geocoding` (`fix-geocoding.ts`, `openai-geocode.ts --null`), `master_coords` (`fix-duplicate-coords.ts --pipeline-mode`), `scoring`, `dedup`, `artist_matching`, `indexing`, `report`. Kein Skip-Schalter für `normalize`. |
| `import-eventim.yml` | alle 6 h (`40 */6 * * *`) | `import-eventim.ts` → `syncEventsToSupabase()` |
| `ingest-activities.yml`, `refresh-viator.yml` | wöchentlich / täglich | POIs, nicht `events` |

### systemd-Timer auf Hetzner (`lt-cron@<name>.timer`)
`sync-feratel` (stündlich, `FeratelScraper` → `syncEventsToSupabase()`),
`warm-cache`, `send-reminders`, `lifecycle-emails`, `newsletter-weekly`,
`outreach-*`, `seo-*`, `expire-boosts`, `workflow-reports`; dazu
`lt-db-backup`, `lt-isr-guard`, `lt-translate-backfill`, `lt-watchdog`.
Nur `sync-feratel` schreibt Ortsfelder.

### pg_cron (7 Jobs)
`refresh-event-stats-cache` (30 min), `refresh_event_map_points` (stündlich,
MV filtert `latitude IS NOT NULL`), `archive-old-events`, `rollup-analytics-daily`,
`purge-analytics-raw`, `recompute-activity-scores`, `match-artists-pipeline`.
Keiner schreibt Ortsfelder.

## 3. Datenbankobjekte mit Ortslogik

| Objekt | Wirkung |
|---|---|
| Trigger `trg_apply_master_coords` BEFORE INSERT OR UPDATE OF location_name, postal_code, latitude, longitude | Setzt `latitude/longitude` aus `location_master_coords` (Name+PLZ, ohne PLZ auch nur Name); überspringt nur `manual`/`gemeinde-registry`; fasst `geocoding_confidence` nicht an; feuert auch, wenn die App `lat/lng = NULL` schreibt. |
| Trigger `trg_bundesland_from_plz` BEFORE INSERT OR UPDATE OF postal_code | Setzt `bundesland` aus der ersten PLZ-Ziffer, wenn NULL (nur AT). |
| Funktion `apply_master_coords_bulk(days_from, days_to)` | Massenzuweisung der Master-Koordinaten auf published Events, schreibt `geocoding_confidence='verified'`, `geocoding_source='master_coords'`. Aufrufer: `fix-duplicate-coords.ts`. |
| Funktion `bulk_update_event_geocoding(jsonb)` | Sparse-Update von `location_name, latitude, longitude, geocoding_confidence, geocoding_source, postal_code`. Aufrufer: `normalize-locations.ts`, `fix-geocoding.ts`, `openai-geocode.ts` (via `makeBulkUpdater`). |
| Funktion `normalize_location_name(text)` | lower/trim/whitespace, Schlüssel der Master-Tabelle. |
| Tabelle `location_master_coords` | 7.275 Zeilen: geonames 5.266 (davon 260 review), nominatim 1.148, openai 600, venues 108, known_venues 83, geocode_cache 70. |
| Tabellen `geocode_cache` 3.113, `venue_aliases` 5.770, `venues` 312.983 (alle mit Koordinaten, 141.514 mit PLZ, 129.169 mit Adresse), `raw_events` 0, `scrape_runs` 0, `source_runs` 8.578, `normalized_event_candidates` 0. |

## 4. Geo-Schreibpfade im Anwendungscode

| Pfad | Läuft | Schreibt |
|---|---|---|
| `src/lib/db/supabase-sync.ts` (`syncEventsToSupabase`) | jeder Scrape, Eventim-Import, sync-feratel | `location_name` (= Normalizer-Treffer!), `address` (Guard), `postal_code` (Scraper, Normalizer-Rückrechnung, Text), `bundesland`, `district`, `latitude/longitude`, `geocoding_*`, `slug` (aus Titel + Normalizer-Name) |
| `src/lib/location-normalizer.ts` | Bibliothek in Sync, normalize-locations, fix-geocoding, fix-duplicate-coords | Kandidatenauswahl (Wort-/Teil-/Alt-Namen-Treffer, Titel/Beschreibung), PLZ aus Koordinate |
| `src/scripts/normalize-locations.ts` | nächtlich, alle Events | `location_name`, Koordinaten wenn NULL |
| `src/scripts/fix-geocoding.ts` | nächtlich | Koordinaten + `geocoding_confidence` (geonames) oder NULL |
| `src/scripts/openai-geocode.ts --null` | nächtlich | Koordinaten (openai/gemini_low) |
| `src/scripts/fix-duplicate-coords.ts --pipeline-mode` | nächtlich | `location_master_coords` (+ Bulk-Apply auf events) |
| `src/lib/eventim/parse.ts` (`mapEvent`) | alle 6 h | ersetzt fehlende Venue-Koordinaten durch PLZ-Mittelpunkte ohne Kennzeichnung; verwirft `eventCity`, `eventVenueId` |
| `src/lib/scrapers/FeratelScraper.ts` | stündlich + nächtlich | Regions-Fallback-Koordinaten (Bundesland-/Regionszentrum) als `latitude/longitude`; DE-Regionen als AT |
| `src/lib/quality/admission.ts` (`evaluateAdmission`) | in Sync | Korrekturen `drop_coordinates`, `use_coordinate_region` (PLZ als „dritte Stimme", auch wenn aus Koordinate abgeleitet) |
| Einmalskripte (nicht geplant): `backfill-plz-from-coords.ts`, `backfill-district-from-plz.ts`, `fix-coords-from-registry.ts`, `refresh-gemeinden-coords.ts`, `restore-coords.ts`, `fix-tourism-office-addresses.ts`, `backfill-venue-ids.ts`, `backfill-venue-matching.ts`, `fast-backfill.ts`, `seed-festivals.ts`, `fix-gsc-event-issues.ts` | manuell | diverse Ortsfelder |
| Admin/User: `api/admin/event-submissions/[id]`, `lib/inserate/*` (Inserate-Freigabe mit Geocoding), `events/create`, `lib/lineup/derive-events.ts` (abgeleitete Events erben Ort) | bei Nutzung | Ortsfelder neuer Zeilen |
| Ungenutzt/unfertig: `pipeline/orchestrator.ts`, `pipeline/canonical-upsert.ts`, `pipeline/raw-layer.ts`, `pipeline/venue-matcher.ts` (102 Live-Events mit `venue_id`) | nie aus Prod aufgerufen (TECH-DEBT) | – |

## 5. Ausgabepfade, die Ortsangaben veröffentlichen

`/api/events` (Liste, bbox, Umkreis; `latitude IS NOT NULL` im Hauptpfad,
„unmapped"-Nebenpfad ohne Koordinaten), `/api/events/map-points` (MV
`event_map_points`), Event-Detail (Vollseite + Modal-Route), Karte `/map`,
Gemeinde-/Bezirks-/Bundesland-/Thema-/Studenten-Hubs, Smart-Suche
(`district`-Filter), Widget `/widget/[region]`, JSON-LD
(`src/lib/seo/event-jsonld.ts`, Hubs, Landing), Sitemaps (URL-Präfix
`{plz}-{ort}`), Anreise-Button (`src/lib/utils/location-trust.ts`:
vertraut jedem Adress-String und den Labels `exact|manual|verified|json-ld-venue`),
Benachrichtigungen (`followed_cities`, Reminder-Mails mit Ortstext),
Übersetzungen (`title_en`, `description_en`; Ortsfelder unübersetzt).

## 6. Ausgangsmessung (Referenz für die Abnahme)

Siehe `docs/ORTSDATEN-ANALYSE-2026-09-13.md` §3: 47.257 Live-Events mit
nacktem GeoNames-Ortsnamen, ~5.500 harte Widersprüche, 1.630 Events unter 44
Namen, die ≥ 3 Bundesländer überspannen, Eventim AT 7.131 nackte Ortsnamen /
695× „Theater an der Wien", 46.230 Events auf `geonames`-Master-Koordinaten,
1.982 mit Pin ohne `geocoding_confidence`, 2.033 mit Adress-PLZ ≠ `postal_code`.
Diese Zahlen sind Untersuchungskandidaten; ihre Ursache wird je Quellereignis
geprüft (Phase D).

## 7. Snapshot (Phase A2)

Angelegt 2026-09-13 18:22 UTC, **kontaminierter Ausgangsstand** (nicht pauschal
zurückspielen):

- DB-Schema `snap_20260913` (107 MB): `events_location` (227.721 Zeilen, alle
  Orts-/Status-Spalten aller Events), `location_master_coords` (7.275),
  `geocode_cache` (3.113), `venue_aliases` (5.770), `event_quality_scores`
  (23.833), `meta` (App-Commit, Zählstände, Zeitpunkt).
- Datei `/var/backups/ortsdaten-snapshot-2026-09-13.dump` (pg_dump custom,
  36 MB, SHA-256 `a3e624d3…3a843b`), zusätzlich zum nächtlichen
  `lt-db-backup` (`/var/backups/lasstreffen-<Wochentag>.dump`).

Rückweg für Einzelfälle: `select * from snap_20260913.events_location where id = …`.

## 8. Phase A6: nachweislich falsche Pins aus der präzisen Ausspielung genommen (2026-09-13, 19:05 UTC)

Nur künftige, veröffentlichte Events; jede Änderung ist in
`snap_20260913.a6_revocations` (alte Werte, Gruppe, Distanz) und im
`location_resolution.revoked` der Zeile protokolliert, also reversibel.

| Gruppe | Regel | Zeilen | Ergebnis |
|---|---|---|---|
| g1a | Adress-PLZ (Quelltext) > 25 km vom Pin, PLZ-Spalte leer oder gleich, PLZ eindeutig einer Gemeinde zugeordnet | 193 | Gemeinde-Mittelpunkt der Adress-PLZ als Gebietsangabe (`gemeinde-centroid`, `municipality_only`, kein Pin-Recht) |
| g1b | Adress-PLZ widerspricht Pin UND PLZ-Spalte | 168 | `conflict`, keine Position |
| g2 | PLZ-Spalte > 25 km vom Pin (Herkunft der PLZ unbekannt) | 3.443 | `conflict`, keine Position |
| g2 multi | wie g2, PLZ mit mehreren Gemeinden: > 25 km von allen | 516 | `conflict`, keine Position |
| g3 | `country <> 'AT'`, Pin in Österreich, Koordinate aus Alt-Namenstreffer | 412 | `conflict`, keine Position |

Summe 4.732. Diese Events sind bis zum nächsten Quellabruf nicht auf Karte
und Liste (Detailseiten bleiben erreichbar). Eventim (6-h-Import) und
Feratel (stündlich) liefern ihre Positionen selbst zurück; Gemeinde- und
Listenquellen im Nachtlauf. Bleibt der Widerspruch bestehen, bleibt der
Status `conflict` (Prüfung in Phase D/E).
