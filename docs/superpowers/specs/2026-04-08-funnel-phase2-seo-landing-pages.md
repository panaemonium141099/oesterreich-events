# Funnel Phase 2: Lokale SEO-Landingpages

## Goal & Context

Intent-basierte Einstiegspunkte fur organischen Traffic schaffen. Nutzer, die nach "events wien heute", "konzerte graz wochenende" oder "nightlife innsbruck" suchen, sollen auf dedizierten Landingpages mit sofort sichtbaren Top-Events landen — nicht auf einer generischen Map.

**Referenz:** Bericht 2 — Abschnitt 10, Phase 2 + Abschnitte 4 (Funnel 1: Lokaler SEO-Funnel), 8 (Landingpage-System)

**Approach:** Zwei Geografie-Ebenen — Bundesland-Seiten fur breite Abdeckung + Stadt-Seiten fur die grossten Stadte mit echtem Suchvolumen. Kategorie- und Zeitkontext-Filter auf beiden Ebenen.

---

## 1. Geografie-Ebenen

### 1.1 Warum zwei Ebenen

Bundesland-Seiten allein treffen den lokalen Suchintent nur teilweise. "Events Graz" meint nicht "Events Steiermark" — Graz verschwindet unter dem Bundesland-Dach. Die Plattform hat genug Daten fur echte Stadt-Seiten bei den grossten Stadten:

| Stadt | Events (aktuell) | Bundesland |
|---|---|---|
| Wien | 320 | Wien |
| Innsbruck | 127 | Tirol |
| Graz | 33 | Steiermark |
| Salzburg (Stadt) | 30+ | Salzburg |
| Linz | ~15 | Oberoesterreich |
| Klagenfurt | ~10 | Karnten |

**Regel:** Stadt-Seiten nur fur Stadte mit >= 20 Events (aktuell: Wien, Innsbruck, Graz, Salzburg). Bei weniger Events ist eine eigene Seite dunn. Die Stadt-Liste ist konfigurierbar und wachst mit den Daten.

### 1.2 URL-Schema

```
# Bundesland-Ebene
/[bundesland]                         → Events in Steiermark
/[bundesland]/heute                   → Heute in Tirol
/[bundesland]/[category]              → Musik in Salzburg (Land)
/[bundesland]/[category]/heute        → Nightlife in Wien heute

# Stadt-Ebene (nur fur konfigurierte Stadte)
/stadt/[city]                         → Events in Graz
/stadt/[city]/heute                   → Events in Innsbruck heute
/stadt/[city]/wochenende              → Am Wochenende in Graz
/stadt/[city]/[category]              → Nightlife in Graz
/stadt/[city]/[category]/heute        → Musik in Innsbruck heute
```

Das `/stadt/`-Prefix vermeidet Konflikte mit Bundesland-Slugs und bestehenden Routes.

---

## 2. Routing-Konfiguration

### 2.1 Bundesland-Slugs (aus BUNDESLAENDER config)

| Slug | Anzeigename |
|---|---|
| `wien` | Wien |
| `burgenland` | Burgenland |
| `niederoesterreich` | Niederosterreich |
| `oberoesterreich` | Oberoesterreich |
| `salzburg` | Salzburg |
| `steiermark` | Steiermark |
| `kaernten` | Karnten |
| `tirol` | Tirol |
| `vorarlberg` | Vorarlberg |

### 2.2 Stadt-Slugs (konfigurierbar)

| Slug | Anzeigename | Bundesland | Filterlogik |
|---|---|---|---|
| `wien` | Wien | wien | bundesland = 'wien' |
| `graz` | Graz | steiermark | venue.city = 'Graz' OR address enthalt 'Graz' |
| `innsbruck` | Innsbruck | tirol | venue.city = 'Innsbruck' OR address enthalt 'Innsbruck' |
| `salzburg` | Salzburg | salzburg | venue.city = 'Salzburg' OR address enthalt 'Salzburg' |
| `linz` | Linz | oberoesterreich | venue.city = 'Linz' OR address enthalt 'Linz' |
| `klagenfurt` | Klagenfurt | kaernten | venue.city = 'Klagenfurt' OR address enthalt 'Klagenfurt' |

