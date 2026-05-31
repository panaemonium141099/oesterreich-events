# Quality System Phase 3: Dedup Engine

## Goal & Context

Phase 1 baute die Pipeline (Raw -> Normalize -> Venue Match -> Upsert -> Score) mit Quality Scoring.
Phase 2 fuehrte den Venue Layer ein (3-Stage Matching, Alias System, Geo-Adjustierung).

**Phase 3 eliminiert Duplikate** — das sichtbarste Qualitaetsproblem fuer Nutzer.

### Ist-Zustand (gemessen)

| Metrik | Wert |
|--------|------|
| Total Events | 111.103 |
| Unique Fingerprints (title+day hash) | 52.960 |
| Events ohne Fingerprint | 49.658 |
| Cluster mit 2+ Events (exakt) | 6.244 (14.729 Events) |
| Cross-Source-Cluster | 4.865 |
| Worst offender | "Oeffnungszeiten" 115x, "Kontakt" 81x |

**Zwei Probleme:**
1. **Echte Duplikate**: Dasselbe Event aus verschiedenen Quellen (z.B. "Lange Nacht der Forschung" aus 9 Quellen)
2. **False Positives im Fingerprint**: "Maibaumaufstellen" in 18 Gemeinden = 18 verschiedene Events mit gleichem Fingerprint, weil sie am selben Tag stattfinden aber an unterschiedlichen Orten
3. **Garbage Events**: "Oeffnungszeiten", "Kontakt" — keine echten Events, sollten suppressed werden

**Referenz:** Bericht 1 — Abschnitt 7 (Dedup-Engine), 7.1-7.5

---

## 1. Architektur-Entscheidung: Cluster vs. Hide-Dupes

### Option A: Volle Cluster-Architektur (Bericht 1, Abschnitt 7.4)
- `event_clusters` + `event_cluster_members` Tabellen
- Canonical Event = zusammengefuehrtes Event aus mehreren Quellen
- Feldpriorisierung pro Cluster (beste Beschreibung, bester Ticket-Link, etc.)
- **Vorteil:** sauberstes Datenmodell, maximale Qualitaet
- **Nachteil:** massiver Umbau der gesamten App (jedes Query, jede API, jede UI-Komponente muss canonical_event_id verstehen)

### Option B: Lightweight Dedup (empfohlen fuer Phase 3)
- Kein neues Canonical-Event-Konzept
- Stattdessen: **Dedup-Gruppen** mit einem Primary Event + Hidden Duplicates
- Duplikate bekommen `publish_status = 'duplicate'` und eine `duplicate_of` Referenz
- Das Primary Event wird mit den besten Feldern aus allen Gruppenmitgliedern angereichert
- **Vorteil:** minimal-invasiv, keine API-Aenderungen, sofort sichtbare Verbesserung
- **Nachteil:** weniger elegant als volle Cluster-Architektur

**Empfehlung: Option B** — liefert 90% des Nutzwerts mit 20% des Aufwands. Option A kann spaeter als Phase 5-Optimierung nachgezogen werden.

---

## 2. Datenmodell

### 2.1 Erweiterungen an `events`

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES events(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS dedup_score float;
ALTER TABLE events ADD COLUMN IF NOT EXISTS dedup_cluster_id uuid;
-- publish_status bekommt neuen Wert 'duplicate'

CREATE INDEX idx_events_duplicate_of ON events (duplicate_of) WHERE duplicate_of IS NOT NULL;
CREATE INDEX idx_events_dedup_cluster ON events (dedup_cluster_id) WHERE dedup_cluster_id IS NOT NULL;
```

**Felder:**
- `duplicate_of`: Zeigt auf das Primary Event in der Dedup-Gruppe. NULL = kein Duplikat (oder selbst Primary).
- `dedup_score`: Similarity-Score zum Primary Event (0.0–1.0). NULL = nicht evaluiert.
- `dedup_cluster_id`: Gemeinsame Cluster-ID fuer alle Events einer Dedup-Gruppe (inkl. Primary). Erlaubt schnelles "zeige alle Quellen fuer dieses Event".

### 2.2 `event_dedup_log` (NEU)

```sql
CREATE TABLE event_dedup_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_a_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_b_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title_score      float NOT NULL,
  datetime_score   float NOT NULL,
  venue_score      float NOT NULL,
  geo_score        float NOT NULL,
  url_score        float NOT NULL,
  overall_score    float NOT NULL,
  decision         text NOT NULL CHECK (decision IN ('merge', 'uncertain', 'distinct', 'manual_merge', 'manual_split')),
  decided_at       timestamptz NOT NULL DEFAULT now(),
  decided_by       text DEFAULT 'auto',  -- 'auto' oder admin user_id

  -- Kein Self-Pair, kein Reverse-Duplicate
  CHECK (event_a_id <> event_b_id),
  UNIQUE (event_a_id, event_b_id)
);

