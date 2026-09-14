# Ortsdatenqualität: Quelltreue, Resolver-Vertrag, Ausspielungs-Gating, Bestandssanierung

Grundlage: Review-Plan des Users vom 2026-09-13
(`~/Downloads/lasstreffen-ortsdaten-plan-review-2026-09-13.md`, hier als
normativ übernommen) und die Ursachenanalyse
`docs/ORTSDATEN-ANALYSE-2026-09-13.md`. Prod-Stand bei Beginn: Commit
`2818fbd` auf Hetzner, 82.405 künftige published Events.

## Goal & Context

Veranstaltungsorte werden heute im Schreibpfad durch GeoNames-Worttreffer
ersetzt, PLZ/Bundesland/Bezirk aus der falschen Koordinate abgeleitet, jede
Nacht erneut normalisiert und per Master-Koordinaten-Trigger zementiert.
Ziel: Eine Angabe wird nur in der Genauigkeit veröffentlicht, die ihre Belege
tragen. **Eine bestätigte Gemeinde ist kein bestätigter Veranstaltungsort.**

Leitsätze (verbindlich, aus Review §11):
1. Quellangaben werden vor jeder Normalisierung vollständig und unveränderlich
   gespeichert; jede öffentliche Ortsangabe ist auf Beleg und
   Auflösungsversion zurückführbar.
2. Venue-Namen sind Veranstaltungsstätten; Zuordnung nur über belegte
   Quellen-IDs, Adressen oder im Ortskontext bestätigte Aliase.
3. GeoNames nur für ausdrücklich genannte Siedlungs-/Ortsnamen; Mehrdeutigkeit
   oder Widerspruch erzeugt keine automatische Zuordnung.
4. Quelle, Identitätssicherheit, räumliche Genauigkeit und Aktualität werden
   getrennt bewertet; Gemeinde- und PLZ-Zentren sind Gebietsangaben.
5. Veröffentlichung nach bestätigtem Wissensstand: Pin und Anreise brauchen
   eine belegte Position; eine bestätigte Gemeinde reicht für Gemeinde-Listen.
6. Fehlendes/Widersprüchliches wird nicht durch Scores, Mehrheiten, Nähe,
   Einwohnerzahl oder KI-Selbsteinschätzung aufgewertet.
7. Ein gemeinsamer Ortsvertrag für alle Schreib- und Ausgabepfade; Jobs und
   Trigger machen eine Verwerfung nicht rückgängig.
8. Bestandssanierung explizit, versioniert, anhand neuer Quellbelege; nicht
   erneut abrufbare Events bleiben sichtbar ungeklärt.

## Architecture & Data Models

Additiv, keine destruktiven Schritte (MASTERPLAN-Regel). Vorhandene Tabellen
werden erweitert, kein Kandidatenbestand wird durch Umbenennung zum Register.

**Rohschicht (unveränderlich):** `scrape_runs` + `raw_events` existieren
(FK `events.raw_event_id` existiert, 0 Zeilen). Der echte Importpfad
(`syncEventsToSupabase`, genutzt von Scrapern, Eventim-Import und
sync-feratel) schreibt pro Lauf eine `scrape_runs`-Zeile und pro Event eine
`raw_events`-Zeile mit vollständigem `raw_payload_json` (ScrapedEvent vor
jeder Normalisierung), `content_hash` über alle Orts- und Kernfelder,
`parser_version` (neue Spalte) und setzt `events.raw_event_id`. Unveränderte
Events (gleicher Hash) erzeugen keine neue Zeile.

**Geparste Quellangaben auf `events` (neue Spalten):**
`location_name_raw`, `address_raw`, `postal_code_raw`, `city_raw`,
`source_venue_id` (Namensraum `quelle:id`, z. B. `eventim:12345`),
`latitude_raw`, `longitude_raw` (originale Venue-Koordinaten, nie ein
PLZ-Zentrum), `country_raw`.

**Ortsentscheidung auf `events`:**
- `location_status` ∈ `venue_confirmed | address_confirmed | municipality_only
  | region_only | unresolved | conflict | online`
- `location_precision` ∈ `entrance | building | site | street | locality |
  municipality | postcode | region | unknown`
- `location_resolution jsonb`: `{ version, resolved_at, input_hash,
  registry_version, status, precision, reasons[], evidence[], rejected[],
  candidates[], allowed: { pin, route, distance, municipality_page } }`
- `location_provenance jsonb`: je Feld `source | text | registry |
  derived:<from> | manual`.
Anzeige (`location_name`) = Rohwert, nur sichere Textaufbereitung. Alle
Ortsfelder einer Entscheidung werden gemeinsam und atomar geschrieben.

