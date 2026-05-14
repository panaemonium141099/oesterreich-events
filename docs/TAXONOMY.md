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

<!-- AUTO-GENERATED from src/lib/category-classifier/enrichment-taxonomy.ts. Do not edit by hand — run `tsx src/scripts/regen-taxonomy-doc.ts` to regenerate. -->

Jedes Event bekommt:

- 1 `primary_category` aus der Liste in §2 (eine von 11 + Fallback `Sonstiges`)
- 0–5 `secondary_tags` (Aktivitäts-Tags, Genre-Tags) aus §3.6
- 0–3 `vibe_tags` aus §3.2
- 0–3 `audience_tags` aus §3.1
- 0–3 `occasion_tags` aus §3.3
- beliebig viele `setting`-Tags (§3.5) und `price_flags` (§3.4)
- 1 `price_tier` aus §3.4 + 1 `duration_type` aus §3.5 + 1 `language` aus §3.7

Jeder Wert in den unten stehenden Listen ist gleichzeitig ein erlaubter
Output-Wert für den AI-Validator (`validateEnrichment` in
`src/lib/category-classifier/enrichment-taxonomy.ts`). Werte außerhalb
dieser Listen werden silent gedroppt.

### 3.1 Audience-Tags (Zielgruppe)

Wer fühlt sich angesprochen? (`audience` array, 0–3 Werte)

```
studenten
junge-erwachsene
erasmus-freundlich
familien-mit-kleinkindern
familien-mit-kindern
familien-mit-teens
kinder-allein
erwachsene-allgemein
senioren
singles
paare
fuer-gruppen
alleine-geeignet
queer-friendly
english-speaking
anfängerfreundlich
touristenfreundlich
lokal-insider
traditionell
```

### 3.2 Vibe-Tags (Stimmung)

Wie fühlt sich das Event an? (`vibe` array, 0–3 Werte)

```
entspannt
laut
elegant
kreativ
abenteuerlich
romantisch
gemütlich
wild
exklusiv
alternativ
mainstream
lokal
kultig
trashig
underground
fancy
authentisch
zum-kennenlernen
touristen-frei
kulturell
spirituell
intellektuell
festlich
edgy
kindergerecht
euphoric
psychedelic
dark
industrial
hypnotic
```

### 3.3 Occasion-Tags (Anlass)

Wofür ist das Event "gut"? (`occasion_tags` array, 0–3 Werte)

```
ausgehen
afterwork
date-night
erstes-date
wochenendplan
feierabend
tagesausflug
regentag
geburtstagsidee
teamevent
spontan
kurzfristig-heute
fuer-den-abend
saufen-gehen
kennenlernen
networking-anlass
```

### 3.4 Price-Tier + Price-Flags

Genau **ein** `price_tier`:

```
gratis
günstig
mittel
premium
unbekannt
```

Bedeutung: `gratis`=0€ · `günstig`=bis 15€ · `mittel`=15–50€ ·
`premium`=über 50€ · `unbekannt`=nicht ableitbar (selten — siehe Default-Regel im Prompt).

Beliebig viele `price_flags`:

```
freier-eintritt
happy-hour
getraenke-special
studentenrabatt
damenrabatt
mit-anmeldung
ohne-anmeldung
barrierefrei
kinderwagengeeignet
fuer-anfaenger
unter-20-euro
spende-erbeten
abendkasse
```

### 3.5 Setting / Format / Zeit-Tags

Format und Ort des Events. (`setting` array, 0–3 Werte)

```
indoor
outdoor
hybrid
online
am-see
in-den-bergen
städtisch
dörflich
kirche
festival-gelände
bar-club
konzertsaal
arena
park
spielplatz
museum
schloss
warehouse
underground-location
industrial-venue
open-air-location
forest
strand
rave-cave
techno-club
nightclub
open-air
tagesevent
abendevent
ganztägig
kurzformat
late-night
mehrtägig
saisonal
wiederkehrend
```

Genau **ein** `duration_type`:

```
kurz
abend
ganztag
mehrtägig
dauerausstellung
nacht-bis-morgen
24-stunden
48-stunden
```

Bedeutung: `kurz`<2h · `abend`=2–5h · `ganztag` · `mehrtägig` ·
`dauerausstellung` · `nacht-bis-morgen`=22h–6h · `24-stunden` · `48-stunden`.

### 3.6 Activity-Tags (`tags` Array, 0–5 Werte)

Konkrete Aktivitäts-/Genre-Labels. Wichtigste Achse für Embedding-Matching.

