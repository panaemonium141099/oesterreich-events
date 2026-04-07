# Quality System Phase 2: Venue Layer

## Goal & Context

Phase 1 hat die Pipeline (Raw -> Normalize -> Match -> Score) und das Admin Panel gebaut. Phase 2 macht den Venue Layer stabil: jede Veranstaltung soll idealerweise einer kanonischen Venue zugeordnet werden. Aktuell haben nur 0.9% der 111k Events eine venue_id, obwohl 5.637 Venues existieren.

**Referenz:** Bericht 1 — Abschnitt 6 (Venue-Normalisierung)

**Voraussetzung:** Phase 1 muss abgeschlossen sein (ist es).

---

## 1. Datenmodell

### 1.1 `venue_aliases` (NEU)

```sql
CREATE TABLE venue_aliases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  alias            text NOT NULL,
  alias_normalized text NOT NULL,
  source_name      text,
  confidence       float DEFAULT 1.0,
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Per-venue unique: gleicher normalisierter Alias darf nicht zweimal auf dieselbe Venue zeigen
  -- NICHT global unique! Generische Namen (stadthalle, pfarrsaal) duerfen mehrfach vorkommen
  -- und werden ueber Stadt/PLZ/Geo disambiguiert
  UNIQUE (venue_id, alias_normalized)
);

-- Lookup-Index fuer Matching (nicht unique — generische Namen kommen mehrfach vor)
CREATE INDEX idx_venue_aliases_normalized ON venue_aliases (alias_normalized);
CREATE INDEX idx_venue_aliases_venue ON venue_aliases (venue_id);
```

### 1.2 Erweiterungen an `venues`

```sql
ALTER TABLE venues ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS website_host text;

CREATE INDEX IF NOT EXISTS idx_venues_website_host ON venues (website_host)
  WHERE website_host IS NOT NULL;

-- display_name = menschenlesbarer Kurzname (z.B. "Flex")
-- website_host = extrahierter Host aus website URL (z.B. "flex.at")
--   Wird fuer URL-/Host-basiertes Matching in Stufe 1 benoetigt
--   Index noetig, da der Matcher beim Backfill ueber 110k Events gegen Hosts sucht
```

**`trust_score`:** Wird in Phase 2 NICHT eingefuehrt. Das Feld waere unterdefiniert (wer setzt es, wann wird es aktualisiert, wofuer wird es genutzt). Wird als vorbereitetes Feld in Phase 4 (Source Trust) eingefuehrt, wenn klare Regeln existieren.

**`website_url`:** Existiert bereits als `website` auf der `venues`-Tabelle. `website_host` wird beim Seed aus `website` extrahiert.

### 1.3 Erweiterung an `events`

Bereits vorhanden: `venue_id uuid REFERENCES venues(id)`. Neues Feld:

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_match_confidence float;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_match_stage int
  CHECK (venue_match_stage IN (0,1,2,3));

