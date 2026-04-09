# Funnel Phase 3: Studenten-Funnel

## Goal & Context

Hyperlokale Relevanz fur Studenten aufbauen. Studenten suchen nicht "osterreichische Events" — sie wollen heute Abend schnell was finden, Dinge in Campusnahe, gunstige/gratis Events, Nightlife, Pub Quiz, ESN-Partys. Der Studenten-Funnel gibt ihnen dedizierte Einstiegspunkte mit vorkonfigurierten Filtern.

**Referenz:** Bericht 2 — Abschnitt 10, Phase 3 + Abschnitt 4 (Funnel 2: Studenten-Funnel)

**Approach:** Studenten-Landingpages pro Uni-Stadt, Student Relevance Score pro Event, vorkonfigurierte Filter (gratis, heute Abend, Nightlife). Baut auf der Landing-Infrastruktur aus Phase 2 auf.

---

## 1. Datenlage (Stand April 2026)

| Datenpunkt | Wert |
|---|---|
| Student-Venues (is_student_relevant=true) | 82 |
| Events an Student-Venues (venue_id match) | **0** (Venue-Matching nicht verbunden) |
| Events mit studentischen Keywords im Titel | 366 |
| Nightlife-Events | 1.269 |
| Events mit explizitem Gratis-Preis (price_min=0 oder price_text gratis/kostenlos) | 8 |
| Events mit unbekanntem Preis (price_min=NULL, price_text=NULL) | 63.771 (99.6%) |
| Events mit bekanntem Preis < 10 EUR | 14 |

**Konsequenz:** Der `student_only=true` API-Filter liefert aktuell 0 Ergebnisse weil keine Events uber `venue_id` mit Student-Venues verknupft sind. Der Studenten-Funnel muss **komplett Score-basiert** laufen — uber Keywords, Kategorie und Zeitkontext, nicht uber Venue-Flags.

**Konsequenz Gratis:** Bei 99.6% unbekannten Preisen ist ein Gratis-Filter nur sinnvoll auf Events mit **explizit bekanntem Preis**. `price_min IS NULL` darf NICHT als "gratis" gewertet werden.

---

## 2. Routing

### 2.1 URL-Schema

```
/studenten                          → Studenten-Ubersicht (alle Uni-Stadte)
/studenten/[city]                   → Studenten-Events in Wien/Graz/etc.
/studenten/[city]/heute             → Heute fur Studenten in Wien
/studenten/[city]/wochenende        → Wochenende fur Studenten in Graz
/studenten/[city]/nightlife         → Nightlife fur Studenten in Innsbruck
/studenten/[city]/gratis            → Gratis Events fur Studenten
```

### 2.2 Studenten-Stadte

Nur Stadte die aktuell genugend studentisch relevante Events (Nightlife + Keyword-basiert) in der Stadt haben. Basierend auf der Datenlage:

| Slug | Stadt | Begrundung |
|---|---|---|
| `wien` | Wien | 320+ Events mit Venue-City, viele Nightlife |
| `graz` | Graz | 33+ Events, ESN-Szene |
| `innsbruck` | Innsbruck | 127+ Events, starke Uni-Szene |
| `salzburg` | Salzburg | 30+ Events |

**Nicht zum Launch:** Linz (~15 Events) und Klagenfurt (~10 Events) bleiben draussen bis mehr Daten verfugbar sind. Die Config ist erweiterbar.

### 2.3 Studenten-spezifische Filter

| Slug | Filterlogik |
|---|---|
| `gratis` | `price_min = 0` ODER `price_text ILIKE '%gratis%'` ODER `price_text ILIKE '%kostenlos%'` ODER `price_text ILIKE '%free%'` ODER `price_text ILIKE '%frei%'`. Events mit `price_min IS NULL` und ohne Gratis-Keyword werden **ausgeschlossen** — unbekannt ist nicht gratis. |
| `heute` | Zeitfilter (Europe/Vienna, wie Phase 2) |
| `wochenende` | Zeitfilter (Europe/Vienna, wie Phase 2) |
| `nightlife` | `category = 'Nightlife'` |
| `musik` | `category = 'Musik'` |
| `kultur` | `category = 'Kultur'` |

---

## 3. Student Relevance Score

### 3.1 Score-Logik

Studentische Relevanz wird **zur Query-Zeit serverseitig** in `student-data.ts` berechnet. Kein Hybrid-Ansatz, keine Mischung aus Venue-basiert und Score-basiert — ein einheitliches Scoring-System:

