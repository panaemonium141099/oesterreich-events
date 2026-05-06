# fn-14-datenqualitats-rework-claude-enrichment.7 Sport/Outdoor-Scraper: Research + 5-7 verified Sources

## Description

**WICHTIG (aus Codex-Review):** Diese Task war "research bundled into delivery" — wird jetzt explizit in **Research-Subtask** und **Implementation** gesplittet.

Erweitere die existing Sport/Outdoor-Coverage. Existing scrapers (`OutdoorSportScrapers.ts`, `SportScrapers.ts`): Naturfreunde, Alpenverein-global, OeAVEvents, LaufenAt, RadNet, OeFB, RunnersFun.

**Size:** M-L (Research-Phase + 5-7 Scraper, sequenziell)

**Files:**
- `.flow/research/fn-14.7-sport-sources.md` (NEU, Research-Output)
- `src/lib/scrapers/niche/SportScrapers.ts` (extend)
- `src/lib/scrapers/niche/OutdoorSportScrapers.ts` (extend)
- ~~evtl. `src/lib/scrapers/niche/AlpenvereinSektionenScraper.ts` (NEU)~~ (DEPRIORITIZED per Interview — Datei nicht erstellen; Alpenverein bereits durch existing scrapers abgedeckt)
- ~~evtl. `src/scripts/import-alpenverein-sektionen.ts`~~ (DEPRIORITIZED per Interview — Alpenverein bereits durch existing scrapers abgedeckt; Datei nicht mehr erstellen)
- `src/lib/scrapers/index.ts` (registrations)

## Approach

### Quellen-Strategie (nach Interview, 2026-05-06)

**Priorisierte Source-Auswahl (6 Sources, target):**

| # | Source | Priorität | Geschätzte Events | Tags | Notizen |
|---|---|---|---|---|---|
| 1 | **bergwelten.com** Touren-Events | **Top** (User-Pick) | ~100/Monat | Outdoor, Wandern, Touren | API/HTML/RSS via Research |
| 2 | **bikeboard.at** MTB-Events | **Top** (User-Pick) | ~50/Monat | MTB, Cycling | HTML |
| 3 | **Wintersport-Source** (eine von: snowtrex.at / schiverband.at / bergsteigen.com / alpinsolo.com) | **Top** (User: Wintersport im AT-Markt riesig) | ~50/Monat (saisonal) | ski-tour, freeride, langlauf | Research entscheidet welche |
| 4 | **Yoga-Outdoor** (yogadeck.at / retreatguru.com AT-Filter) | Mid (Diversity) | ~40/Monat | Yoga, Wellness, Outdoor | HTML |
| 5 | **paragleiten.at** Paragliding | Mid (Diversity) | ~20/Monat | Paragliding, Gleitschirm | HTML |
| 6 | **Wassersport** (sup-events.at / Yachtclub Neusiedlersee / Kajak-AT) | Mid (Burgenland-Anchor) | ~30/Monat | Wassersport, SUP, Sailing | Research entscheidet welche |

**Deprioritisiert** (User abgewählt):
- ~~Alpenverein-Sektionen ICS~~ — bereits indirekt abgedeckt durch existing alpenverein.at + oeav-events Scraper
- ~~kletterhalle.at / climbthe.world~~ — bereits indirekt durch alpenverein-Klettertouren

### User-Entscheidungen (aus Interview)

**Modeling:**
- **Schwierigkeitsgrad als TAG** (`schwierigkeit-leicht/mittel/schwer`), kein DB-Feld
- **Multi-Day-Touren als 1 Event** mit `start_date` + `end_date` (existing column)
- **Geo-Anchor: Treffpunkt** als location_name (z.B. "Parkplatz Bergstation 9:00"), nicht Tourenziel
- **Commercial Veranstalter** (private Bergführer, ASI Reisen, etc.) **gleich behandeln** wie Vereine — mehr Volumen

**Quality-Gates:**
- **Kein Hard-Cap** auf Mindest-Output pro Source (Reporter zeigt Warning, Auto-Disable kommt aus fn-14.6 Sliding-Window)
- **Saisonal-only Sources laufen ganzjährig** (Wintersport-Source: Sommer 0 events ist OK; fn-14.6 events_30d_median handled saisonal-low correctly)
- **Alle 9 Bundesländer** gleich behandeln (kein Geo-Fokus auf Outdoor-Hochburgen)

