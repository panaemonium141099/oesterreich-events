# Eventim/oeticket PFT-Feed Integration — Design

**Datum:** 2026-06-16
**Status:** Design — wartet auf Freigabe

## Goal & Context

Die gescrapte Quelle `oeticket` wird durch den **offiziellen Eventim PFT-Datenfeed** ersetzt.
Wir spiegeln 1×/Tag den kompletten Feed, importieren AT/DE/CH-Events mit eingebettetem
Affiliate-Deeplink, präziser Ticket-Verfügbarkeit und korrekter Kategorie. Auf der Karten-Seite
bekommt der User einen Toggle „nur Österreich" (Default an); aus → DE/CH-Events werden sichtbar
und die graue Mapbox-Maske dehnt sich auf AT+DE+CH aus.

## Feed-Mechanik (verifiziert mit echten Daten)

- `GET https://pft.eventim.com/serve/214-hemfto`, HTTP Basic Auth (`J70` / `pn4ZodhG`).
- Antwort: gzip (~5,7 MB) → entpackt **~57 MB JSON**, Top-Level `{ eventserie: [...] }`.
- Eventim regeneriert **alle 1–6 h** einen Voll-Abzug der Live-DB. Kein Query-API, keine
  Pagination, kein Inkrement — immer der ganze Katalog.
- Dieser Abzug: **5.884 Serien / 22.704 Termine**. Länder: AT 14.274, DE 7.676, CH 253, Rest
  HR/SI/LU/IT/… (ignorieren wir).
- Struktur: Serie (`esId`, `esName`, `esText`, `esPictureBig`, `esCategories[]`, `evoLink`,
  `artists[]`) → `events[]` (Termine).
- **Affiliate-Deeplink ist eingebettet:** `events[].evoLink` enthält bereits `?affiliate=J70`
  → das ist `ticket_url` **und** `source_url`. Der Link-Generator (zweite PDF) wird **nicht**
  gebraucht.
- **Koordinaten sind eingebettet** (`venueLatitude`/`venueLongitude`) → kein Geocoding nötig.

### Entschlüsselte Codes (aus JSON-Partner-PDF)

- `eventStatus`: `0` Unknown, `1` **CANCELED**, `2` **AVAILABLE** (kaufbar), `3` undeliverable,
  `4` sold out, `6` no_amount (aktuell aus), `7` before_onsale, `8` after_offsale,
  `14` only_club, `16` (undokumentiert).
- `priceCategories[].inventory`: `"buchbar"` = im Verkauf, `"nicht buchbar"` = aus/noch nicht.
- `eventType`: `1` = Ticket-Event (22.599×) — **nur diese importieren**; 4 Voucher, 5 Paket,
  6 Produkt, 3 Link.
- `deliverable` (bool): false → kein Verkauf möglich.
- `ticketStock` = Ticketform (0 Soft / 3 FanTicket), **nicht** Lagerstand.

## Entscheidungen (mit User abgestimmt)

1. **Import-Umfang:** alle **zukünftigen** Termine (`eventDateIso8601 >= heute`) mit
   `eventType == 1`, **außer abgesagt** (`eventStatus != 1`). Ausverkaufte (4/6) bleiben sichtbar,
   aber ohne Kaufen-Button.
2. **Toggle-Reichweite:** „nur Österreich" wirkt **nur auf der Karten-Seite** (`/map`). Landing,
   Weekly Highlights, Region/Kategorie-Grids, Stats bleiben **immer AT-only**.
3. **DE/CH-Filter:** reiner `country`-Filter über **alle Quellen** — Toggle aus →
   `country IN ('AT','DE','CH')`.
4. **Buy-Button:** nur für Events mit `source_name = 'Eventim'` **und** buchbar.
5. **Kategorien:** **keine neuen Kategorien** — Eventim-Codes werden auf die bestehenden
   **12 Hauptkategorien** gemappt (feinere Codes als Tags).