CREATE INDEX idx_dedup_log_decision ON event_dedup_log (decision) WHERE decision = 'uncertain';
```

**ID-Kanonisierung:** Vor jedem Insert werden die IDs sortiert: `event_a_id < event_b_id` (UUID-Vergleich). Damit existiert jedes Paar genau einmal — kein (A,B) + (B,A). Die Code-Invariante dafuer liegt in der Dedup-Engine, nicht im DB-Constraint (CHECK auf UUID-Ordnung ist fragil).

**Zweck:** Jede Dedup-Entscheidung wird gespeichert (Bericht 1: "Entscheidungen speichern"). Ermoeglicht:
- Audit Trail ("warum wurden diese Events zusammengefuehrt?")
- Review Queue fuer unsichere Faelle
- Manuelle Korrekturen (split/merge) ohne Datenverlust
- Re-Evaluation bei verbesserten Algorithmen

### 2.3 `publish_status` erweitern

Neuer Wert: `'duplicate'`
- Nicht sichtbar in App (wie `suppressed`)
- Nicht in Sitemap
- Nicht in Featured/Recommendations
- Aber: ueber Admin-Panel einsehbar mit Link zum Primary Event

**Migration:** Phase 1 fuehrte `publish_status` mit CHECK-Constraint ein:
```sql
CHECK (publish_status IN ('draft', 'published', 'published_low_confidence', 'needs_review', 'suppressed'))
```
Phase 3 muss diesen Constraint explizit anpassen:
```sql
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_publish_status_check;
ALTER TABLE events ADD CONSTRAINT events_publish_status_check
  CHECK (publish_status IN ('draft', 'published', 'published_low_confidence', 'needs_review', 'suppressed', 'expired', 'duplicate'));