Wien ist Sonderfall: Bundesland und Stadt sind identisch. `/stadt/wien` wird **nicht generiert** — stattdessen ein **301 Redirect auf `/wien`** in der Stadt-Page-Komponente. Kein doppelter Content, kein Canonical-Workaround. `/wien` ist die einzige Wien-URL.

### 2.3 Kategorie-Slugs (neu)

| Slug | Anzeigename |
|---|---|
| `musik` | Musik |
| `kultur` | Kultur |
| `sport` | Sport |
| `feste` | Feste & Brauchtum |
| `maerkte` | Markte |
| `kulinarik` | Wein & Kulinarik |
| `familie` | Familie |
| `natur` | Natur |
| `nightlife` | Nightlife |
| `bildung` | Bildung |

### 2.4 Zeitkontext-Slugs

**Zeitzone: `Europe/Vienna` (CET/CEST)** — alle Zeitberechnungen (heute, wochenende) verwenden einheitlich die osterreichische Lokalzeit. Dies gilt fur Server-Queries, Client-Pagination und ISR-Revalidierung. Implementiert via `Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna' })` oder `date-fns-tz`.

| Slug | Filterlogik (in Europe/Vienna) |
|---|---|
| `heute` | `start_date >= today 00:00 CET` AND `start_date < tomorrow 00:00 CET` |
| `wochenende` | `start_date >= kommender Samstag 00:00 CET` AND `start_date < Montag 00:00 CET` (oder ab heute falls bereits Sa/So) |

`getDateRange()` in `landing-slugs.ts` gibt ISO-Strings mit korrektem Offset zuruck. Dieselbe Funktion wird sowohl serverseitig (Landingpage-Render) als auch im `LoadMoreEvents` Client-Component verwendet.

### 2.5 Route-Konflikte

- Bundesland-Slugs kollidieren nicht mit bestehenden Top-Level-Routes (`/map`, `/blog`, `/saved`, etc.)
- Stadt-Seiten laufen unter `/stadt/[city]` — kein Konflikt moglich
- Safeguard in jeder Page-Komponente: unbekannte Slugs → `notFound()`

---

## 3. Next.js Implementierung

### 3.1 Dateistruktur

```
src/app/[bundesland]/
  page.tsx                              → Bundesland-Landingpage
  [filter]/
    page.tsx                            → heute/wochenende ODER Kategorie
    [subfilter]/
      page.tsx                          → Kategorie + Zeitkontext

src/app/stadt/[city]/
  page.tsx                              → Stadt-Landingpage
  [filter]/
    page.tsx                            → heute/wochenende ODER Kategorie
    [subfilter]/
      page.tsx                          → Kategorie + Zeitkontext
```

### 3.2 `generateStaticParams()`

**Bundesland-Seiten:**
- 9 Bundesland-Seiten
- 9 * 12 (10 Kategorien + 2 Zeitkontext) = 108 Filterseiten
- 9 * 10 * 2 = 180 Kombiseiten
- **Gesamt Bundesland: ~297 Seiten**

**Stadt-Seiten:**
- 6 Stadt-Seiten (Wien canonical auf /wien, also effektiv 5)
- 5 * 12 = 60 Filterseiten
- 5 * 10 * 2 = 100 Kombiseiten
- **Gesamt Stadt: ~165 Seiten**

**Total: ~462 statische Seiten** (mit ISR, revalidate = 3600)

### 3.3 Daten-Laden: Server-Side Read Client

Landingpages sind offentliche Seiten. Das Laden passiert uber einen **Read-Only Supabase Client mit Anon Key** (nicht Service Role Key). Die Query braucht keine privilegierten Rechte — es werden nur published Events mit quality_score >= 40 geladen.