6. **Musik-Genres:** Eventim liefert nur **grobe** Genres (10 Kategorie-Codes, eine Serie kann
   2–3 tragen). Feine Genres (techno/dnb/house/psytrance …) sind **nicht** im Feed, kommen aber
   über das bestehende `TAGS`-Vokabular + Claude-Enrichment; grobe Genre-Tags setzt schon das
   Kategorie-Mapping. Spotify-Artist-Genre-Veredelung **ist Teil des Scopes** (Slice 7) —
   User will echte techno/dnb-Genauigkeit.
7. **Venues:** Der Feed liefert **1.414 AT-Venues** (+ DE/CH) mit Koordinaten. Diese gehen in die
   `venues`-Tabelle + `location_master_coords`, damit Events **aller** Quellen an diesen Locations
   korrekte Koordinaten + `venue_id` erben → plattformweiter Venue-Filter.

## Datenmodell

### Neue Spalte `events.country`

```sql
ALTER TABLE events ADD COLUMN country TEXT NOT NULL DEFAULT 'AT';
CREATE INDEX idx_events_country ON events (country);
```

- Backfill bestehender Zeilen: `'AT'` (alle bestehenden Quellen sind AT-fokussiert; die wenigen
  Nicht-AT-Zeilen werden über Koordinaten-Bbox korrigiert — siehe Importer-Slice / Backfill-Skript).
- Eventim-Importer setzt `country` aus `events[].eventCountry` (AT/DE/CH).

### Eventim-Event → `ScrapedEvent`

| ScrapedEvent | Eventim-Quelle |
|---|---|
| `source_name` | `'Eventim'` (konstant) |
| `source_id` | `events[].eventId` |
| `source_url` | `events[].evoLink` |
| `ticket_url` | `events[].evoLink` **nur wenn buchbar**, sonst `null` |
| `title` | `events[].eventName` (Fallback `esName`) |
| `description` | `esText` (HTML → Plaintext) |
| `start_date` | `events[].eventDateIso8601` |
| `location_name` | `events[].eventVenue` |
| `address` | `events[].eventStreet` |
| `postal_code` | `events[].eventZip` |
| `latitude`/`longitude` | `events[].venueLatitude`/`venueLongitude` |
| `bundesland` | abgeleitet aus Koordinaten (nur AT) / sonst `null` |
| `country` | `events[].eventCountry` |
| `price_min`/`price_max` | `events[].minPrice`/`maxPrice` |
| `price_text` | z. B. „ab 41,00 €" |
| `image_url` | `esPictureBig` |
| `category` | aus `EVENTIM_CATEGORY_MAP[esCategories[0].category]` (**locked**) |
| `tags` | feinere Eventim-Bezeichnung als Tag (z. B. `kabarett`, `klassik`) |
| `organizer` | — (Eventim liefert nur `promoterId`) |
| `source_type` | `'scraped'` |

**„buchbar"-Definition:** `eventStatus == '2'` **und** `deliverable == true` **und** mindestens
eine `priceCategories[].inventory == 'buchbar'`. Nur dann wird `ticket_url` gesetzt → nur dann
erscheint der Kaufen-Button.

**Kategorie autoritativ:** Eventim liefert einen expliziten Code → die gemappte Kategorie darf
**nicht** vom Text-Klassifizierer (`resolveCanonicalCategory`) überschrieben werden. Importer setzt
`category_locked = true` + `category_source = 'feed'`; Write-Pfad muss den Lock respektieren
(in Slice 1 verifizieren/erweitern).

### Eventim-Kategorie-Mapping (47 Codes → 12 Hauptkategorien)