| Signal | Punkte | Logik |
|---|---|---|
| Titel enthalt studentische Keywords | +30 | "student", "uni ", "campus", "esn", "pub quiz", "oeh", "hochschul", "erasmus" |
| Kategorie Nightlife | +20 | Hauptsignal fur studentische Relevanz |
| Kategorie Bildung | +15 | Workshops, Vorlesungen, Seminare |
| Preis gratis oder < 10 EUR | +10 | Nur bei **bekanntem** Preis (price_min != NULL) |
| Wochentag Do/Fr/Sa | +10 | Typische Ausgehabende |
| Uhrzeit ab 20:00 | +5 | Abendveranstaltungen |
| Venue ist `is_student_relevant` | +10 | Falls venue_id-Matching irgendwann funktioniert |

**Schwelle:** Events mit Score < 15 werden nicht auf Studenten-Seiten angezeigt.

### 3.2 Scoring-Utility

**Neue Datei:** `src/lib/utils/student-score.ts`

```ts
/**
 * Computes student relevance score for an event (0-100).
 * Used serverseitig in student-data.ts for initial render
 * AND in the Events API via ?studentScore=true for pagination parity.
 */
export function computeStudentScore(event: {
  title: string;
  category: string | null;
  price_min: number | null;
  price_text: string | null;
  start_date: string;
  venue_id?: string | null;
}, venueStudentRelevant?: boolean): number
```

---

## 4. Datenlogik — einheitlicher Pfad

### 4.1 Architektur-Entscheidung: Ein Pfad fur Server und Pagination

Server-Render und Client-Pagination mussen **exakt denselben Feed** liefern. Dafur wird ein **neuer API-Parameter `?studentScore=true`** eingefuhrt.

**Problem: Cursor-Stabilitat bei berechnetem Score**

Cursor-basierte Pagination auf einem zur Laufzeit in JS berechneten Score ist nicht trivial stabil. Der Student Score existiert nicht als DB-Spalte — ein klassischer DB-Cursor (`WHERE id < :cursor ORDER BY event_score DESC`) funktioniert nicht, weil die Sortierung erst nach dem Berechnen feststeht.

**Losung: Offset-Pagination fur Studenten-Seiten.**

Die Datenmenge ist klein genug (max. einige hundert Events pro Stadt nach Score-Filter). Offset-Pagination ist hier vertretbar:

- Server ladt **alle** Kandidaten fur die Stadt/Filter-Kombination (typischerweise < 500)
- Berechnet `computeStudentScore()` fur jeden
- Filtert Score < 15
- Sortiert nach: `studentScore DESC`, dann `start_date ASC` (bei heute-Filter) oder `event_score DESC` (sonst), dann `id DESC` (Tiebreaker)
- Gibt die ersten 20 zuruck

Client-Pagination nutzt `?studentScore=true&offset=20&limit=20` — die API durchlauft dieselbe Logik (alle Kandidaten laden, scoren, filtern, sortieren, dann offset/limit anwenden).

Das ist bewusst **kein** Cursor-Ansatz. Fur die typischen Datenmengen (< 500 Kandidaten pro Stadt) ist das performant genug. Bei signifikantem Wachstum kann der Score als materialisierte DB-Spalte nachgezogen werden — das ist aber nicht Teil von Phase 3.

**Events API (`/api/events/route.ts`) Erweiterung:**

Wenn `?studentScore=true` gesetzt ist:
1. Lade **alle** Kandidaten mit den ublichen Filtern (city, category, dateFrom/dateTo, minQuality) — kein DB-Limit
2. Berechne `computeStudentScore()` fur jeden Kandidaten (serverseitig im API-Handler)
3. Filtere Events mit Score < 15
4. Sortiere (siehe Sortierlogik unten)
5. Wende Offset/Limit an (nicht Cursor)
6. Gib `X-Total-Count` im Header zuruck

Damit liefern Server-Query in `student-data.ts` und `LoadMoreEvents` via `/api/events?studentScore=true&city=Wien&offset=20` identische Ergebnisse.

### 4.2 Server-Seite: `student-data.ts`

`loadStudentPage()` ruft intern die **gleiche Query-Logik** auf wie die API:
- Nutzt `getReadClient()` (Anon Key, wie Phase 2)
- Ladt Kandidaten mit city + category + time Filter
- Wendet `computeStudentScore()` an
- Filtert Score < 15
- Sortiert und limitiert

Die Funktion ist ein **serverseitiger Aufruf** derselben Logik, kein separater Pfad.