-- venue_match_confidence = 0.0-1.0, wie sicher der Venue-Match ist
-- venue_match_stage Semantik:
--   NULL = kein Match (venue_id ist NULL)
--   0    = manuell gesetzt (Admin oder Import, wird nie automatisch ueberschrieben)
--   1    = Stufe 1 harter Treffer (exakter Alias + Stadt, exakte URL)
--   2    = Stufe 2 naher Treffer (Fuzzy + PLZ, Distanz + Name)
--   3    = Stufe 3 unsicherer Treffer (NICHT automatisch gemappt, nur zur Dokumentation)
```

---

## 2. Venue Matching Engine

### 2.1 Drei-Stufen-Matching

**Stufe 1: Harte Treffer (Confidence >= 0.95)**
- Exakter Alias-Match (normalized) + gleiche Stadt oder PLZ
- Exakter Name + gleiche Stadt
- Exakte URL oder bekannter Venue-Host (website_host Match)

**Stufe 2: Nahe Treffer (Confidence 0.70-0.94)**
- Aehnlicher Name (Jaro-Winkler >= 0.85) + gleiche PLZ
- Kleine Distanz (< 500m) + aehnlicher Name (JW >= 0.80)
- Bekannte Aliasformen (mit Confidence aus venue_aliases)

**Stufe 3: Unsichere Treffer (Confidence < 0.70)**
- Aehnlicher Name, aber Stadt fehlt
- Name generisch ("Gemeindezentrum", "Pfarrsaal")
- Koordinaten nur grob
- Mehrere moegliche Treffer

**Stufe 3 wird NICHT automatisch gemappt.** → Low Confidence, Venue-Flag in quality_flags, temporaer ungemappt. venue_id bleibt NULL.

### 2.2 Alias-Normalisierung

Venue-Namen werden normalisiert fuer den Vergleich:
1. Lowercase + trim
2. Unicode NFC
3. Artikel entfernen (der, die, das, the)
4. Venue-Suffixe normalisieren (Wien/Vienna, Graz → Stadt-Normalisierung)
5. Abkuerzungen expandieren (Str. → Strasse, Pl. → Platz)
6. Satzzeichen entfernen

Beispiel: "Flex Wien", "Flex, Vienna", "FLEX" → alle normalisiert zu "flex"

### 2.3 Geometrische Pruefung

Wenn Event + Venue beide Koordinaten haben:
- Distanz < 200m → Match staerken (+0.15 Confidence)
- Distanz 200m-2km → Neutral
- Distanz > 2km → Match schwaachen (-0.20 Confidence), quality_flag `venue_geo_mismatch`

**`venue_geo_mismatch` ist nicht nur ein Flag**, sondern hat Auswirkungen:
- Match-Confidence wird gesenkt (-0.20)
- Location Score wird um 5 Punkte reduziert
- Bei Confidence-Drop unter 0.40 → `publish_status` kann auf `needs_review` fallen (wenn Gesamtscore dadurch unter 40 faellt)

### 2.4 Alias-Seed

Beim Start werden aus bestehenden Venues automatisch Aliase generiert:
- `name` → Alias
- `name_normalized` → Alias
- `display_name` → Alias (wenn vorhanden)
- Stadt-Varianten: "Flex Wien" + "Flex" + "Flex Vienna"

**Generic-Name-Blacklist:** Generische Venue-Namen werden NICHT als harte Aliase (confidence=1.0) geseedet. Stattdessen:

Blacklisted generische Namen (Beispiele):
- pfarrsaal, stadthalle, kulturhaus, gemeindezentrum, veranstaltungszentrum
- gemeindesaal, vereinshaus, mehrzweckhalle, festsaal, turnhalle
- gasthaus, gasthof, wirtshaus (ohne Eigennamen-Suffix)

Regel fuer generische Namen:
- Nur mit Stadtsuffix seedbar: "Stadthalle Wien" → Alias mit confidence=0.8
- Ohne Stadtsuffix: NICHT geseedet (wird nur ueber PLZ/Geo disambiguiert)
- Erkennung: Name besteht nur aus einem generischen Wort (keine Eigennamen)

### 2.5 Venue-artig-Erkennung fuer `venue_unmatched` Flag

**`venue_unmatched` wird NICHT auf jedes Event ohne venue_id gesetzt.** Viele Events haben absichtlich keine Venue im engeren Sinn:
- hauptplatz, park, innenstadt, open air gelaende, wanderweg, gemeindegebiet

Das Flag wird nur gesetzt wenn ALLE diese Bedingungen erfuellt sind:
1. `location_name` ist vorhanden
2. Der Name sieht venue-artig aus (enthaelt Venue-Praefix wie Halle, Zentrum, Theater, Club, Bar, etc. ODER enthaelt einen Eigennamen + Ort)
3. Genug Kontext vorhanden (Stadt oder PLZ oder Koordinaten)
4. Trotzdem kein Match gefunden

Erkennung venue-artig: Wiederverwendung der bestehenden `isVenueName()` Funktion aus `src/lib/location-normalizer.ts` (prueft ~40 Venue-Praefixe).

---

## 3. Pipeline-Integration

### 3.1 Venue Matching im Orchestrator

Nach der Normalisierung und vor dem Canonical Upsert wird ein Venue-Matching-Schritt eingefuegt:

```
RAW → NORMALIZATION → VENUE MATCHING → MATCHING + CANONICAL UPSERT → QUALITY SCORING
```

Der Venue Matcher setzt `venue_id`, `venue_match_confidence` und `venue_match_stage` auf dem **Laufzeit-Objekt** `NormalizedCandidate` (TypeScript Interface), bevor der Canonical Upsert diese Werte in die `events`-Tabelle schreibt.

**Wichtig:** Die Venue-Felder werden NICHT in der `normalized_event_candidates`-Tabelle persistiert. Diese Tabelle bleibt ein reines Normalisierungs-Zwischenprodukt. Venue Matching ist ein Laufzeit-Schritt zwischen Normalisierung und Upsert. Das TypeScript-Interface `NormalizedCandidate` in `src/lib/pipeline/types.ts` wird um optionale Venue-Felder erweitert (`venue_id?`, `venue_match_confidence?`, `venue_match_stage?`), aber die DB-Tabelle bekommt diese Spalten nicht.

### 3.2 Venue-Konflikt beim Canonical Upsert

Wenn ein bestehendes Event bereits `venue_id = A` hat und ein neuer Candidate `venue_id = B` bringt:

**Ueberschreibung nur erlaubt wenn:**
- Neue venue_match_confidence ist hoeher als bestehende
- ODER bestehende venue_match_confidence ist NULL (kein belastbarer Match vorhanden)
- ODER bestehende venue_match_stage > neue venue_match_stage (haerterer Match gewinnt)

**Ueberschreibung NICHT erlaubt wenn:**
- Bestehende Confidence >= neue Confidence UND bestehende Stage <= neue Stage
- Bestehende venue_id wurde manuell gesetzt (venue_match_stage = 0 oder NULL mit venue_id != NULL)

Ohne diese Konfliktregel kann ein guter Match durch einen schwächeren ueberschrieben werden.

### 3.3 Quality Score Update

Location Score (Phase 1: max 25 Punkte) wird differenziert nach Match-Stufe:

| Kriterium | Phase 1 | Phase 2 |
|-----------|---------|---------|
| Koordinaten vorhanden | +7 | +7 |
| Adresse vorhanden | +5 | +3 |
| Location-Name vorhanden | +3 | — (ersetzt durch Venue) |
| venue_id (Stufe 1) | — | +8 |
| venue_id (Stufe 2) | — | +5 |
| AT-Check bestanden | +5 | +5 |
| Bundesland/PLZ konsistent | +5 | — (ersetzt durch Venue-Geo) |
| Venue-Geo konsistent | — | +5 (bei Distanz < 2km) |
| Venue-Geo Mismatch | — | -5 (bei Distanz > 2km) |
| **Total** | **25** | **max 28, capped at 25** |

**Implementierungsregel:** `location_score = Math.min(25, sumOfPoints)`. Kein Event kann mehr als 25 Location-Punkte bekommen, auch wenn die Einzelposten theoretisch 28 ergeben.

Hinweis: Wenn kein Venue-Match existiert, gelten die Phase-1-Regeln (Location-Name +3, Bundesland/PLZ +5).

### 3.4 Quality Flags (neu in Phase 2)

| Flag | Severity | Trigger |
|------|----------|---------|
| `venue_unmatched` | low | Event hat venue-artigen location_name + Kontext, aber kein Match (siehe 2.5) |
| `venue_geo_mismatch` | medium | Venue gematcht aber Distanz > 2km. Senkt Confidence und Score. |

---

## 4. Backfill: Venue-Matching fuer bestehende Events

### 4.1 Script: `src/scripts/backfill-venue-matching.ts`

**Chunked Verarbeitung (1000 Events/Batch):**
1. Laedt Events ohne venue_id in Batches von 1000
2. Fuer jedes Event: Venue Matching (3 Stufen)
3. Bei Match: venue_id, venue_match_confidence, venue_match_stage setzen
4. Quality Score neu berechnen (Location Score aktualisiert)
5. Quality Flags aktualisieren (venue_unmatched, venue_geo_mismatch)

**Dry-Run Modus (--dry-run) gibt aus:**
- Gesamt-Match-Verteilung:
  - Anzahl Stufe 1 Treffer
  - Anzahl Stufe 2 Treffer
  - Anzahl Stufe 3 (unsicher, nicht gemappt)
  - Anzahl unmatched (kein Treffer)
- Anzahl `venue_geo_mismatch`
- Match-Rate pro Quelle (source_name)
- Top 20 gematchte Venues (nach Anzahl Events)
- Top 20 ungematchte location_names (fuer manuelles Alias-Seeding)

**Ohne diese Metriken laesst sich die Match-Qualitaet nicht serioes bewerten.**

### 4.2 Alias-Seed Script: `src/scripts/seed-venue-aliases.ts`

Separates Script, laeuft VOR dem Backfill:
1. Laedt alle Venues
2. Generiert Aliase (name, name_normalized, display_name, Stadt-Varianten)
3. Wendet Generic-Name-Blacklist an
4. Extrahiert website_host aus website URL
5. Schreibt venue_aliases + aktualisiert venues.website_host + venues.display_name

---

## 5. Admin Panel Erweiterung

Keine neuen Seiten. Erweiterungen:
- **Quality Page**: `venue_unmatched` und `venue_geo_mismatch` Flags sichtbar
- **Sources Page**: Venue-Match-Rate pro Quelle anzeigen
- **Overview**: Venue-Match-Rate als StatCard (Events mit venue_id / Total Events)

---

## 6. Acceptance Criteria

**Datenmodell:**
- [ ] `venue_aliases` Tabelle mit `UNIQUE (venue_id, alias_normalized)` (nicht global unique)
- [ ] `display_name` und `website_host` auf Venues
- [ ] `venue_match_confidence` und `venue_match_stage` auf Events
- [ ] Kein `trust_score` in Phase 2 (erst Phase 4)

**Venue Matcher:**
- [ ] 3-Stufen-Matching implementiert mit korrekten Confidence-Bereichen
- [ ] Stufe 1/2/3 Score-Unterscheidung im Quality Score (+8/+5/0)
- [ ] Alias-Normalisierung fuer Venue-Namen
- [ ] Generic-Name-Blacklist im Alias-Seed
- [ ] Geometrische Pruefung mit Score-Auswirkung (nicht nur Flag)
- [ ] `venue_unmatched` nur fuer venue-artige Namen mit Kontext
- [ ] Venue-Konflikt-Regel beim Upsert (haerterer Match gewinnt)

**Pipeline:**
- [ ] Venue Matching vor Canonical Upsert integriert
- [ ] Location Score differenziert nach Match-Stufe
- [ ] venue_match_confidence und venue_match_stage werden geschrieben

**Backfill:**
- [ ] Alias-Seed Script mit Generic-Blacklist
- [ ] Venue-Matching Backfill chunked (1000/Batch)
- [ ] Dry-Run mit Match-Verteilung, Metriken pro Quelle, Top Venues/Unmatched
- [ ] Live-Modus schreibt venue_id + aktualisiert Scores

**Admin:**
- [ ] venue_unmatched und venue_geo_mismatch Flags sichtbar
- [ ] Venue-Match-Rate auf Overview und Sources

**Kompatibilitaet:**
- [ ] Tests fuer Venue Matcher (Normalisierung, 3-Stufen, Geo-Check, Blacklist)
- [ ] Bestehende Tests bleiben gruen

---

## 7. Boundaries (Out of Scope Phase 2)

- Event Cluster / Multi-Source Merge (Phase 3)
- Organizer-Entities (Phase 3)
- Erweiterte Review Queue mit assign-venue (Phase 4)
- Venue trust_score (Phase 4)
- Venue-Follows / Venue-Detail-Seiten (separates Feature)
- OSM/Nominatim Live-Lookup fuer neue Venues (manueller Import bleibt)

---

## 8. Decision Context

**Warum alias_normalized nicht global unique?**
Generische Venue-Namen (stadthalle, pfarrsaal, kulturhaus) kommen in vielen Staedten vor. Globale Uniqueness wuerde entweder diese Names blocken oder falsche 1:1-Zuordnungen erzwingen. Disambiguierung erfolgt ueber Stadt/PLZ/Geo, nicht ueber Alias-Uniqueness.

**Warum kein trust_score in Phase 2?**
Das Feld waere unterdefiniert — wer setzt es, wann, wofuer. Ohne klare Regeln wird es toter Code. Wird in Phase 4 (Source Trust Score) mit klarer Semantik eingefuehrt.

**Warum venue_unmatched nur fuer venue-artige Namen?**
Ein Flag auf jedem Event ohne venue_id waere wertlos (110k Flags). Nur Events mit erkennbarem Venue-Namen + ausreichend Kontext werden geflaggt — das sind die Faelle, wo ein Match erwartet wird aber fehlt.

**Warum unterschiedliche Score-Punkte fuer Stufe 1 vs. 2?**
Ein exakter Alias-Match (Stufe 1) ist signifikant zuverlaessiger als ein Fuzzy-Match (Stufe 2). Die Punktedifferenz (+8 vs +5) bildet diesen Qualitaetsunterschied im Score ab und verhindert, dass schwache Matches den gleichen Qualitaetsboost bekommen wie harte.