**Korrekturen:** Tabelle `event_location_corrections` (scope: event | source_venue |
venue_id; vorher/nachher; Beleg; Quelle der Korrektur; gültig ab/bis;
Version). Manuelle Entscheidungen getrennt von automatischen Labels.

**Master-Koordinaten:** `location_master_coords` bekommt `status`
(`active|revoked`), `revoked_reason`, `revoked_at`. Der Trigger
`trg_apply_master_coords` und die RPC `apply_master_coords_bulk` werden
stillgelegt; Master sind danach nur noch eine Evidenzquelle des Resolvers
(nur `venues|known_venues|manual` mit `status='active'`).

**Resolver (`src/lib/location/`):** reine Entscheidungsfunktion + injizierte
Evidenzlader. Reihenfolge (Review §4): Event identifizieren → Ortsangaben aus
dem richtigen Kontext → `source_venue_id` auf geprüfte Zuordnung → explizite
Adresse/Originalkoordinaten prüfen → Venue-Kandidaten im belastbaren Kontext
(Name/Alias + bestätigte Gemeinde/Adresse) → fehlenden Kontext gezielt
ergänzen (Detailseite, räumlich eingeschränkte Suche) → unscharfe Suche nur
für Kandidaten → sonst abstufen (`municipality_only`) oder zurückhalten.
Kein Worttreffer, kein Base-Name-Index, keine Alternativnamen ohne Filter,
keine Koordinate aus Titel/Beschreibung, keine PLZ aus Koordinaten als
unabhängige Stimme, kein Bypass für Einzelkandidaten. Widerspruch zwischen
belastbaren Angaben → `conflict`.

**Referenzen:** GeoNames-Dataset neu (ADMIN1 01 Burgenland, 02 Kärnten,
03 Niederösterreich, 04 Oberösterreich, 05 Salzburg, 06 Steiermark, 07 Tirol,
08 Vorarlberg, 09 Wien; Original-Code, geonameid, Datenstand erhalten;
Alt-Namen nur Schreib-/Transliterationsvarianten). PLZ→Gemeinde/Bezirk als
Mengen; Mehrdeutigkeit bleibt Mehrdeutigkeit (kein Häufigkeits- oder
Alphabetentscheid).

**Ausspielung (Review §6):** `publish_status` bleibt. Zusätzlich entscheidet
`location_status`/`location_precision` je Ausgabepfad (Detailseite, Karte,
Umkreis, Gemeinde-/Bezirks-/Stadtseiten, Suche, `/api/events`,
`event_map_points`, Widgets, JSON-LD, Metadaten, Übersetzungen,
standortbezogene Benachrichtigungen):
- `venue_confirmed`/`address_confirmed` mit Koordinate → präziser Pin, Anreise
  nur zu belegtem Zielpunkt.