### 4.3 Pagination: `LoadMoreEvents`

Nutzt `/api/events?studentScore=true&city=Wien&minQuality=40&offset=20&limit=20` — die API berechnet den Score, filtert und sortiert identisch, paginiert uber Offset.

**Paritatstabelle:**

| Filter | Server (`student-data.ts`) | Client (`/api/events`) |
|---|---|---|
| Stadt | `.eq('bundesland', ...) / city-filter` | `?city=Wien` oder `?bundesland=wien` |
| Kategorie | `.eq('category', ...)` | `?category=Nightlife` |
| Zeitfilter | `getDateRange()` | `?dateFrom=...&dateTo=...` |
| Quality Gate | `.gte('quality_score', 40)` | `?minQuality=40` |
| Student Score | `computeStudentScore()` >= 15 | `?studentScore=true` (Score >= 15) |
| Sortierung | siehe Sortierlogik | `?studentScore=true` (gleiche Logik) |
| Pagination | offset/limit | `?offset=20&limit=20` |
| Gratis | explizit price_min=0 oder Gratis-Keyword | `?freeOnly=true` |

### 4.5 Sortierlogik

Die Sortierung hangt vom Zeitkontext ab:

| Seitentyp | Primare Sortierung | Sekundare Sortierung | Tiebreaker |
|---|---|---|---|
| `/studenten/[city]` (default) | `studentScore DESC` | `event_score DESC` | `id DESC` |
| `/studenten/[city]/heute` | `studentScore DESC` | `start_date ASC` | `id DESC` |
| `/studenten/[city]/wochenende` | `studentScore DESC` | `event_score DESC` | `id DESC` |
| `/studenten/[city]/nightlife` | `studentScore DESC` | `event_score DESC` | `id DESC` |
| `/studenten/[city]/gratis` | `studentScore DESC` | `start_date ASC` | `id DESC` |

Begrundung fur `heute`: "Heute Abend schnell was finden" ist zeitkritisch — bei ahnlichem Student Score soll das fruehere Event oben stehen, nicht das mit hoherem globalen Score um 23:30. Fur `gratis` gilt dasselbe — wer gratis sucht, will wissen was als nachstes geht.

### 4.4 Gratis-Filter in API

**Neuer API-Parameter:** `?freeOnly=true`

Filterlogik:
```sql
(price_min = 0)
OR (price_text ILIKE '%gratis%')
OR (price_text ILIKE '%kostenlos%')
OR (price_text ILIKE '%free%')
OR (price_text ILIKE '%frei%')
OR (price_text ILIKE '%eintritt frei%')
```

Events mit `price_min IS NULL` und ohne Gratis-Keyword werden **nicht** eingeschlossen. Unbekannt != gratis.

---

## 5. Seitenaufbau

### 5.1 Studenten-Index (`/studenten`)

```
┌─────────────────────────────────────────┐
│ H1: "Events fur Studenten"              │
│ Subheadline: "Finde Events rund um      │
│   deine Uni"                            │
├─────────────────────────────────────────┤
│ Stadt-Kacheln:                          │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │ Wien │ │ Graz │ │Inns. │ │ Slzb │    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
├─────────────────────────────────────────┤
│ "Heute fur Studenten" — Top 4 Events    │
└─────────────────────────────────────────┘
```

### 5.2 Studenten-Stadt-Seite (`/studenten/[city]`)

Nutzt `LandingPageShell` aus Phase 2:

```
┌─────────────────────────────────────────┐
│ Home / Studenten / Wien                 │
├─────────────────────────────────────────┤
│ H1: "Events fur Studenten in Wien"      │
│ Subheadline: "87 Veranstaltungen"       │
├─────────────────────────────────────────┤
│ Filterchips: Alle | Heute | Wochenende  │
│   | Gratis | Nightlife | Musik | Kultur │
├─────────────────────────────────────────┤
│ Event-Liste (Student-Score sortiert)    │
├─────────────────────────────────────────┤
│ [Mehr laden]                            │
├─────────────────────────────────────────┤
│ Interne Links:                          │
│ "Andere Stadte: Graz | Innsbruck | ..." │
│ "Alle Events in Wien: /wien"            │
└─────────────────────────────────────────┘
```

---

## 6. Implementierung

### 6.1 Dateiubersicht