```ts
// Shared read-only client for landing pages
function getReadClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Die Events-Tabelle hat bereits RLS Policies die SELECT fur alle erlauben (published Events sind offentlich).

### 3.4 Ranking: Hybrid aus Zeitnahe + Score

Fur Zeitkontext-Seiten (`/heute`, `/wochenende`) reicht `event_score DESC` allein nicht — ein hoher globaler Score bedeutet nicht automatisch Relevanz fur den konkreten Zeitraum.

**Ranking-Logik:**

| Seitentyp | Sortierung |
|---|---|
| `/[bundesland]` (ohne Zeitkontext) | `event_score DESC` |
| `/[bundesland]/heute` | `start_date ASC` (chronologisch, fruhere Events zuerst) |
| `/[bundesland]/wochenende` | `event_score DESC` (beste Events am WE zuerst) |
| `/[bundesland]/[category]` | `event_score DESC` |
| `/[bundesland]/[category]/heute` | `start_date ASC` |

Begrundung: "Heute" impliziert zeitliche Dringlichkeit — was als nachstes anfangt ist relevanter als der Score. "Wochenende" ist Planungsmodus — Score-Ranking passt besser.

### 3.5 Pagination-Paritat

`LoadMoreEvents` (Client Component) nutzt die bestehende Events API (`/api/events`). Damit Pagination-Ergebnisse identisch mit den serverseitig geladenen Events sind, mussen die Filter exakt ubereinstimmen:

| Filter | Server-Query | Client-Pagination |
|---|---|---|
| bundesland | `.eq('bundesland', ...)` | `?bundesland=...` |
| category | `.eq('category', ...)` | `?category=...` |
| dateFrom | `.gte('start_date', ...)` | `?dateFrom=...` |
| dateTo | `.lt('start_date', ...)` | `?dateTo=...` |
| publish_status | `.eq('publish_status', 'published')` | **bereits im API-Default** |
| quality_score | `.gte('quality_score', 40)` | **muss in API erganzt werden** |
| sort | `event_score DESC` oder `start_date ASC` | `?sort=score` oder `?sort=date` |

**Notwendige API-Anderungen an `/api/events/route.ts`:**

1. **`?minQuality=N`** — neuer optionaler Parameter. Filtert `.gte('quality_score', N)`. Stellt Paritat zwischen Server-Query und Client-Pagination sicher.

2. **`?city=Graz`** — neuer optionaler Parameter. Echter deterministischer Stadtfilter:
   - Jointed auf `venues` Tabelle: `venues.city = ?city` via `venue_id`
   - Fur Events ohne `venue_id`: fallback auf `address ILIKE '%Graz%'`
   - Supabase Query: Events mit passender `venue_id` ODER passendem `address`
   - Kein clientseitiges Nachfiltern, kein Search-Workaround — Server und Pagination liefern exakt dieselben Ergebnisse

Implementierung des City-Filters:
```ts
if (filters.city) {
  // 1. Get venue IDs matching the city
  const { data: venues } = await supabase
    .from('venues')
    .select('id')
    .ilike('city', filters.city);
  const venueIds = (venues ?? []).map(v => v.id);

  // 2. Filter events: venue_id in venueIds OR address contains city
  if (venueIds.length > 0) {
    query = query.or(
      `venue_id.in.(${venueIds.join(',')}),address.ilike.%${filters.city}%`
    );
  } else {
    query = query.ilike('address', `%${filters.city}%`);
  }
}
```

| Filter | Server-Query | Client-Pagination |
|---|---|---|
| city | venue_id IN (...) OR address ILIKE | `?city=Graz` (identische Logik) |

---

## 4. Seitenaufbau (jede Landingpage)

### 4.1 Struktur

```
┌─────────────────────────────────────────┐
│ Breadcrumb: Home > Wien > Nightlife     │
├─────────────────────────────────────────┤
│ H1: "Nightlife in Wien"                │
│ Subheadline: "42 Veranstaltungen"       │
├─────────────────────────────────────────┤
│ Filterchips: heute | wochenende |       │
│   musik | kultur | nightlife | ...      │
├─────────────────────────────────────────┤
│ Top Events (8 Cards, Score-sortiert)    │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │Event1│ │Event2│ │Event3│ │Event4│    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
├─────────────────────────────────────────┤
│ [Mehr laden] — Client-Pagination        │
├─────────────────────────────────────────┤
│ Interne Links                           │
│ "Mehr in Wien: Musik | Kultur | ..."    │
│ "Stadte: Graz | Innsbruck | Salzburg"   │
│ "Regionen: Steiermark | Tirol | ..."    │
├─────────────────────────────────────────┤
│ JSON-LD structured data                 │
└─────────────────────────────────────────┘
```

### 4.2 Filterchips

Horizontal scrollbar, pill-style. Aktiver Filter hervorgehoben. Jeder Chip ist ein `<Link>` auf die entsprechende Landingpage (echte Navigation, kein JS-Filter).

### 4.3 Event Cards

Neue Komponente `EventListCard` — vereinfacht gegenuber der Map-EventCard:
- Bild (optional, mit Fallback), Titel, Datum, Uhrzeit, Ort, Kategorie-Badge
- Link auf `/events/[id]`
- Responsive: Mobile 1-spaltig, Desktop 2-spaltig

### 4.4 Interne Verlinkung

Jede Seite verlinkt auf:
- Andere Kategorien im gleichen Kontext (Bundesland oder Stadt)
- Heute/Wochenende im gleichen Kontext
- Andere Stadte (Graz, Innsbruck, Salzburg, ...)
- Andere Bundeslaender
- Zuruck zur Hauptseite

---

## 5. SEO-Elemente

### 5.1 Structured Data (JSON-LD)

Pro Landingpage ein `ItemList` mit den Top-Events (max 10):

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Nightlife in Wien",
  "numberOfItems": 42,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Event",
        "name": "...",
        "startDate": "...",
        "location": { "@type": "Place", "name": "..." }
      }
    }
  ]
}
```