| Code | Eventim | → Hauptkategorie | Tag |
|---|---|---|---|
| 1A | Rock & Pop | Musik | rock-pop |
| 1B | Volksmusik & Schlager | Musik | schlager |
| 1C | Festival | Musik | festival |
| 1D | Electronic & Dance | Nightlife & Party | electronic |
| 1E | Jazz & Blues | Musik | jazz |
| 1F | Party & Feste | Nightlife & Party | — |
| 1G | Hard 'n' Heavy | Musik | metal |
| 1H | Rap, Hip Hop | Musik | hip-hop |
| 1I | Gospel | Musik | gospel |
| 1K | Mehr Konzerte | Musik | — |
| 2A | Klassische Konzerte | Musik | klassik |
| 2B | Oper & Operette | Kultur & Bühne | oper |
| 2C | Ballett & Tanz | Kultur & Bühne | tanz |
| 2D | Theater | Kultur & Bühne | theater |
| 2E | Kindertheater | Familie & Kinder | theater |
| 2F | Sommertheater | Kultur & Bühne | theater |
| 2G | Museen & Ausstellungen | Kultur & Bühne | ausstellung |
| 2H | Literatur | Kultur & Bühne | lesung |
| 2I | Film | Kultur & Bühne | kino |
| 3A–3O | Fußball/Motorsport/…/Mehr Sport | Sport & Bewegung | (jeweilige Sportart) |
| 4A | Musical | Kultur & Bühne | musical |
| 4B | Show | Kultur & Bühne | show |
| 4C | Zirkus | Familie & Kinder | zirkus |
| 5A | Kabarett | Kultur & Bühne | kabarett |
| 5B | Comedy | Kultur & Bühne | comedy |
| 6A | Weekender | Community & Freizeit | — |
| 6B | Wellness | Wellness & Spiritualität | — |
| 6C | Kulinarik | Essen & Trinken | — |
| 6D | Shopping | Märkte & Feste | shopping |
| 6E | Abenteuer | Natur & Abenteuer | — |
| 7A | Tourismus | Community & Freizeit | — |
| 7B | Anreise / Eventreisen | Sonstiges | — |
| 7C | Vorträge | Wissen & Karriere | vortrag |
| 7D | Sonstiges | Sonstiges | — |
| 7E | Messen | Wissen & Karriere | messe |
| Ball | Ball | Kultur & Bühne | ball |
| Podcast | Podcast (live) | Kultur & Bühne | podcast |
| RLB / 4F / unbekannt | — | Sonstiges | — |
| 8A–8J, Regional-Packages | ticketPLUS / Pakete | (entfällt: `eventType != 1`) | — |

**Offene Mapping-Urteile (im Spec-Review bestätigen):** 4C Zirkus → Familie (statt Kultur);
6A Weekender / 7A Tourismus → Community & Freizeit; 6D Shopping → Märkte & Feste.
Unbekannte Codes (4F, RLB, evtl. neue) → `Sonstiges` + Log-Warnung.

### Musik-Genres (Detail-Filter)