```
**Wichtig:** `expired` war bereits im bestehenden Constraint erlaubt und muss erhalten bleiben. Der neue Constraint fuegt NUR `duplicate` hinzu, ohne bestehende Werte zu entfernen. Sonst brechen alte Daten oder bestehende Logik.

### 2.4 `duplicate_of` Invarianten

Harte Regeln fuer `duplicate_of`:
1. **Kein Self-Reference:** `duplicate_of <> id` (CHECK-Constraint)
2. **Keine Chains:** `duplicate_of` darf nur auf ein Event zeigen das selbst `duplicate_of IS NULL` hat. Keine A → B → C Ketten.
3. **Nur auf Primary:** Code-Invariante in der Dedup-Engine — vor dem Setzen von `duplicate_of` wird geprueft dass das Ziel kein Duplikat ist.

```sql
ALTER TABLE events ADD CONSTRAINT events_no_self_duplicate CHECK (duplicate_of <> id);
```

Die Chain-Prevention ist eine Code-Invariante, kein DB-Constraint (wuerde Deadlocks bei Batch-Updates verursachen). Die Dedup-Engine resolved Chains: wenn B bereits `duplicate_of = A` hat und C auf B zeigen soll, wird C direkt auf A gesetzt.

**Merge-Ziel-Aufloesung:** Sowohl im Live- als auch im Batch-Flow gilt: wenn ein Candidate/Event auf ein bestehendes Event matcht das selbst `duplicate_of != NULL` hat, wird IMMER auf dessen Primary aufgeloest (`duplicate_of` des Match-Ziels nachschlagen). Es wird nie auf ein Duplicate-Kind gemerged. Das ist die zentrale Invariante die Chain-Bildung verhindert.

### 2.5 `content_fingerprint` (bestehendes Feld)

Das Feld `content_fingerprint` existiert bereits auf der `events`-Tabelle (Typ `text`, nullable). Es wird von `src/lib/dedup/fingerprint.ts` als SHA256-Hash aus `normalizeTitle(title) + '|' + datePart` erzeugt und beim Scraper-Insert gesetzt.

**Ist-Zustand:** 61.445 von 111.103 Events haben einen `content_fingerprint`. 49.658 Events haben keinen (aeltere Events vor Pipeline-Einfuehrung, oder Events ohne Titel/Datum).

**Phase 3 nutzt dieses Feld fuer Blocking** (Fingerprint-Gruppen als schnelle Dedup-Kandidaten). Phase 3 fuehrt KEIN neues Feld ein, sondern nutzt das bestehende. Der Batch-Dedup-Job berechnet fehlende Fingerprints on-the-fly fuer Events die noch keinen haben, persistiert sie aber nicht zurueck (das ist Aufgabe des naechsten Scraper-Runs oder eines separaten Backfill-Scripts).

### 2.6 `garbage_title_patterns` (Config, kein DB-Table)

Hardcoded Liste von Titeln die keine echten Events sind:
```
Oeffnungszeiten, Kontakt, Impressum, Datenschutz, AGB,
Startseite, Home, Willkommen, Ueber uns, About,
Newsletter, Anmeldung, Registrierung
```
Diese werden beim Scoring als `publish_status = 'suppressed'` + Flag `garbage_title` behandelt.

---

## 3. Dedup-Score-Engine

### 3.1 Score-Komponenten

Jedes Paar (Event A, Event B) bekommt einen Multi-Dimensional Score:

#### Title Score (Gewicht: 0.30)
```
1. Fingerprint-Match (title+day hash identisch): 1.0
2. Compact-Title Jaro-Winkler: jaroWinkler(compactA, compactB)
3. Token Overlap: |tokens(A) ∩ tokens(B)| / max(|tokens(A)|, |tokens(B)|)
4. Finaler Title Score = max(fingerprint_match, 0.7 * jaro_winkler + 0.3 * token_overlap)
```

**Wichtig:** Fingerprint-Match allein reicht NICHT fuer automatisches Merge. "Maibaumaufstellen" hat in 18 Gemeinden denselben Fingerprint, ist aber NICHT dasselbe Event. Fingerprint ist nur ein Signal, kein Entscheider.

#### DateTime Score (Gewicht: 0.20)
```
gleicher Tag + gleiche Uhrzeit (±15 min): 1.0
gleicher Tag + aehnliche Uhrzeit (±2h): 0.8
gleicher Tag + keine Uhrzeit bei einem: 0.7
gleicher Tag + unterschiedliche Uhrzeit: 0.3
benachbarter Tag (±1): 0.2
sonst: 0.0
```

#### Venue Score (Gewicht: 0.25)
```
gleiche venue_id (beide != null): 1.0
gleicher location_name (normalized): 0.8
aehnlicher location_name (JW > 0.85): 0.6
gleiche Stadt + aehnlicher Name: 0.5
sonst: 0.0
```

**Kritisch:** Wenn beide Events eine venue_id haben und diese UNTERSCHIEDLICH ist → Score = 0.0, unabhaengig vom Namen. Verschiedene Venues = verschiedene Events.

#### Geo Score (Gewicht: 0.15)
```
Distanz < 100m: 1.0
Distanz < 500m: 0.8
Distanz < 2km: 0.5
Distanz < 10km: 0.2
Distanz > 10km oder keine Coords: 0.0
```

**Sonderregel:** Wenn Geo Score = 0.0 (>10km oder keine Coords) aber Venue Score = 1.0 (gleiche venue_id), dann Geo Score = 0.8 (Venue-Koordinaten als Proxy).

#### URL Score (Gewicht: 0.10)
```
gleiche source_url (normalized): 1.0
gleiche ticket_url (normalized): 0.9
gleicher URL-Host + aehnlicher Path: 0.4
sonst: 0.0
```

### 3.2 Overall Score

```
overall = title * 0.30 + datetime * 0.20 + venue * 0.25 + geo * 0.15 + url * 0.10
```

### 3.3 Entscheidungsschwellen

```
overall >= 0.85: 'merge' (automatisch zusammenfuehren)
overall 0.65–0.84: 'uncertain' (Review Queue)
overall < 0.65: 'distinct' (getrennt lassen)
```

**Hard Rules (ueberschreiben Score):**
1. **Verschiedene venue_id** (beide != null): IMMER 'distinct', egal wie hoch der Score
2. **Verschiedene Stadt** (beide != null, nicht leer): Standardmaessig 'distinct'. Ausnahme NUR bei hartem Beweis:
   - gleiche venue_id (beide != null), ODER
   - gleiche ticket_url (normalized, nicht leer), ODER
   - gleiche source_id + gleiche source_name
   - Ohne einen dieser Beweise: verschiedene Stadt = verschiedene Events, Punkt.
   - Begruendung: Touring-Events, Serienevents und gleichnamige Gemeinde-Events (Maibaumaufstellen in 18 Doerfern) wuerden sonst falsch gemergt.
3. **Gleiche source_id + gleiche source_name**: IMMER 'merge' (selbe Quelle, selber Identifier = definitiv dasselbe Event)
4. **Gleiche ticket_url** (normalized, nicht leer): IMMER 'merge' (selbe Ticketseite = selbes Event)
5. **Gleiche source_url**: Starkes Signal, aber KEIN automatischer Merge. Viele Quellen haben generische Kalenderseiten, Sammelseiten oder Recurring-URLs die nicht ein einzelnes Event repraesentieren. Stattdessen: source_url-Match setzt `url_score = 1.0`, was den Overall Score hebt, aber die Schwelle 0.85 muss trotzdem erreicht werden.
6. **Garbage-Titel**: Skip — werden vorher suppressed, nehmen nicht am Dedup teil

### 3.4 Blocking-Strategie (Performance)

Bei 111k Events waere All-vs-All O(n^2) = 12 Milliarden Vergleiche. Das ist nicht machbar.

**Blocking:** Nur Events vergleichen die ueberhaupt Duplikate sein KOENNTEN:

1. **Block by Day**: Events am selben Tag (start_date::date). ~300 Events/Tag im Schnitt → ~45.000 Vergleiche/Tag
2. **Block by Fingerprint**: Events mit gleichem content_fingerprint sofort als Kandidaten
3. **Block by Venue**: Events mit gleicher venue_id am selben Tag
4. **Block by City+Title-Prefix**: Events in gleicher Stadt mit erstem Wort im Titel gleich

Innerhalb jedes Blocks: alle Paare scoren. Zwischen Blocks: keine Vergleiche.

**Erwartete Vergleiche:** ~500k–1M statt 12 Milliarden. In 5-10 Minuten machbar.

---

## 4. Primary-Event-Auswahl (Feldpriorisierung)

Wenn ein Cluster gebildet wird (2+ Events als 'merge'), muss EIN Event als Primary ausgewaehlt werden. Die anderen bekommen `duplicate_of = primary.id`.

### 4.1 Primary-Auswahl-Kriterien (in Reihenfolge)

1. **Hoechster quality_score** (gesamte Datenqualitaet)
2. Bei Gleichstand: **Laengste sinnvolle Beschreibung** (length(description) > 50)
3. Bei Gleichstand: **Hat image_url**
4. Bei Gleichstand: **Hat ticket_url**
5. Bei Gleichstand: **Aeltestes created_at** (erstes in der DB)

### 4.2 Feld-Anreicherung (Merge-Felder)

Das Primary Event wird mit Feldern aus Duplikaten ANGEREICHERT, wenn das Primary diese nicht hat:

| Feld | Regel |
|------|-------|
| description | Laengste brauchbare Beschreibung (> 50 chars) |
| image_url | Erstes vorhandenes Bild |
| ticket_url | Erstes vorhandenes Ticket |
| end_date | Falls Primary keins hat, vom Duplikat uebernehmen |
| price_text | Falls Primary keins hat |
| organizer | Falls Primary keins hat |
| tags | Union aller Tags |

**Wichtig:** Folgende Felder werden NIE ueberschrieben:
- title (Primary behält seinen)
- start_date (Primary behält seinen)
- location_name, address, latitude, longitude (Primary behält Location)
- venue_id (Primary behält Venue)
- source_url (bleibt die primaere Quelle)

### 4.3 Merge-Tracking

Nach dem Merge:
- Primary behaelt `publish_status` basierend auf quality_score
- Primary bekommt `dedup_cluster_id` = neue UUID
- Duplikate bekommen `publish_status = 'duplicate'`, `duplicate_of = primary.id`, `dedup_cluster_id` = gleiche UUID
- Primary's `quality_score` wird um Dedup-Confidence-Bonus erhoeht (gut geclustert = +5 auf dedup_confidence Dimension)

---

## 5. Pipeline-Integration

Es gibt zwei klar getrennte Dedup-Flows. Diese sind NICHT derselbe Code-Pfad.

### 5.1 Flow A: Live-Dedup (waehrend Scraper-Runs)

Laeuft im Orchestrator als Teil des Ingestion-Flows:

```
Raw → Normalize → Venue Match → Upsert (mit Live-Dedup) → Quality Score
```

**Ablauf:**
1. Candidate wird normalisiert und Venue-gematcht (wie bisher)
2. VOR dem Insert/Update: Dedup-Check gegen bestehende persistierte Events
3. Blocking: nur Tag + Stadt/Venue (Performance-Budget: max 50ms pro Candidate)
4. Wenn Merge-Match gefunden: Candidate wird Update auf das bestehende Primary Event (Feld-Anreicherung)
5. Wenn Uncertain: Candidate wird normal inserted mit Flag `duplicate_uncertain`
6. Wenn kein Match: Candidate wird normal inserted
7. NACH dem Insert/Update: Quality Score wird berechnet (dedup_confidence Dimension nutzt den Dedup-Status)

**event_dedup_log:** Wird im Live-Flow NICHT synchron geschrieben (50ms Budget). Stattdessen: Live-Dedup-Entscheidungen werden nur ueber die resultierenden Felder sichtbar (`duplicate_of`, `dedup_score`, `dedup_cluster_id`). Der naechste Batch-Dedup-Lauf erkennt diese bestehenden Zuordnungen und schreibt die fehlenden Log-Eintraege nach. Damit gilt: **Batch-/manuelle Entscheidungen werden immer geloggt, Live-Entscheidungen werden asynchron nachgeloggt.**

**Warum Upsert vor Score?** Weil der Quality Score die `dedup_confidence` Dimension enthaelt. Ein sauber geclustertes Event bekommt +5, ein unsicheres +0. Der Score wird erst berechnet nachdem der Dedup-Status klar ist.

### 5.2 Flow B: Batch-Dedup (Backfill + periodische Re-Evaluation)

Laeuft als eigenstaendiges Script auf bereits persistierten Events:

```bash
npm run dedup -- --dry-run      # Zeigt was passieren wuerde
npm run dedup                    # Fuehrt Merges aus
npm run dedup -- --reset         # Re-evaluiert alle Cluster
```

**Ablauf:**
1. Lade Events Tag fuer Tag aus Supabase
2. Blocking: Day + Fingerprint + Venue + City
3. Innerhalb jedes Blocks: alle Paare scoren
4. Fuer jedes Paar: event_dedup_log Eintrag schreiben (beide Events haben IDs)
5. Merges ausfuehren: Primary waehlen, Duplikate markieren, Felder anreichern
6. Quality Scores der betroffenen Events re-berechnen

**event_dedup_log:** Wird im Batch-Flow IMMER geschrieben. Beide Events existieren bereits in der DB und haben IDs. Kein Timing-Problem.

### 5.3 Warum zwei getrennte Flows?

- **Live-Dedup** braucht <50ms pro Candidate. Log-Writes und komplexe Cluster-Analysen sind zu teuer.
- **Batch-Dedup** kann sich Zeit nehmen, schreibt den vollen Audit Trail, und findet auch Fuzzy-Matches die Live-Dedup verpasst.
- Beide Flows nutzen dieselbe Score-Engine (gleiche Gewichte, gleiche Hard Rules), aber unterschiedliche Blocking-Strategien und unterschiedliche Persistenz.

### 5.4 Re-Evaluation

Dedup-Entscheidungen sind nicht permanent. Wenn sich Daten aendern (Venue zugewiesen, Koordinaten korrigiert), sollte der Cluster re-evaluiert werden.

Trigger fuer Re-Evaluation:
- `venue_id` aendert sich
- `latitude`/`longitude` aendern sich
- Manueller Review (Admin setzt 'manual_split')

---

## 6. Garbage-Event-Filter

### 6.1 Titel-Blacklist

Events mit diesen Titeln (case-insensitive, nach Normalisierung) werden VOR dem Dedup suppressed:

```typescript
const GARBAGE_TITLES = new Set([
  'oeffnungszeiten', 'offnungszeiten', 'öffnungszeiten',
  'kontakt', 'impressum', 'datenschutz', 'agb',
  'startseite', 'home', 'willkommen',
  'ueber uns', 'über uns', 'about', 'about us',
  'newsletter', 'anmeldung', 'registrierung',
  'suche', 'search', 'sitemap', 'login',
  'warenkorb', 'checkout', 'zahlung',
]);
```

### 6.2 Titel-Laenge-Minimum

Titel mit < 3 Zeichen nach Normalisierung → suppressed + Flag `short_title`.

### 6.3 Neuer FlagType

```typescript
type FlagType = ... | 'garbage_title' | 'duplicate_merged' | 'duplicate_uncertain';
```

---

## 7. Admin-Panel Erweiterungen

### 7.1 Dedup-Dashboard (neuer Tab)

Route: `/admin/dedup`

Zeigt:
- **Cluster-Statistiken**: Total Clusters, Events in Clusters, Merge-Rate, Uncertain-Rate
- **Top Clusters**: Groesste Dedup-Gruppen mit Expand-Detail
- **Uncertain Queue**: Events mit `decision = 'uncertain'`, sortiert nach overall_score DESC
  - Pro Eintrag: Event A + Event B nebeneinander, Score-Breakdown, Buttons: Merge / Split / Skip

### 7.2 Event-Detail Erweiterung

Auf der Events-Seite (`/admin/events`):
- Neue Spalte: "Dupes" (Anzahl Duplikate im Cluster)
- Bei Duplikaten: Link zum Primary Event
- Bei Primary Events: Expandable List der Duplikate

### 7.3 API-Endpoints

```
GET  /api/admin/dedup/stats          — Cluster-Statistiken
GET  /api/admin/dedup/uncertain      — Uncertain Queue (paginated)
POST /api/admin/dedup/[id]/resolve   — Manual merge/split
GET  /api/admin/dedup/cluster/[id]   — Alle Events in einem Cluster
```

---

## 8. API/Frontend Aenderungen

### 8.1 Events API

`/api/events` filtert bereits auf `publish_status IN ('published', 'published_low_confidence')`. Da `'duplicate'` nicht in dieser Liste ist, werden Duplikate automatisch ausgeblendet. **Keine API-Aenderung noetig.**

### 8.2 Sitemap

Bereits gefiltert auf `publish_status = 'published'`. **Keine Aenderung noetig.**

### 8.3 Event Detail Page

Wenn ein User per Deep-Link auf ein Duplikat kommt (z.B. altes Bookmark):
- 301 Redirect zum Primary Event (`duplicate_of`)
- Nicht 404 — das Event existiert ja, es hat nur ein besseres Primary

### 8.4 Stats/Counts

`/api/stats/counts` sollte `duplicate` Events ausschliessen (wie `suppressed`):
```sql
WHERE publish_status IN ('published', 'published_low_confidence')
```
Ist bereits so. **Keine Aenderung noetig.**

---

## 9. Backfill-Strategie

### 9.1 Phase 1: Garbage Cleanup
1. Suppresse alle Events mit Garbage-Titeln
2. Erwartet: ~200-500 Events

### 9.2 Phase 2: Fingerprint-basiertes Dedup
1. Lade alle Events mit gleichem `content_fingerprint`
2. Innerhalb jeder Fingerprint-Gruppe: Score alle Paare
3. Hard Rule: verschiedene venue_id oder verschiedene Stadt → distinct
4. Merge hochscorige, uncertain-flag mittlere
5. Erwartet: ~5.000 Merges, ~1.000 Uncertain

### 9.3 Phase 3: Fuzzy Dedup (Day-Block)
1. Fuer jeden Tag: lade alle Events
2. Blocking: Stadt + erstes Titelwort
3. Innerhalb jedes Blocks: Score alle Paare
4. Erwartet: ~2.000 zusaetzliche Merges

### 9.4 Immer mit Dry-Run zuerst
```bash
npm run dedup -- --dry-run      # Zeigt was passieren wuerde
npm run dedup                    # Fuehrt Merges aus
npm run dedup -- --reset         # Re-evaluiert alle Cluster
```

---

## 10. Quality Score Anpassung

### 10.1 Dedup-Confidence-Dimension

Aktuell gibt `quality-scorer.ts` fuer die Dedup-Dimension einen Pauschalbetrag (12 Punkte fuer "Dedup + Source trust defaults").

Nach Phase 3:
```
dedup_confidence (max 10):
  - Event ist Primary in einem Cluster mit 2+ Quellen: 10
  - Event ist standalone (kein Cluster, kein Duplikat): 7
  - Event hat Flag 'duplicate_uncertain': 3
  - Event ist Duplikat (duplicate_of != null): 0 (irrelevant, nicht sichtbar)
