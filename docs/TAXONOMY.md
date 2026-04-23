# Event Taxonomy — Source of Truth

> **Single-reference spec für Kategorien, Tags, Audience, Vibes, Price-Flags.**
> Jede Änderung an Event-Classification geht über dieses File. Wenn der Code abweicht,
> weiß der Code zu wenig — nicht umgekehrt.
>
> **Status:** v2, 2026-04-23. Ersetzt die alte 14-Kategorien-Taxonomie in
> `src/lib/category-classifier/taxonomy.ts` (die vor diesem File angelegt
> wurde und die Nightlife als eigene Kategorie führte + Bildung/Wirtschaft
> separat hatte).

---

## 1. Philosophie

**Hauptkategorien = Datenrückgrat** — stabil, langweilig, wenig Streitfälle, skalierbar.
**Tags = Verkaufsmaschine** — emotional, flexibel, für Personalisierung & Discovery.

Die Conversion steckt in den Tags. Die Datenordnung steckt in den Kategorien. Niemals versuchen
„Studentenleben", „Date Night" oder „Abenteuer" als Hauptkategorie zu führen — das sind
Motivations-/Verkaufsbegriffe, keine sauberen Inhaltskategorien.

**Zielanwendung:** eine AI-Query wie _„Ich bin Student und will heut abend billig saufen gehen"_
zerfällt in:

- `Studentenleben` (audience) + `Günstig` (price) + `Abendevent` (zeit) + `Bar Night` (activity)
- Primär-Kategorie als Coarse-Filter: `Nightlife & Party`
- → Embedding-Semantic-Match auf Event-Title + Description als Finisher

---

## 2. Hauptkategorien (Ebene A) — 11 + 1 Fallback

Jedes Event hat **genau eine** `primary_category`. Keine Multi-Assignment auf dieser Ebene.