- Venue bestätigt ohne Koordinate → Anzeige, kein Ersatzpin, keine Distanz.
- `municipality_only` → Gemeindeseite ja; Karte nur als
  Gemeinde-Sammelmarker („N Events, genauer Ort unbestätigt"), kein
  Event-Pin, keine Distanz/Anreise aus dem Gemeindezentrum.
- `region_only` → intern; `unresolved|conflict` → `needs_review`.
- `online` → passende Art, kein physischer Ersatzort.

## API Contracts

- `resolveEventLocation(input: LocationInput, evidence: EvidenceLoaders,
  opts: { version, registryVersion }): LocationDecision` (rein, getestet).
- `syncEventsToSupabase(events, { runMeta })` schreibt Rohschicht +
  Entscheidung atomar; verworfene Werte werden explizit auf NULL gesetzt
  (kein ausgelassenes Feld).
- `event_map_points` liefert nur `allowed.pin = true`; neue MV/Query
  `event_map_municipality_counts` für Sammelmarker.
- `/api/events`: Listen enthalten `municipality_only`; Umkreis/Distanz nur
  präzise; Antwort trägt `location_status`, `location_precision`.
- `isLocationTrusted()` → liest `location_status`/`allowed.route`, nicht mehr
  Adress-String oder `exact`/`verified`.
- JSON-LD: `Place.geo` nur bei präziser Position; `address` nur bestätigt.

## Edge Cases & Constraints

- Nominatim public: ≤ 1 req/s, für Batch ≤ 4/min; Ergebnisse cachen (Schlüssel
  = vollständiger Kontext + Version); negative Ergebnisse befristen.
- Reverse-Geocoding ist Umgebungshinweis, kein Venue-Beleg.
- Outdoor/Treffpunkte: belegter Punkt/Startort ohne Hausnummer zulässig.
- Zwei gleichnamige Venues in einer PLZ bleiben zwei Kandidaten.
- Tourneetitel identifizieren keinen Ort; Termine behalten eigene Spielstätte.
- Gleichzeitige Scrapes/Admin-Korrekturen dürfen den Backfill nicht überrollen
  (Eingabehash + Version prüfen).
- PostgREST: `.in()` ≤ 200, Batches ≤ 500, 1000-Row-Cap → Paging.
- Slug ist unveränderlich; PLZ-Änderung ändert URL-Präfix → Weiterleitung
  über dieselbe Identität prüfen.

## Acceptance Criteria

Stand 2026-09-14 (Phasen A–D, O1 live; E/F folgen nach dem Voll-Abruf):

- [x] Regressionsfälle Review §9 als Tests: Haus der Frau, Martin-Luther-
      Kirche, Theater in der Innenstadt, Franz-Haas-Platz (conservative-
      resolution), Eventim eventCity/eventVenueId + keine PLZ-Ersatzposition
      (eventim/parse), gleichnamige Venues in einer PLZ + Mehrdeutigkeit
      (selectVenueCandidate), 300-m-Fall (shouldOverwriteCoords),
      gemeinde-registry-Rang (CONFIDENCE_RANK, kein Pin-Recht), PLZ nie aus
      Koordinate, Einzelkandidat im falschen Bundesland, Mehr-Bezirk-PLZ
      (plz-district), Anreise ohne Beleg (location-trust), Geocoder-Ausfall
      (Cache-only im Schreibpfad), Gate verwirft + Titel-/Score-Update
      (verify-location-contract), Wiederholbarkeit (location-metrics),
      Tournee/verschiedene PLZ-Gebiete (dedup-scorer).
- [x] Verlegung nach manueller Korrektur: Korrekturen (`event_location_
      corrections`, Scope event) sind Beleg im Resolver, gebunden an den
      Ortsangaben-Hash des Quellenstands; anderer Quellenstand → Korrektur
      veraltet, neue Entscheidung, `manual`-Label fällt (Resolver-Tests +
      Vertragsprüfung Fall C). Schreibpfad: `/admin/ortsdaten` → Korrigieren
      (`POST/DELETE /api/admin/ortsdaten/correction`).
- [x] Gleichzeitiger Scrape während Backfill: `updated_at`-Vergleich,
      Test `location-re-resolve.test.ts` (concurrent_update, dry-run,
      unverändert). Gelände ohne Hausnummer: Positivfall getestet.
- [ ] Noch ohne automatisierten Test: geteilte Ticket-Domain (alter
      Venue-Matcher nicht in Prod), Footer-Adresse (adapterspezifisch).
- [x] Integrationstest am gespeicherten Datensatz (`verify-location-
      contract.ts`): 23 Prüfungen, inkl. Trigger, Titel-/Score-Update,
      manuelle Korrektur und Verlegung.
- [ ] Jeder öffentlich präzise Ort hat Entscheidung + erhaltenen Quellenstand
      (nach E1 zu messen: Altbestand ohne Entscheidung → 0).
- [x] Unbekannt/verworfen bleibt unbekannt: Gate + Trigger-Entfernung +
      Gating-Modul (Pin/Route/Distanz/JSON-LD), Schalter für F.
- [x] Wiederholbarkeit: Stichprobe 300/300 identisch (location-metrics),
      Eingabehash mit gerundeten Koordinaten.
- [x] Kennzahlen (§10) im Pipeline-Report (`location-audit`), Alarmgrenzen,
      Prüfansicht `/admin/ortsdaten`. Präzisions-Stichprobe gegen Belege
      bleibt manuell.

## Boundaries

- Kein KI-Enrichment; KI-Koordinaten schreiben keine veröffentlichte Position.
- OSM-Bestände (`osm_pois`) bleiben getrennt (ODbL); `venues` ist Kandidaten-,
  kein Verifikationsregister.
- Keine Löschung von Bestandsdaten; Snapshot vorab.

## Decision Context

Re-Scrape allein ist keine Sanierung: Quellen fehlen, alte Werte bleiben durch
Rang-Regeln, Jobs erzeugen Fehler neu. Deshalb Reihenfolge A (Ausbreitung
stoppen) → B (Rohdaten, Importfehler) → C (Referenzen, Resolver, Gating) → D
(Vergleich ohne Veröffentlichung) → E (Bestand in Batches) → F (gestuft
ausspielen, Folgewirkungen). Merges gehen nach Konvention sofort auf master
(User testet nur auf Prod); Schema- und Bestandsschritte laufen zuerst
additiv, Ausspielungsänderungen erst in F.