```
klassik
oper
operette
ballett
kammermusik
chor
orgel
jazz
bigband
swing
pop
rock
indie
alternative
metal
punk
grunge
ska
reggae
hip-hop
rap
r-n-b
soul
funk
disco
schlager
country
folk
singer-songwriter
latin
balkan
weltmusik
volksmusik
blasmusik
heurigenmusik
alpine-musik
austro-pop
dialekt-rap
tamburica
techno
house
trance
dnb
dubstep
hardstyle
hardcore
breakbeat
bass-music
ambient-chill
electro
disco-electronic
minimal-techno
melodic-techno
hardtechno
schranz
industrial-techno
detroit-techno
deep-techno
acid-techno
dub-techno
deep-house
tech-house
progressive-house
afro-house
melodic-house
acid-house
disco-house
future-house
afro-tech
chicago-house
uk-house
minimal-house
psytrance
goa
progressive-trance
uplifting-trance
hard-trance
vocal-trance
dark-psytrance
forest-psytrance
full-on
drum-and-bass
liquid-dnb
neurofunk
jungle
jump-up
dnb-rollers
dancefloor-dnb
deep-dnb
minimal-dnb
riddim
brostep
future-bass
trap-edm
uk-garage
2-step
speed-garage
bassline
grime
rawstyle
gabber
uk-hardcore
uptempo
frenchcore
terror
speedcore
happy-hardcore
nu-disco
italo-disco
synthwave
vaporwave
electroclash
electroswing
idm
leftfield
live-konzert
dj-set
live-band
acoustic-session
jam-session
karaoke
open-mic
poetry-slam
outdoor-festival
indoor-festival
multi-stage-festival
club-night
rave
open-air-rave
afterhour
warehouse-party
free-party
tekno-party
boiler-room
silent-disco
boat-party
rooftop-party
daytime-rave
24h-rave
underground-party
afterparty
bar-night
happy-hour
cocktail-night
shot-night
student-night
ladies-night
open-bar
pub-crawl
tanznacht
motto-party
80s-party
90s-party
2000er-party
latino-night
afro-night
erasmus-night
halloween-party
fasching-party
silvester-party
schlager-party
retro-party
theater
kabarett
lesung
musical
ausstellung
vortrag
film
kino
performance-art
improtheater
comedy
stand-up
stadtführung
burgführung
museumstour
wandern
laufen
radfahren
mountainbike
ski
langlauf
snowboard
schwimmen
klettern
bouldern
yoga
pilates
fitness
crossfit
hiit
turnier
fussball
eishockey
tennis
reiten
wassersport
marathon
halbmarathon
tanzkurs
salsa-night
zumba
naturführung
vogelbeobachtung
geführte-wanderung
astronomie
ökologie-event
kräuterwanderung
pilzwanderung
rafting
kanutour
kajak
segel-tour
klettertour
bergtour
alpen-tour
escape-room
christkindlmarkt
ostermarkt
adventmarkt
flohmarkt
bauernmarkt
wochenmarkt
kunsthandwerk
designmarkt
antikmarkt
dorffest
stadtfest
kirtag
pfarrfest
schützenfest
feuerwehrfest
heurigenfest
maibaumfest
sonnwendfeier
dämmerschoppen
frühschoppen
tracht
perchten
perchtenlauf
krampuslauf
erntedank
fasching
ball
almabtrieb
weinverkostung
bier-verkostung
cocktail-tasting
gin-tasting
whiskey-tasting
heuriger
buschenschank
weinfest
biermesse
kulinarik-tour
genussmesse
street-food
food-truck
brunch
dinner
fine-dining
kochkurs
barbecue
grillen
seminar
workshop
kurs
sprachkurs
lecture
messe
konferenz
networking
startup-pitch
tech-meetup
branchentreff
career-fair
gründer-event
campus-info
pub-quiz
brettspielabend
game-night
lan-party
speed-dating
single-night
stammtisch
vereinstreffen
community-meetup
hobby-gruppe
nachbarschaftsevent
comedy-abend
kinder-workshop
puppentheater
familien-picknick
kinderkino
spielfest
ferienprogramm
geburtstag
kindertheater
kinderfest
meditation
breathwork
achtsamkeit
sound-healing
retreat
wellness-day
sauna-special
thermen-special
yoga-retreat
gottesdienst
wallfahrt
prozession
andacht
pilgern
gesundheitsmesse
selbsthilfegruppe
```

### 3.7 Language

Genau **ein** `language`:

```
deutsch
dialekt
englisch
mehrsprachig
ohne-sprache
```

### 3.8 Primary Category (referenz, siehe §2 für Beschreibung)

Genau **eine** `primary_category` (case-sensitive):

```
Musik
Kultur & Bühne
Nightlife & Party
Essen & Trinken
Märkte & Feste
Sport & Bewegung
Natur & Abenteuer
Wissen & Karriere
Familie & Kinder
Community & Freizeit
Wellness & Spiritualität
Sonstiges
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