| # | Kategorie | Gehört rein | Gehört NICHT rein |
|---|---|---|---|
| 1 | **Musik** | Konzert, Live-Musik, Chor/Orchester/Band, DJ-Event mit Musikfokus, Festival-Lineup-Konzerte | Clubbing/Rave → Nightlife. DJ-Set als Party-Kontext → Nightlife |
| 2 | **Kultur & Bühne** | Theater, Kabarett, Comedy, Lesung, Ausstellung, Museum, Kino, Oper, Performance-Art | Seminare → Wissen & Karriere. Kindertheater → Familie |
| 3 | **Nightlife & Party** | Clubbing, Rave, Afterparty, Club Night, Cocktail Night, Tanznacht, Pub Crawl, Bar-Events mit Party-Charakter | Bar mit primärem Trink-/Heurigen-Fokus → Essen & Trinken |
| 4 | **Essen & Trinken** | Weinverkostung, Tasting, Street Food, Brunch, Dinner Event, Kulinarik, Heuriger, Food Festival | Food-Markt → Märkte & Feste. Weinfest mit Tanz → Nightlife oder Feste |
| 5 | **Märkte & Feste** | Weihnachtsmarkt, Flohmarkt, Bauernmarkt, Stadtfest, Dorffest, Kirtag, Brauchtum, Adventmarkt, Perchten, Fasching, Maibaumfest, Sonnwendfeier | Kunsthandwerkermesse → Shopping-Tag. Weinfest → Essen & Trinken |
| 6 | **Sport & Bewegung** | Lauf, Yoga (fitness-fokussiert), Turnier, Fitness, Radfahren, Vereinsaktivitäten, Tanzkurs (sportlich) | Wanderung → Natur & Abenteuer. Yoga-Retreat → Wellness |
| 7 | **Natur & Abenteuer** | Wanderung, Outdoor-Tour, Klettern, Rafting, Naturführung, Abenteueraktivitäten, Expedition, Trekking, Erlebnistour | Reine Fitness-Läufe → Sport |
| 8 | **Wissen & Karriere** | Vortrag, Workshop, Kurs, Networking, Karriereevent, Studium/Campus Info, Gründer-Event, Konferenz/Messe mit Lern-/Business-Fokus | Künstlerischer Workshop → Kultur & Bühne (Ausnahme: wenn's ein Karrierefokus hat) |
| 9 | **Familie & Kinder** | Kinderprogramm, Familiennachmittag, Basteln, Kindertheater, Erlebnisangebote für Familien | Adventmarkt (auch familientauglich) → Märkte & Feste |
| 10 | **Community & Freizeit** | Stammtisch, Pub Quiz, Brettspielabend, Vereinstreffen, Community Meetup, Hobbygruppen, Nachbarschaftsevents, Game Night, Speed Dating | Workshop mit Lerninhalt → Wissen & Karriere |
| 11 | **Wellness & Spiritualität** | Meditation, Achtsamkeit, Breathwork, Wellness, Retreat, Sound Healing, Sauna/Therme Special, spirituelle Veranstaltungen, Gottesdienst, Wallfahrt, Pilgern | Yoga-Kurs mit Sport-Fokus → Sport & Bewegung |
| — | `Sonstiges` | Nur als interner Fallback wenn AI sich nicht entscheiden kann. **Nicht in Discovery-UI anzeigen.** | — |

### Entscheidungsregeln bei Mehrdeutigkeit

- **Wein & Tanz?** → wenn der Tanz dominiert (DJ, spät) = Nightlife & Party. Wenn der Wein dominiert = Essen & Trinken.
- **Konzert mit Afterparty?** → das primäre Event (Konzert) entscheidet: Musik. Die Afterparty wird als eigenes Event geführt (wenn im Scraper getrennt) oder als Tag `Aftershow-Party`.
- **Pub Quiz im Studenten-Club?** → Community & Freizeit (Pub Quiz primär), plus Tags `Studentenleben` + `Nightlife`-Vibe.
- **Weinwanderung mit Verkostung?** → Natur & Abenteuer (Wandern primär), plus Tag `Verkostung`.
- **Kindertheater am Adventmarkt?** → Familie & Kinder, plus Tag `Adventmarkt`.

---

## 3. Tags (Ebene B) — 6 Achsen

Jedes Event bekommt:

- 1 `primary_category`
- 0–5 `secondary_tags` (Aktivitäts-Tags, Genre-Tags)
- 0–3 `vibe_tags`
- 0–3 `audience_tags`
- 0–3 `occasion_tags` (Anlass)
- beliebig viele `format_tags` + `price_flags` (boolean-artig, deterministisch ableitbar)

### 3.1 Audience-Tags (Zielgruppe)

Wer fühlt sich angesprochen?

```
studenten
erasmus-freundlich         # English-friendly, international-student-welcoming
fuer-familien
fuer-paare
fuer-gruppen
fuer-singles
fuer-senioren
queer-friendly
kinderfreundlich
anfaengerfreundlich
touristenfreundlich
lokal-insider              # Einheimischer-Spot, touristenfrei
english-speaking           # Event läuft auf Englisch
alleine-geeignet           # Solo-Gänger ohne Awkward-Faktor
```

### 3.2 Vibe-Tags (Stimmung)

Wie fühlt's sich an?

```
entspannt
laut
elegant
kreativ
abenteuerlich
romantisch
gemuetlich
wild
exklusiv
alternativ
mainstream
lokal
kultig
trashig                    # billig, rough, Low-Budget-Charme
underground                # nicht-poliert, rough-edge, insider
fancy                      # nobel, chic, polish
authentisch                # ur-oesterreichisch, nicht designed
zum-kennenlernen           # meet-new-people-Signal
```

### 3.3 Occasion-Tags (Anlass)

Wofür ist das Event "gut"?

```
ausgehen
afterwork
date-night
erstes-date
wochenendplan
feierabend
tagesausflug
regentag                   # Indoor-Aktivität, bei schlechtem Wetter gut
geburtstagsidee
teamevent
spontan                    # kurzfristig / last-minute-tauglich
kurzfristig-heute
fuer-den-abend
saufen-gehen               # ja, mit Bindestrich, zum Matching von Queries wie "billig saufen"
kennenlernen               # generic new-people
networking-anlass
```

### 3.4 Price-Flags

Preisniveau und Zugangsbarriere:

```
# Hauptkategorien (exakt 1)
gratis
guenstig                   # < 20 €
mittel                     # 20–50 €
premium                    # > 50 €
unbekannt                  # Fallback wenn nicht ableitbar

# Zusatzflags (beliebig viele)
unter-20-euro              # redundant mit günstig, aber query-freundlich
happy-hour                 # wenn im Event spezielles Drink-Angebot erwähnt
getraenke-special          # "2 für 1", "3€ Spritzer" etc.
studentenrabatt
damenrabatt                # Ladies Night Free Entry
freier-eintritt            # Eintritt frei, Konsum bezahlt
mit-anmeldung
ohne-anmeldung
barrierefrei
kinderwagengeeignet
```

### 3.5 Format-/Zeit-Tags

Wie ist das Event formatiert?

```
open-air
indoor
hybrid
online
tagesevent
abendevent
ganztaegig
kurzformat                 # < 2h
late-night                 # startet nach 22h, geht spät
mehrtaegig
saisonal                   # nur zu bestimmten Jahreszeiten (Adventmarkt, Sommerfest)
wiederkehrend              # weekly, monthly, stamm-event
```

**Hinweis zu `Heute` / `Dieses Wochenende`:** das sind **Query-Filter auf `start_date`**, keine Event-Tags. Nicht in der Taxonomie führen.

### 3.6 Activity-Tags (secondary_tags)

Konkrete Aktivitäts-/Genre-Labels, feinkörniger als Hauptkategorie. Wichtigste Achse für AI-Query-Matching.

#### Musik & Performance

```
live-konzert rock-konzert jazz-konzert klassik-konzert
chor orchester big-band
dj-set live-band acoustic-session jam-session karaoke
open-mic poetry-slam
```

#### Party/Bar (Nightlife-Subkategorien)

```
club-night rave afterparty pub-crawl cocktail-night
bar-night happy-hour shot-night student-night ladies-night
open-bar aftershow-party
motto-party 80s-party 90s-party latino-night afro-night
erasmus-night halloween-party fasching-party silvester-party
schlager-party techno-night house-night psytrance-rave dnb-night
```

#### Kulinarisch

```
weinverkostung bier-verkostung cocktail-tasting
brunch dinner fine-dining street-food food-truck
kochkurs barbecue grillen
heuriger buschenschank
```

#### Markt/Fest-Formate

```
christkindlmarkt ostermarkt adventmarkt
flohmarkt bauernmarkt wochenmarkt designmarkt
stadtfest dorffest kirtag pfarrfest schuetzenfest
maibaumfest sonnwendfeier erntedank
perchtenlauf krampuslauf fasching
```

#### Sport

```
lauf marathon halbmarathon fahrradtour wanderung trailrun
yoga pilates fitness crossfit hiit
tennis fussball eishockey schwimmen klettern bouldern
ski langlauf snowboard
tanzkurs salsa-night zumba
```

#### Natur/Abenteuer

```
wanderung geschichtstour stadtfuehrung sightseeing-tour
rafting kanutour kajak segel-tour
klettertour bergtour alpen-tour
naturfuehrung vogelbeobachtung astronomie
escape-room
```

#### Wissen/Karriere

```
workshop kurs seminar lecture vortrag
networking startup-pitch tech-meetup
career-fair messe konferenz
sprachkurs
```

#### Community/Sozial

```
pub-quiz brettspielabend game-night lan-party
speed-dating single-night
stammtisch vereinstreffen community-meetup
stand-up comedy-abend
```

#### Familie

```
kinder-workshop puppentheater kinderkino kindertheater
familien-picknick spielfest ferienprogramm
```

#### Wellness/Spirit

```
meditation breathwork achtsamkeit sound-healing
retreat wellness-day sauna-special thermenspecial
yoga-retreat gottesdienst wallfahrt prozession
```

---

## 4. Technisches Datenmodell

### 4.1 DB-Schema (bestehende Spalten erweitern)

```
events
  id                    uuid pk
  title                 text
  description           text
  category              text  ← Ebene A, genau 1 aus den 11 (+ 'Sonstiges' Fallback)
  tags                  text[]  ← Ebene B, union of secondary + activity tags (bis 8)
  audience              text[]  ← bis 3
  vibe                  text[]  ← bis 3
  setting               text[]  ← format-tags (open-air, indoor, hybrid, online…)
  price_tier            text    ← eine von {gratis, günstig, mittel, premium, unbekannt}
  duration_type         text    ← aus dem Plan, stabil
  is_student_friendly   bool
  is_family_friendly    bool
  occasion_tags         text[]  ← NEU: ausgehen, date-night, afterwork, …
  price_flags           text[]  ← NEU: happy-hour, studentenrabatt, barrierefrei, …
  language              text
  enrichment_version    text
  enrichment_at         timestamptz
  category_source       text    ← {manual, rules, ai, enrichment} — woher kommt category
```

Neue Spalten: `occasion_tags` + `price_flags`. Migration über `alter table events add column …`.

### 4.2 AI Output-Schema (Enrichment-Script)

```json
{
  "primary_category": "Nightlife & Party",
  "secondary_tags": ["bar-night", "student-night"],
  "audience": ["studenten", "fuer-gruppen"],
  "vibe": ["wild", "trashig"],
  "occasion": ["ausgehen", "saufen-gehen", "fuer-den-abend"],
  "setting": ["indoor", "abendevent", "late-night"],
  "price_tier": "guenstig",
  "price_flags": ["happy-hour", "studentenrabatt"],
  "duration_type": "nacht-bis-morgen",
  "is_student_friendly": true,
  "is_family_friendly": false,
  "suggested_description": "…",
  "suggested_price_text": "…"
}
```

Das Enrichment-Script muss:

1. Das komplette Taxonomie-File als System-Prompt-Material haben
2. `primary_category` aus den 11 wählen (NICHT `Nightlife` sondern `Nightlife & Party`)
3. Alle Tag-Achsen als **geschlossenes Vokabular** behandeln — unbekannte Labels werden verworfen
4. Das Ergebnis atomar in die DB schreiben → `category_source='ai'` setzen
5. Nur Events anfassen wo `category_locked != true`

---

## 5. Migration alte → neue Kategorien

| Alt (aus taxonomy.ts) | Neu | Besonderheit |
|---|---|---|
| Musik | **Musik** | 1:1 |
| Kultur | **Kultur & Bühne** | Rename |
| Sport | **Sport & Bewegung** | Rename |
| Feste & Brauchtum | **Märkte & Feste** | Merge mit Märkte |
| Märkte | **Märkte & Feste** | Merge mit Feste & Brauchtum |
| Wein & Kulinarik | **Essen & Trinken** | Rename + breiter |
| Familie | **Familie & Kinder** | Rename |
| Natur | **Natur & Abenteuer** | Rename + breiter |
| Nightlife | **Nightlife & Party** | Rename |
| Bildung | **Wissen & Karriere** | Merge mit Wirtschaft |
| Wirtschaft | **Wissen & Karriere** | Merge mit Bildung |
| Gesundheit | **Wellness & Spiritualität** | Merge mit Religion |
| Religion | **Wellness & Spiritualität** | Merge mit Gesundheit |
| Sonstiges | **Community & Freizeit** (default) ODER **Sonstiges** (Fallback) | AI entscheidet |

Migration läuft via SQL-UPDATE einmal vor dem Enrichment-Rerun.

---

## 6. Implementation-Phasen

### Phase 1 — Taxonomy-Foundation
- [ ] `src/lib/category-classifier/taxonomy.ts`: 11 neue Kategorien
- [ ] `src/types/events.ts`: `Category` enum + neue Felder (`occasion_tags`, `price_flags`)
- [ ] `src/lib/category-classifier/enrichment-taxonomy.ts`: alle Tag-Achsen aktualisieren, `OCCASIONS` + `PRICE_FLAGS` neu
- [ ] `src/components/UI/TagChip.tsx`: Farben für die 11 neuen Kategorien
- [ ] DB-Migration: 2 neue Spalten `occasion_tags uuid[]`, `price_flags text[]`
- [ ] SQL-Migration: alte Kategoriewerte → neue mappen

### Phase 2 — Enrichment mit Category
- [ ] `src/scripts/enrich-openai.ts`: `OUTPUT_JSON_SCHEMA` erweitern um `primary_category` + `occasion` + `price_flags`
- [ ] `SYSTEM_PROMPT` komplett neu schreiben mit der 11er-Kategorienliste + Entscheidungsregeln
- [ ] `validateEnrichment`: Category gegen neue Liste validieren
- [ ] UPDATE-Statement: `category`, `category_source='ai'`, `occasion_tags`, `price_flags` schreiben
- [ ] `ENRICHMENT_VERSION` bumpen auf `enrich-v2-prompt1` (invalidiert alles, zwingt Rerun)
- [ ] `src/scripts/reclassify-from-tags.ts` löschen (obsolet)

### Phase 3 — Scrape-Pipeline integriert Enrichment
- [ ] `src/scripts/scrape-pipeline.ts`: nach `normalize` + `categorize` einen `enrich`-Step einbauen
- [ ] Budget-Gate: max N Events pro Scrape-Run, Flag `--skip-enrichment`
- [ ] Filter: nur Events mit `enrichment_version IS NULL` oder `!= 'enrich-v2-prompt1'`
- [ ] Step-Runner in `src/lib/pipeline/step-runner.ts` anhängen

### Phase 4 — Rerun auf existierende Events
- [ ] `npm run enrich-openai` erneut auf alle 42k Events (wegen `ENRICHMENT_VERSION` bump)
- [ ] Kosten ~$40 geschätzt mit `gpt-5-mini`
- [ ] 3 Unicode-Fail-Events davor fixen (scrub `\u0000`)

### Phase 5 — Discovery-UI
- [ ] Landing/Map-Sidebar: Module `Heute in deiner Nähe`, `Ausgehen heute Abend`, `Studentenleben`, `Date Ideen`, `Gratis dieses Wochenende`, `Geheimtipps`
- [ ] Filter-UI: Multi-Axis (Category + Occasion + Price + Vibe)
- [ ] Event-Popup: neue Tag-Kategorien als separate Rows rendern (secondary_tags / audience / vibe / occasion)

### Phase 6 — Semantic-Search
- [ ] `src/scripts/build-embeddings.ts`: pro Event `title + description + tags joined` → `text-embedding-3-small`
- [ ] DB: pgvector extension, Spalte `embedding vector(1536)` auf `events`
- [ ] `src/app/api/search/semantic/route.ts`: Query → Embedding → Cosine-Top-50 + strukturierte Filter
- [ ] UI: prominentes „Was hast du vor?"-Suchfeld mit Natural-Language-Interpretation
- [ ] Kosten: ~$0.50 einmalig für alle Events + ~$0.0001 pro Query

---

## 7. AI-Prompt-Richtlinien (für enrich-openai.ts neues prompt1)

Der Prompt MUSS enthalten:

1. **Die 11 Kategorien mit je 1 Satz was reingehört + was NICHT reingehört** (siehe §2)
2. **Geschlossene Vokabularien** pro Achse (alle audience/vibe/occasion/format values enumeriert)
3. **5–6 handgepickte Few-Shot-Beispiele** die harte Edge-Cases zeigen:
   - Tamburicaabend → Musik (nicht Sport trotz „Sportplatz")
   - Pub Quiz im Studentenclub → Community & Freizeit + Tags studenten + ausgehen + quiz
   - Weinwanderung → Natur & Abenteuer + Tag verkostung + date-night
   - Adventmarkt mit Live-Band → Märkte & Feste (nicht Musik)
   - Rave im Wald → Nightlife & Party + open-air + psytrance-rave + underground
   - Yoga-Retreat am Wochenende → Wellness & Spiritualität (nicht Sport trotz Yoga)
4. **Priorität**: wenn ein Event zu mehreren Kategorien passt, nimm die **primäre Absicht** (was würde auf einem Flyer groß stehen?)
5. **Boolean-Flags-Strenge**: `is_student_friendly=true` nur wenn explizite Evidenz (Studentenrabatt erwähnt, Uni-Location, ESN/ÖH als Veranstalter). Im Zweifel FALSE.
6. **Defaults**: wenn `price_tier` nicht ableitbar, **nicht `unbekannt`** sondern **`gratis`** (viele AT-Events sind frei, Heuriger/Dorffest/Gottesdienst).

---

## 8. Discovery-UI-Module (Phase 5 Referenz)

Fixed-Curated + Dynamic gemixt:

| Modul | Query |
|---|---|
| **Heute in deiner Nähe** | `start_date = today AND bbox(user ± 15km)` |
| **Ausgehen heute Abend** | `start_date = today AND occasion CONTAINS 'ausgehen' AND (start_hour >= 18 OR late-night)` |
| **Studentenleben** | `audience CONTAINS 'studenten' OR is_student_friendly=true` |
| **Date Ideen** | `occasion CONTAINS 'date-night' OR vibe CONTAINS 'romantisch'` |
| **Gratis dieses Wochenende** | `price_tier='gratis' AND start_date in (Sa, So)` |
| **Geheimtipps** | `vibe CONTAINS 'lokal-insider' OR 'underground'` |
| **Für Familien** | `is_family_friendly=true OR category='Familie & Kinder'` |
| **Afterwork** | `occasion CONTAINS 'afterwork'` |
| **Lokale Highlights** | `vibe CONTAINS 'lokal' AND event_score >= 70` |
| **Kreativ heute** | `vibe CONTAINS 'kreativ' AND start_date = today` |

---

## 9. Semantic-Search (Phase 6 Referenz)

### Sehr-konkretes User-Scenario

_„Ich bin Student und will heute abend billig saufen gehen"_

**Query-Pipeline:**
1. Embedding der Query → vector `[0.12, -0.45, ...]`
2. Strukturierte Filter aus der Query mit Regex/NLU:
   - `student` → `audience CONTAINS 'studenten'` OR `is_student_friendly=true`
   - `heute abend` → `start_date = today AND start_hour >= 18`
   - `billig` → `price_tier IN ('gratis','günstig')` OR `price_flags CONTAINS 'happy-hour'`
   - `saufen` → keine struktur, geht in embedding
3. Cosine-Similarity zwischen Query-Embedding und allen gefilterten Events
4. Top-20 → UI mit Begründung („passt weil: Happy Hour, Late Night, Student Night")

**Warum nicht nur Embedding?** Strukturierte Filter (Zeit, Preis) sind harte Constraints, Embeddings sind soft. „Heute Abend" darf nicht als _ähnlich zu_ „Morgen Abend" matchen.

---

## 10. Was NICHT in dieser Taxonomie lebt

- **Ort/Bundesland/Stadt** → eigene DB-Felder, nicht als Tag
- **Zeit (today, wochenende)** → `start_date`-Query-Filter
- **Entfernung (< 5km)** → Geometrie-Query auf `latitude`/`longitude`
- **Saved/Favorited** → User-Bezug, separates Feature
- **Quality Score, event_score** → ein Ranking-Signal, keine Klassifikation

---

## Referenzen

- Enrichment-Script: `src/scripts/enrich-openai.ts`
- Aktuelle (alte) Taxonomy: `src/lib/category-classifier/taxonomy.ts`
- Enrichment-Vokabular: `src/lib/category-classifier/enrichment-taxonomy.ts`
- Event-Type: `src/types/events.ts`
- UI-TagChip-Farben: `src/components/UI/TagChip.tsx`