| Aktion | Datei |
|---|---|
| Neue Util | `src/lib/utils/student-score.ts` — `computeStudentScore()` |
| Neue Datei | `src/lib/student-data.ts` — `loadStudentPage()`, `loadStudentIndex()` |
| Erweiterung | `src/lib/landing-slugs.ts` — `STUDENT_CITIES`, `STUDENT_FILTERS` |
| Neue Seite | `src/app/studenten/page.tsx` — Index |
| Neue Seite | `src/app/studenten/[city]/page.tsx` — Stadt-Seite |
| Neue Seite | `src/app/studenten/[city]/[filter]/page.tsx` — Filter-Kombination |
| Neue Komponente | `src/components/Landing/StudentCityGrid.tsx` — Stadt-Kacheln |
| Editieren | `src/app/api/events/route.ts` — `?studentScore=true`, `?freeOnly=true` |
| Editieren | `src/app/sitemap.ts` — Studenten-URLs |

### 6.2 Student-Stadt-Config in `landing-slugs.ts`

```ts
export interface StudentCity {
  slug: string;
  name: string;
  bundesland: string;
}

export const STUDENT_CITIES: StudentCity[] = [
  { slug: 'wien', name: 'Wien', bundesland: 'wien' },
  { slug: 'graz', name: 'Graz', bundesland: 'steiermark' },
  { slug: 'innsbruck', name: 'Innsbruck', bundesland: 'tirol' },
  { slug: 'salzburg', name: 'Salzburg', bundesland: 'salzburg' },
];

export const STUDENT_FILTERS = new Set([
  'heute', 'wochenende', 'gratis', 'nightlife', 'musik', 'kultur',
]);
```

### 6.3 `student-data.ts`

Serverseitige Datenlogik — nutzt dieselbe Score-Funktion wie die API:

```ts
import { computeStudentScore } from '@/lib/utils/student-score';

export async function loadStudentPage(
  city: StudentCity,
  filter: string | null,
): Promise<LandingPageData> {
  // 1. Load candidates via read client (same filters as API)
  // 2. Apply computeStudentScore() to each
  // 3. Filter score < 15
  // 4. Sort by student score DESC
  // 5. Build LandingPageData (reuse from Phase 2)
}
```

---

## 7. Abgrenzung

**Nicht in Phase 3:**
- Kein Studenten-Modus-Toggle im User-Profil (Phase 5)
- Keine Campus-Proximity-Karte
- Keine Uni-spezifischen Seiten (`/uni/tu-wien`) — zu granular
- Keine Donnerstag/Freitag-Alerts (Phase 5, Trigger-System)
- Keine personalisierten Studenten-Feeds (Phase 5)
- Campus-Distanzlogik wird nicht implementiert — stadtbasierte Filterung reicht
- Linz und Klagenfurt werden nicht zum Launch aufgenommen (< 20 Events)

---

## 8. Akzeptanzkriterien

- [ ] `/studenten` Index-Seite zeigt 4 Uni-Stadt-Kacheln (Wien, Graz, Innsbruck, Salzburg)
- [ ] `/studenten/wien` zeigt studentisch relevante Events, sortiert nach Student Score
- [ ] `/studenten/graz/nightlife` filtert auf Nightlife in Graz
- [ ] `/studenten/wien/gratis` zeigt nur Events mit explizit bekanntem Gratis-Preis (nicht unknown)
- [ ] `/studenten/innsbruck/heute` zeigt heutige Events, sortiert nach studentScore DESC dann start_date ASC
- [ ] Student Score berucksichtigt: Keywords im Titel, Kategorie, Preis, Wochentag, Uhrzeit
- [ ] Events mit Student Score < 15 werden nicht angezeigt
- [ ] Server-Render und Client-Pagination liefern identische Ergebnisse (Offset-Pagination, nicht Cursor)
- [ ] Events API unterstutzt `?studentScore=true` (Scoring + Filter + Sortierung im API-Handler) und `?freeOnly=true`
- [ ] Studenten-Pagination nutzt Offset statt Cursor (Datenmenge < 500 pro Stadt)
- [ ] Gratis-Filter schliesst Events mit unbekanntem Preis aus
- [ ] Filterchips enthalten "Gratis" als zusatzlichen Filter
- [ ] Interne Verlinkung: andere Studenten-Stadte + regulare Stadt-Seiten
- [ ] Sitemap enthalt Studenten-URLs
- [ ] Breadcrumbs: Home / Studenten / [Stadt] / [Filter]
- [ ] Meta Tags + JSON-LD auf jeder Seite
- [ ] `npm run build` kompiliert fehlerfrei
- [ ] ISR mit revalidate=3600