```

### 10.2 Garbage-Event Score
```
Garbage-Titel → quality_score = 0, publish_status = 'suppressed'
```

---

## 11. Acceptance Criteria

- [ ] Garbage-Events (Oeffnungszeiten, Kontakt, etc.) werden automatisch suppressed
- [ ] Fingerprint-Duplikate mit gleicher Stadt/Venue werden zu Clustern zusammengefuehrt
- [ ] "Maibaumaufstellen" in verschiedenen Gemeinden werden NICHT zusammengefuehrt (verschiedene Orte)
- [ ] Primary Event wird aus dem qualitativ besten Event gewaehlt
- [ ] Primary Event wird mit fehlenden Feldern aus Duplikaten angereichert
- [ ] Batch- und manuelle Dedup-Entscheidungen werden in `event_dedup_log` gespeichert; Live-Entscheidungen werden beim naechsten Batch-Lauf nachgeloggt
- [ ] Unsichere Faelle (Score 0.65-0.84) landen in der Review Queue
- [ ] Admin-Panel zeigt Dedup-Dashboard mit Cluster-Stats und Uncertain Queue
- [ ] Event Detail Page redirected bei Duplikat-Zugriff zum Primary Event
- [ ] Backfill-Script --dry-run weist eine erwartete Reduktion sichtbarer Duplikate um >50% nach
- [ ] Backfill-Script Live-Run reduziert sichtbare Duplikate tatsaechlich um >50%
- [ ] Live-Dedup im Orchestrator verhindert neue Duplikate bei Scraper-Runs
- [ ] quality_score dedup_confidence-Dimension spiegelt Cluster-Status wider
- [ ] Alle bestehenden Tests (563+) bleiben gruen

---

## 12. Boundaries (Out of Scope)

- **Volle Cluster-Architektur** (canonical_event_id, event_cluster_members): Phase 5
- **Organizer Matching/Dedup**: Phase 5
- **Source Trust Score Berechnung**: Phase 4
- **Cross-Day Dedup** (Mehrtagesevent-Logik): Phase 5
- **Image-basiertes Dedup** (Bildhashes vergleichen): Phase 5
- **Link-Checking** (dead URL detection): Phase 4

---

## 13. Decision Context

### Warum Lightweight statt Full Cluster?
Full Cluster (Bericht 1, 7.4) braucht `canonical_event_id` auf JEDEM Query, jeder API-Route, jeder UI-Komponente. Das ist ein Monate-Aufwand. Lightweight Dedup (`duplicate_of` + `publish_status = 'duplicate'`) erreicht dasselbe sichtbare Ergebnis (keine Duplikate in der App) mit 10x weniger Code-Aenderungen.

### Warum Venue Score mit 0.25 Gewicht?
Venue-Matching ist nach Phase 2 das zuverlaessigste Signal. Wenn zwei Events die gleiche venue_id haben, ist die Wahrscheinlichkeit hoch dass es Duplikate sind. Umgekehrt: verschiedene venue_id = definitiv verschiedene Events.

### Warum Blocking statt All-vs-All?
111k Events = 6.2 Milliarden Paare. Selbst mit O(1)-Scoring ist das stundenlang. Day-Blocking reduziert auf ~500k Vergleiche bei gleicher Recall-Rate (Duplikate sind fast immer am selben Tag).

### Warum 301 Redirect statt 404 fuer Duplikate?
SEO-Wert bleibt erhalten. Nutzer-Bookmarks funktionieren weiter. Google transferiert PageRank zum Primary.