### 5.2 Meta Tags

- `<title>`: "Events in Wien heute | LassTreffen.at"
- `<meta description>`: dynamisch generiert mit Eventanzahl + Kontext
- Canonical URL (Wien-Stadt canonical auf /wien, nicht /stadt/wien)
- Open Graph + Twitter Card

### 5.3 Sitemap-Erweiterung

Alle Landingpages in Chunk 0:
- Bundesland-Seiten: priority 0.8
- Stadt-Seiten: priority 0.8
- + Kategorie: priority 0.7
- + Zeitkontext: priority 0.7
- + Kategorie + Zeitkontext: priority 0.6

---

## 6. Komponenten

### 6.1 `LandingPageShell`

**Datei:** `src/components/Landing/LandingPageShell.tsx`

Server Component — gemeinsamer Wrapper fur Bundesland- und Stadt-Seiten:
- Breadcrumb
- H1 + Subheadline (Eventanzahl)
- Filterchips
- Event-Liste (Top Events, server-rendered)
- LoadMoreEvents (Client Component fur Pagination)
- Interne Links
- JSON-LD Script Tag

### 6.2 `EventListCard`

**Datei:** `src/components/Events/EventListCard.tsx`

Vereinfachte Event-Card fur Listing-Seiten. Server Component — kein Client-State.

### 6.3 `FilterChips`

**Datei:** `src/components/Landing/FilterChips.tsx`

Horizontal scrollbar, pill-style. Jeder Chip ein `<Link>`.

### 6.4 `InternalLinks`

**Datei:** `src/components/Landing/InternalLinks.tsx`

Interne Verlinkung am Ende. Gruppen: Kategorien, Stadte, Bundeslaender.

### 6.5 `LoadMoreEvents`

**Datei:** `src/components/Landing/LoadMoreEvents.tsx`

Client Component. Nutzt `/api/events` mit exakt denselben Filtern wie die Server-Query. Cursor-basierte Pagination.

---

## 7. Slug-Mapping Utility

**Neue Datei:** `src/lib/landing-slugs.ts`

Zentrale Konfiguration fur alle Slug-Mappings:

```ts
export const CATEGORY_SLUGS: Map<string, string>;    // slug → display name
export const LANDING_CITIES: LandingCity[];           // konfigurierbare Stadt-Liste
export const TIME_FILTERS: Set<string>;               // 'heute', 'wochenende'

export function isValidBundesland(slug: string): boolean;
export function getCategoryFromSlug(slug: string): string | null;
export function getCategorySlug(categoryName: string): string | null;  // reverse lookup
export function isTimeFilter(slug: string): boolean;
export function getDateRange(filter: 'heute' | 'wochenende'): { from: string; to: string };
export function isValidCity(slug: string): boolean;
export function getCityConfig(slug: string): LandingCity | null;

interface LandingCity {
  slug: string;           // 'graz'
  name: string;           // 'Graz'
  bundesland: string;     // 'steiermark'
  filterMode: 'bundesland' | 'city';  // wien → bundesland, graz → city
  minEvents: number;      // Schwellenwert
}
```

---