Verifiziert am Feed: Eventim hat **keine** feinen Genres. Code `1D Electronic & Dance` umfasst
Electro-Swing (Parov Stelar), Hands-Up (Gigi D'Agostino), IDM (Autechre), EDM, House — undifferenziert.
Genre-Wörter stehen nur im Titel/Suchtext und spärlich (techno 4×, drum 4×, trance 2×).

Dreistufiger Genre-Ansatz:
1. **Grob (sofort, aus Mapping):** Musik-Code → Genre-Tag (`rock-pop`, `electronic`, `jazz`,
   `metal`, `hip-hop`, `klassik`, `schlager`, `gospel`). Multi-Code → mehrere Tags.
2. **Fein (über bestehende Enrichment):** `src/lib/category-classifier/enrichment-taxonomy.ts:48`
   (`TAGS`) hat bereits rave-genaue Sub-Genres (`techno`, `dnb`, `minimal-techno`, `psytrance`,
   `deep-house`, `neurofunk`, …). Eventim-Events laufen durch `enrich:claude` → Tags werden gefüllt;
   Tag-Filter existiert bereits. Genauigkeit aus Titel/Beschreibung ist aber begrenzt.
3. **Optional/präzise (Slice 7):** Spotify-Artist-Genre. Feed liefert `artists[].artistName`;
   Spotify-`genres[]` ([spotify.ts:70](src/lib/spotify.ts:70)) → Mapping Spotify-Genre-String → `TAGS`.
   Zuverlässigster Weg für „rave-level precision", aber eigenes Mapping + API-Calls nötig.

### Venue-Registry aus dem Feed

Feed: **1.414 distinct AT-Venues**, 87 % mit Koordinaten (`eventVenueId`, `eventVenue`, `eventCity`,
`venueLatitude/Longitude`). Bestehende Infra (read-only verifiziert):
- `venues`-Tabelle ([database.ts:102](src/types/database.ts:102)) — `name`, `name_normalized`,
  `city`, `postal_code`, `latitude/longitude`, `registry_source` (neuer Wert `'eventim'`).
  **Keine** `external_id`-Spalte → Dedup über `(name_normalized, city)` oder neue Spalte
  `eventim_venue_id`.
- 3-Stufen-Matcher ([venue-matcher.ts:81](src/lib/pipeline/venue-matcher.ts:81)): exakt (Name+City/PLZ)
  → fuzzy (Jaro-Winkler ≥0.85 + PLZ) → Geo-Proximity. Schreibt `venue_id` +
  `venue_match_confidence` + `venue_match_stage`.
- `location_master_coords` + Trigger `trg_apply_master_coords` — überschreibt Event-Koordinaten
  automatisch per `(location_name, postal_code)` bei INSERT/UPDATE.
- API-Filter `?venue_id=` existiert bereits ([events/route.ts:216](src/app/api/events/route.ts:216)).

**Effekt:** Wird die Venue-Liste einmal eingespielt + `location_master_coords` befüllt, erben
**alle** künftigen Events (jede Quelle) an diesen Locations korrekte Koordinaten + `venue_id` —
ohne Matcher-Änderung. **Quality-Filter:** Pseudo-Venues (z. B. „GrazTourismus", Gutschein/0-Koord)
beim Ingest aussortieren.

## Architektur — 5 Slices

### Slice 1 — Eventim-Importer
- `src/lib/eventim/feed-client.ts` — Download + gunzip (Streaming wg. 57 MB).
- `src/lib/eventim/parse.ts` — `eventserie[]` → `ScrapedEvent[]` (Filter: eventType=1, future,
  eventStatus≠1; HTML-Strip; buchbar-Logik).
- `src/lib/eventim/category-map.ts` — `EVENTIM_CATEGORY_MAP` (Tabelle oben).
- `src/scripts/import-eventim.ts` — Orchestrierung: laden → parsen → batched `syncEventsToSupabase`.
  Flags: `--dry-run`, `--limit`, `--verbose`.
- Schreibt über bestehenden Write-Pfad (`syncEventsToSupabase`) → Dedup/Score/Validation gratis.
  Erweiterung: gemappte Kategorie + `country` müssen durchgereicht & gelockt werden.

### Slice 2 — OeticketScraper entfernen
- Löschen: `src/lib/scrapers/OeticketScraper.ts`.
- Registry: `src/lib/scrapers/index.ts` Zeile 7 (import) + 182 (Instanz).
- `package.json`: Script `scrape:oeticket`.
- `src/lib/utils/scoring.ts` + `src/lib/quality/score-event.ts`: `oeticket.com/.at`, `eventim.de/.at`
  aus `TRUSTED_TICKET_HOSTS` (Eventim kommt jetzt über `source_name`, nicht über Host-Whitelist).
- Tests anpassen (score-event, V4TicketBox, event-detail-trust-copy, fetch-page-extract).
- `ntry.at` bleibt unangetastet (separate Quelle).

### Slice 3 — Buy-Button auf Eventim einschränken
- `src/lib/v4/derive-event-state.ts:54` — Bedingung erweitern: State `'ticket'` nur wenn
  `event.source_name === 'Eventim'` (zusätzlich zu `ticket_url` + `price_tier`).
- Effekt: andere Quellen mit `ticket_url` (ntry, Feratel) zeigen keinen Kaufen-Button mehr.
  Eventim ohne `ticket_url` (= nicht buchbar) ebenfalls nicht.
- Provider-Label „Zu Eventim" kommt automatisch aus `source_name`.

### Slice 4 — Toggle „nur Österreich" + Map-Maske
- **API:** `/api/events/route.ts` — Bbox-Filter (Zeile 318) ersetzen durch `country`-Filter.
  Param `countries` (Default `AT`); `/map` sendet bei Toggle-aus `AT,DE,CH`.
- **Featured/Stats:** explizites `country = 'AT'` ergänzen, damit DE/CH **nicht** auf Landing
  durchsickern.
- **Filter-State:** `EventFilters` um `atOnly: boolean` (Default true) erweitern; in
  `use-filtered-events.ts` `buildParams()` serialisieren.
- **Toggle-UI:** Switch „nur Österreich" auf `/map` (Default an).
- **Maske:** `public/germany.geojson` + `public/switzerland.geojson` (Low-Res Länder-Outlines,
  Natural Earth) ergänzen; Pseudo-Region `at-de-ch` in `src/lib/bundeslaender.ts`
  (center ≈ `[11.0, 48.0]`, zoom ≈ 5.3, MultiPolygon-Löcher AT+DE+CH). Bei Toggle-aus &
  `bundesland='all'` wird diese Region an `EventMap` übergeben → Maske + View dehnen sich aus.
  Die „Welt-mit-Löchern"-Mechanik (`EventMap.tsx:131`) unterstützt MultiPolygon bereits.
- **Venue-Filter-UI:** API kann `?venue_id=` schon → Filter-UI ergänzen (Venue-Suche/Autocomplete
  in FilterBar). Optional auch Genre-Tag-Filter prominenter machen (Tags existieren bereits).

### Slice 5 — Tägliche Automatisierung (Vercel-Cron)
- `src/app/api/cron/eventim/route.ts` — geschützt per `CRON_SECRET`, ruft Import-Logik.
- `vercel.json` Cron-Eintrag, 1×/Tag (z. B. `0 4 * * *`).
- **Risiko:** 57 MB Download + 22 k Upserts in einer Serverless-Function (Memory/Timeout).
  Fluid Compute / 300 s-Timeout hilft; Plan B: Import in Batches mit Streaming-JSON-Parser, oder
  Trigger per Cron + Verarbeitung in Chunks. In Slice 1/5 messen.
- ENV: `EVENTIM_FEED_URL`, `EVENTIM_FEED_USER`, `EVENTIM_FEED_PASS`, `CRON_SECRET`.

### Slice 6 — Venue-Registry aus dem Feed
- `src/scripts/import-eventim-venues.ts` (oder als Teil des Importers, gleicher Feed-Parse):
  Venues aus `eventserie[].events[]` extrahieren → dedupen über `(name_normalized, city)` →
  Quality-Filter (Pseudo-Venues/0-Koord raus) → Upsert in `venues` (`registry_source='eventim'`,
  Koordinaten, `name_normalized`).
- `location_master_coords` mit denselben (Name, PLZ, Koord) befüllen → Trigger korrigiert
  Event-Koordinaten **aller** Quellen automatisch.
- Optional Migration: Spalte `venues.eventim_venue_id` für sauberes Re-Sync/Dedup.
- Kein Matcher-Umbau — bestehende 3-Stufen-Logik greift danach automatisch.

### Slice 7 — Spotify-Genre-Veredelung (in Scope)
- Für Musik-Events: `artists[].artistName` → Spotify-Lookup (`searchArtist` → `genres[]`) →
  Mapping Spotify-Genre-String → `TAGS` (techno/dnb/house/…) → in `tags` mergen.
- Caching der Spotify-Genres pro Artist (Tabelle/Map), um API-Limits zu schonen.
- Spotify-Genre-Strings sind frei (z. B. „austrian techno", „neo classical") → eigene
  Normalisierungs-/Mapping-Tabelle auf das `TAGS`-Vokabular nötig (Fallback: kein Tag).

## Edge Cases & Constraints

- **Feed-Schema wächst** („additional data may be added at any time") → Parser tolerant
  (unbekannte Felder ignorieren, fehlende Felder defensiv).
- **Unbekannte Kategorie-Codes** (4F, RLB, künftige) → `Sonstiges` + Warn-Log (kein Crash).
- **Stale-Events:** Termine, die im neuen Abzug fehlen → über bestehende `last_seen_at`-Logik
  soft-expiren. Prüfen, ob ein Expiry-Sweep existiert; falls nein, Eventim-Events nach
  N Tagen ohne `last_seen_at` auf `publish_status='expired'` setzen.
- **Cross-Source-Duplikate:** `(source_name, source_id)` dedupt nur innerhalb Eventim;
  inhaltliche Dups zu anderen Quellen über bestehenden `content_fingerprint`.
- **`category_locked` muss vom Write-Pfad respektiert werden** — sonst überschreibt der
  Text-Klassifizierer die gemappte Kategorie (in Slice 1 verifizieren).
- **Backfill `country`** für Bestandsdaten vor Aktivierung des country-Filters.

## Acceptance Criteria

- [ ] Eventim-Feed wird 1×/Tag importiert; zukünftige, nicht-abgesagte Ticket-Events (AT/DE/CH)
      landen mit `country`, Affiliate-`ticket_url` und gemappter Kategorie in der DB.
- [ ] `OeticketScraper` vollständig entfernt; `npm run build` + `npm test` grün.
- [ ] Kaufen-Button erscheint **nur** für buchbare Eventim-Events, **nie** für andere Quellen.
- [ ] `/map`-Toggle „nur Österreich" (Default an) filtert Events **und** dehnt die graue Maske
      auf AT+DE+CH aus, wenn deaktiviert.
- [ ] Landing / Featured / Stats bleiben AT-only (kein DE/CH-Durchsickern).
- [ ] Cron läuft täglich; Lauf protokolliert Anzahl importiert/aktualisiert/gefiltert.
- [ ] Eventim-Venues (~1.414 AT) sind in `venues` + `location_master_coords`; Events aller Quellen
      an diesen Locations erben Koordinaten + `venue_id`; `?venue_id=`-Filter liefert sie.
- [ ] Musik-Events tragen grobe Genre-Tags aus dem Mapping; feine Genre-Tags (techno/dnb …) sind
      über den bestehenden Tag-Filter filterbar.

## Boundaries (out of scope)

- `ntry.at` bleibt aktive Quelle.
- Kein Deeplink-Generator (Links sind eingebettet).
- Keine neuen Kategorien über die bestehenden 12 hinaus.
- Vergangene Events werden nie importiert.
- Nicht-AT/DE/CH-Länder aus dem Feed (HR/SI/…) werden verworfen.

## Decision Context

- **Feed statt Scraper:** offizielle Quelle → 100 % Ticket-Wahrheit (Verfügbarkeit abfragbar),
  Affiliate-Provision korrekt getrackt, kein brüchiges HTML-Scraping.
- **`country`-Spalte statt Bbox:** Bbox überlappt an Grenzen; Feed liefert exaktes Land → saubere,
  schnelle Filterung + Index.
- **Write-Pfad wiederverwenden:** Dedup/Scoring/Validierung/Bundesland sind bereits zentralisiert;
  ein eigener Upsert würde Logik duplizieren.