**Dedup:**
- Keine source-spezifische Hierarchie — existing Dedup-Algorithmus (Fingerprint + Jaro-Winkler 0.85) entscheidet
- Source-Trust-Score (von compute-source-trust) ist tie-breaker

### Neue Tags für enrichment-taxonomy.ts (Phase 2 vor Implementation)

**Sicherstellen** dass diese 12 Tags in `src/lib/category-classifier/enrichment-taxonomy.ts` `TAGS` Array existieren — **nur fehlende ergänzen, keine Duplikate**:

```typescript
// Sport-Outdoor-Erweiterung (einige existieren ggf. schon — z.B. wassersport, kajak, langlauf)
'paragliding', 'gleitschirm',
'wassersport', 'sup', 'sailing', 'kajak',
'ski-tour', 'freeride', 'langlauf',
'schwierigkeit-leicht', 'schwierigkeit-mittel', 'schwierigkeit-schwer',
```

Workflow:
1. Audit current TAGS: `grep -E "(wassersport|kajak|langlauf|paragliding)" enrichment-taxonomy.ts`
2. Nur die fehlenden Tags hinzufügen (`Array.includes` check)
3. Run `tsx src/scripts/regen-taxonomy-doc.ts` → `docs/TAXONOMY.md` regeneriert (regen-script darf de-duplizieren)
4. ENRICHMENT_VERSION bleibt `claude-v1` (additive Tags brechen nicht den Validator)
5. Bestehende enrichte Events sind nicht betroffen — kein Re-Run nötig

### Phase 1: Research (Subtask, BEFORE Implementation)
Erstelle `.flow/research/fn-14.7-sport-sources.md` mit:

#### bergwelten.com
- Test: HTTP HEAD/GET auf `bergwelten.com/touren`, `bergwelten.com/touren/events` etc.
- API check: `bergwelten.com/api/...` — gibt's einen public endpoint?
- robots.txt prüfen
- terms-of-service: scraping zulässig?
- Falls API: dokumentiere endpoints, response-shape, auth (API-key needed?)
- Falls nur HTML: dokumentiere selektoren, paginationsmuster

#### ~~Alpenverein-Sektionen~~ (DEPRIORITIZED per Interview — out of scope für fn-14.7)
~~Aktuell: globaler Alpenverein-Scraper (alpenverein.at). Existing alpenverein.at + oeav-events Scraper decken die wichtigsten Veranstaltungen ab. Sektionen-spezifisches Scraping nicht für fn-14.7.~~

Falls später gewünscht: separater Folge-Task. Diese Sektion bleibt als Referenz für ein potentielles fn-15+.

#### bikeboard.at, kletterhalle.at/climbthe.world, yogadeck.at, paragleiten.at, sup-events.at
- Pro Source: HTTP-test, robots.txt, scraping-strategie (HTML/JSON-LD/RSS)
- Beispiel-Selektoren falls HTML
- Geschätzte Events/Monat
- Stability assessment (kleine sites = Risk für Selector-changes)

#### Alternative AT-Quellen (falls eine der oben genannten nicht funktioniert)
- bergsteigen.com (auch Red Bull)
- alpinsolo.com
- snowtrex.at (Wintersport)
- crossfit-austria.com (Functional Fitness)
- hyrox.com (AT-events)

**Output-Dokument:** Pro Source: Status (✅ verified / ⚠️ partial / ❌ blocked), URL, Strategie, Beispiel-event, ToS-Hinweis.

### Phase 2: Implementation (only verified sources)
Nach Phase 1: Implementiere 5-7 Scraper aus den ✅-verified Quellen.

#### Pattern-Konsistenz
Jeder neue Scraper:
- extends `BaseScraper`
- bevorzugt JSON-LD oder API; HTML fallback wenn nötig
- nutzt `extractImageUrl()` von BaseScraper (mit fix aus fn-14.5) ODER neue `extractImageCandidate()` für width/height
- setzt `tags` initial korrekt (Outdoor/Sport/Klettern/etc.)
- setzt `category_source = 'rules'` (wird beim enrichment durch `claude` ersetzt)
- Geocoding via existing Pipeline (nicht im Scraper)
- source_id eindeutig per (title + start_date + venue) hash