## 8. Anderungen an bestehenden Dateien

### 8.1 `src/app/api/events/route.ts`

Neuer optionaler Parameter `?minQuality=N` fur Quality-Gate in der Pagination. Stellt Paritat zwischen Server-Query und Client-Pagination sicher.

### 8.2 `src/app/sitemap.ts`

Landingpage-URLs zu Chunk 0 hinzufugen (Bundesland + Stadt + Kombinationen).

### 8.3 `src/components/Landing/RegionExplorer.tsx`

Link-Ziel andern: `/map?bundesland=...` → `/[bundesland]`.

---

## 9. Dateiubersicht

| Aktion | Datei |
|---|---|
| Neue Util | `src/lib/landing-slugs.ts` |
| Neue Seite | `src/app/[bundesland]/page.tsx` |
| Neue Seite | `src/app/[bundesland]/[filter]/page.tsx` |
| Neue Seite | `src/app/[bundesland]/[filter]/[subfilter]/page.tsx` |
| Neue Seite | `src/app/stadt/[city]/page.tsx` |
| Neue Seite | `src/app/stadt/[city]/[filter]/page.tsx` |
| Neue Seite | `src/app/stadt/[city]/[filter]/[subfilter]/page.tsx` |
| Neue Komponente | `src/components/Landing/LandingPageShell.tsx` |
| Neue Komponente | `src/components/Events/EventListCard.tsx` |
| Neue Komponente | `src/components/Landing/FilterChips.tsx` |
| Neue Komponente | `src/components/Landing/InternalLinks.tsx` |
| Neue Komponente | `src/components/Landing/LoadMoreEvents.tsx` |
| Editieren | `src/app/api/events/route.ts` — `?minQuality=` + `?city=` Parameter |
| Editieren | `src/app/sitemap.ts` — Landingpage-URLs |
| Editieren | `src/components/Landing/RegionExplorer.tsx` — Links |

---

## 10. Abgrenzung

**Nicht in Phase 2:**
- Keine Studenten-Seiten (`/studenten/[city]`) — Phase 3
- Keine Venue-Seiten — Phase 4
- Keine personalisierten Inhalte — nur offentliche, statische Seiten
- Keine Suche auf Landingpages — Filterchips reichen
- Stadt-Liste ist begrenzt auf Stadte mit >= 20 Events (erweiterbar)

---

## 11. Akzeptanzkriterien

- [ ] 9 Bundesland-Landingpages rendern mit H1, Events, Filterchips
- [ ] Stadt-Layer funktioniert fur Graz, Innsbruck, Salzburg (+ weitere mit >= 20 Events); Wien lauft kanonisch uber /wien, nicht uber /stadt/wien
- [ ] Kategorie-Unterseiten zeigen gefilterte Events
- [ ] Heute-Seiten sortieren chronologisch (`start_date ASC`)
- [ ] Wochenende-Seiten sortieren nach Score (`event_score DESC`)
- [ ] Events haben quality_score >= 40, publish_status = 'published'
- [ ] Jede Seite hat korrekte Meta Tags (title, description, OG, canonical)
- [ ] JSON-LD ItemList auf jeder Seite
- [ ] Filterchips navigieren zwischen Unterseiten (echte Links, kein JS)
- [ ] Interne Verlinkung: Kategorien, Stadte, Bundeslaender
- [ ] Client-Pagination (`LoadMoreEvents`) liefert identische Ergebnisse wie Server-Query
- [ ] Events API unterstutzt `?minQuality=` und `?city=` Parameter
- [ ] Stadt-Filter ist deterministisch (venue.city JOIN + address ILIKE, kein clientseitiges Nachfiltern)
- [ ] Alle Zeitberechnungen verwenden Europe/Vienna Zeitzone
- [ ] `getDateRange()` wird von Server und Client identisch genutzt
- [ ] Sitemap enthalt alle Landingpages
- [ ] RegionExplorer verlinkt auf /[bundesland]
- [ ] /stadt/wien redirected 301 auf /wien (wird nicht statisch generiert)
- [ ] Unbekannte Slugs → 404
- [ ] Bestehende Routes kollidieren nicht
- [ ] `npm run build` kompiliert fehlerfrei
- [ ] ISR mit revalidate=3600 konfiguriert