#### ~~Alpenverein-Sektionen via venues~~ (DEPRIORITIZED — siehe oben, out of scope für fn-14.7)

#### Registry
In `src/lib/scrapers/index.ts`:
- Add new `new ScraperClass()` instances für jede verified source
- Niche-Counter in CLAUDE.md anpassen

#### Trust-Score initial
Neue sources starten mit `last_trust_score=NULL` -> nicht durch fn-14.6 enforce-Logik gefiltert bis erste Berechnung.

## Key context

- ICS Feed expansion via `node-ical` library (already in deps)
- Bergwelten = Red Bull Media — eher API anfragen statt scrapen
- yogadeck.at, paragleiten.at sind small-scale — robust gegen Layout-changes
- ResidentAdvisor existiert schon, irrelevant für Sport/Outdoor

## Acceptance

### Phase 1 (Research)
- [ ] `.flow/research/fn-14.7-sport-sources.md` existiert
- [ ] Pro Quelle: Status (verified/partial/blocked), URL, Strategie, ToS-Hinweis
- [ ] Mind. 5 verified Sources dokumentiert (target 6-7: bergwelten + MTB + Wintersport-Pick + Yoga-Outdoor + Paragliding + Wassersport)
- [ ] **Wintersport-Pick recherchiert**: Welche der Optionen (snowtrex.at, schiverband.at, bergsteigen.com, alpinsolo.com) hat besten output + scraping-Eignung
- [ ] **Wassersport-Pick recherchiert**: sup-events.at / Yachtclub Neusiedlersee / Kajak-Verein-AT — eine konkrete Source mit ToS-Klarheit

### Phase 2 (Tag-Erweiterung)
- [ ] `enrichment-taxonomy.ts` `TAGS` Array enthält ALLE 12 Tags exakt einmal (paragliding, gleitschirm, wassersport, sup, sailing, kajak, ski-tour, freeride, langlauf, schwierigkeit-leicht, schwierigkeit-mittel, schwierigkeit-schwer); existierende Werte (z.B. wassersport, kajak, langlauf) NICHT dupliziert; nur fehlende ergänzt; regenerated docs/TAXONOMY.md hat keine duplicate entries
- [ ] `tsx src/scripts/regen-taxonomy-doc.ts` ausgeführt, `docs/TAXONOMY.md` regeneriert
- [ ] ENRICHMENT_VERSION bleibt `claude-v1` (additive change)

### Phase 3 (Implementation)
- [ ] 6-7 neue Scraper-Klassen implementiert (NUR verified sources aus Phase 1)
- [ ] Multi-Day-Touren werden als 1 Event mit start_date+end_date persistiert (nutzt existing `end_date` column)
- [ ] Geo-Anchor: location_name = Treffpunkt (z.B. "Parkplatz Schneeberg-Bahn 9:00")
- [ ] Commercial Veranstalter (privat) werden gleich behandelt wie Vereine (kein Filter)
- [ ] Schwierigkeit landet als Tag, nicht als DB-Feld
- [ ] Alle in `src/lib/scrapers/index.ts` registriert
- [ ] Test-Run pro Source: events korrekt geparst — KEIN Hard-Cap auf Mindest-Output (Auto-Disable via fn-14.6 Sliding-Window übernimmt das)
- [ ] Wintersport-Source läuft ganzjährig (kein active_months filter); Off-Season 0 events ist akzeptabel
- [ ] Tags korrekt gesetzt: Outdoor, Sport, MTB, Klettern, Yoga, Paragliding, Wassersport, ski-tour etc.
- [ ] Coverage-Report nach Pipeline-Run zeigt neue Sources
- [ ] CLAUDE.md "Scraper-Quellen" Sektion aktualisiert mit neuen Sources
- [ ] Erste Events kriegen primary_category richtig (Sport & Bewegung / Natur & Abenteuer / Wellness & Spiritualität)

## Done summary
TBD

## Evidence
- Commits:
- Research-Doc:
- Test scrape outputs (event counts):
- Coverage-Report:
