# v4 Redesign — Phase 2: Landing & Card-System

**Datum:** 2026-05-14
**Branch:** `claude/v4-phase-2-landing-cards` (stacked auf Phase 1)
**Status:** Design — awaiting user review
**Phasen-Kontext:** Phase 2/5 des v4-Redesigns. Voraussetzungen:
- PR #2 (Phase 1: Foundation + Nav) muss landen — Phase 2 importiert `V4Logo`-Token-Setup über die `--v4-*` CSS-Variablen
- PR #3 (Taxonomy: `abendkasse` zu PRICE_FLAGS) sollte landen damit `doorsale`-State organisch befüllt wird; Phase 2 funktioniert auch ohne (Fallback auf `unknown`)

Folge-Phasen (Event-Detail, Künstler/Entdecken, Plan-Wizard) bekommen je eigene Specs.

---

## 1. Goal & Context

Ersetze die aktuelle Landing (`src/app/page.tsx` mit `HeroSection` / `LandingStats` / `LandingSections` / `ParticleBackground` / `gradient-mesh`) durch das v4-Mockup-Layout: einen funnel-orientierten Hero (Künstler folgen / Events entdecken / Abend planen) plus zehn thematische Event-Sektionen, die kategorische Cards mit semantischen State-Badges zeigen.

Liefere parallel das Card-System (4 Shapes × 9 Badge-States), das ab hier von allen v4-Sektionen konsumiert wird und in späteren Phasen (Phase 4 Entdecken-Liste, Phase 5 Meine-Pläne) wiederverwendet wird.

### Driving Brief (aus chat2)

> *"Homepage should not market LassTreffen as a social network. Homepage should market: Find events, Follow artists, Get tickets, Plan your night. Design must reduce cognitive load and remove dead-social-app feeling."*

> *"Sektionen rein nach Event-Typ benannt, nicht nach Verkaufsstatus: Heute & Wochenende mixed feed, Konzerte diese Woche, Festivals & Line-ups. Abendkasse bleibt als Card-State im System (für Detail-Page + Mobile-Sticky-Bar), aber nirgends als Sektions-Überschrift. Ticket-Prominenz passiert subliminal über die Card-Badges in den kategorischen Sektionen."*

---

## 2. Out of Scope (explicit)

Diese Phase fasst **nicht** an:

- `src/components/Events/EventCard.tsx`, `EventDetail.tsx`, `EventDetailV2.tsx`, `EventList.tsx`, `EventListCard.tsx`, `EventSheet.tsx`, `EventPreviewCard.tsx`, `RelatedEvents.tsx`, `AfterSavePanel.tsx` — bleiben für `/entdecken`, `/map`-Markers, `/blog`, Auth-Routes erhalten
- `/entdecken` Seite (semantische Suche) — bleibt aktuell
- `/map` Seite — bleibt aktuell
- `/artists`, `/feed`, `/saved`, `/groups`, `/profile`, `/blog` — bleiben aktuell
- Event-Detail-Page → Phase 3
- Künstler-Tab-UI → Phase 4
- Plan-Wizard + Meine-Pläne → Phase 5
- Auth-Modals → kommen mit Phase 4
- Scraper, Enrichment-Pipeline, Geocoding, Artist-Matching-Engine — nicht berührt
- Mapbox-Komponenten — nicht berührt
- Bestehende v4-Nav (V4TopNav, V4TabBar, V4Logo, V4TopNavAuth aus Phase 1) — werden konsumiert, nicht modifiziert
- Notifications-System

Folgende Files werden in Phase 2 nicht mehr gemountet, bleiben aber als Datei stehen (Cleanup ist Phase-3+-Material — minimal-scope-Regel):

- `src/components/Landing/HeroSection.tsx`
- `src/components/Landing/LandingStats.tsx`
- `src/components/Landing/LandingSections.tsx`
- `src/components/Landing/WeeklyHighlights.tsx`
- `src/components/Landing/RegionExplorer.tsx`
- `src/components/Landing/PopularCategories.tsx`
- `src/components/Landing/ParticleBackground.tsx`
- `src/components/Landing/ScrollHint.tsx`
- `gradient-mesh` und `gradient-mesh-animated` CSS-Klassen in `globals.css`

---

## 3. Architecture & Data Flow

```
src/app/page.tsx (RSC)
├── (kein 'use client', kein useEffect, kein useState)
├── const ctx = await getLandingContext()            // ─┐
│     ├── savedEventIds (anon → Set())                │
│     ├── followedArtistIds (anon → Set())            │
│     └── matchArtistIds (anon → Set())               │
├── const data = await getLandingData(ctx)          //  │ alle parallel via Promise.all
│     ├── todayWeekend: Event[] mit derivedState     //  │
│     ├── concerts: Event[]                          //  │
│     ├── festivals: Festival[]                      //  │
│     ├── matches (authed only): Event[]             //  │
│     └── mapPreview: MapMarker[]                    // ─┘
└── return (
    <>
      <Hero funnelCards={...} />
      <ArtistTeaser />
      {ctx.signedIn ? <MatchesSection events={data.matches}/> : <AnonFollowTeaser/>}
      <WeekendSection events={data.todayWeekend}/>
      <ConcertsSection events={data.concerts}/>
      <FestivalsSection festivals={data.festivals}/>
      <MapPreview markers={data.mapPreview}/>
      <HowItWorks/>
    </>
  )
```

**Daten-Fetching:**
- KEIN neuer API-Route. Stattdessen: ein neuer Server-Helper `src/lib/v4/get-landing-data.ts` der direkt die existierenden Supabase-Query-Helfer aufruft (kein HTTP-Roundtrip).
- Pro Sektion eigene Query, parallel via `Promise.all`. Caching folgt der bestehenden `revalidate = 3600` Konvention.
- `getLandingContext()` liest Supabase-Session (anon = leere Sets) und lädt `saved_events` + `artist_follows` für den aktuellen User. Cookie-basiert, server-side.

**State-Derivation läuft Server-Side**: Events kommen aus der DB als rohe `Event`-Records, werden durch `deriveEventState(event, ctx)` zu `Event & { state: V4EventState }` angereichert, dann an die Cards übergeben. Cards sind dann nur noch dumme Renderers.

**RSC vs Client-Inseln:**
- Hero, Sektionen, Cards: alles RSC (kein Client-JS)
- Funnel-Cards im Hero: Client-Island für press-haptic + Klick (~500 B)
- Cards: kein Client-State; Hover-Effekte rein CSS

**Wichtig:** Phase 1 hat den `V4TopNav` global im Root-Layout. Phase 2 berührt das Root-Layout NICHT. `page.tsx` ist nur der Body unterhalb der Nav.

---

## 4. Component Contracts

Verzeichnis-Layout:

```
src/components/Events/v4/
├── V4Badge.tsx                    — atom, 9 states
├── V4CardV.tsx                    — vertical grid card (default shape)
├── V4CardH.tsx                    — horizontal list card
├── V4CardHero.tsx                 — full-bleed hero card (sektion-anführer)
├── V4FestivalCard.tsx             — compact festival card
├── V4FunnelCard.tsx               — landing-hero funnel card (3x)
└── index.ts                       — barrel
```

### 4.1 `V4Badge` (atom)

```ts
type V4BadgeKind =
  | 'ticket'    // sand   — "Tickets verfügbar"
  | 'match'     // gold   — "Du folgst diesem Artist"
  | 'lineup'    // gold   — "Artist im Line-up"
  | 'free'      // green  — "Eintritt frei"
  | 'doorsale'  // blue   — "Abendkasse"
  | 'inplan'    // green  — "In deinem Plan"
  | 'unknown'   // neutral — "Kein Ticket bekannt"
  | 'soldout'   // red    — "Ausverkauft"
  | 'today';    // blue   — "Heute"

interface V4BadgeProps {
  kind: V4BadgeKind;
  children: React.ReactNode;
}
```

Inline Lucide-style SVG icon + label. Pill shape. Uses `--v4-*` tokens.

### 4.2 `V4CardV` (vertical grid card)

```ts
interface V4CardVProps {
  event: Event & { state: V4EventState };
  priority?: boolean;          // for LCP image (first hero only)
  size?: 'md' | 'lg';          // default 'md'; 'lg' uses bigger image ratio
}
```

Layout: image top (16:9), badge overlay top-right, body below (date eyebrow · title · location). One Badge maximum per card (the derived state's primary badge). Tags ignored at this size to keep cards clean.

### 4.3 `V4CardH` (horizontal list card)

```ts
interface V4CardHProps {
  event: Event & { state: V4EventState };
}
```

Layout: 80×80 image left, content right (eyebrow date · title · location + badge inline). Used in `MatchesSection` (logged-in) and potentially `/saved`/`/plans` in future phases.

### 4.4 `V4CardHero` (full-bleed sektions-hero)

```ts
interface V4CardHeroProps {
  event: Event & { state: V4EventState };
  height?: number;             // default 380 desktop / 320 mobile
  priority?: boolean;
}
```

Used as the visual anchor of `WeekendSection`. Full-width image, gradient overlay, large title + sublines + CTA button. Badge floats top-left over the image.

### 4.5 `V4FestivalCard` (compact festival)

```ts
interface V4FestivalCardProps {
  festival: Festival;
  lineupMatch?: boolean;       // gold accent if user follows lineup artist
}
```

Layout: small image header, festival name, date range, ein Headliner-Name oder "+3 deiner Künstler" wenn `lineupMatch=true`.

### 4.6 `V4FunnelCard` (Hero-Funnel)

```ts
interface V4FunnelCardProps {
  ordinal: string;             // "01", "02", "03"
  icon: 'music' | 'map' | 'ticket';
  title: string;
  sub: string;
  cta: string;
  href: string;
  accent: 'match' | 'ticket' | 'go';  // gold / sand / green
  primary?: boolean;           // top card gets extra elevation
  trackId?: string;            // data-track attribute for analytics later
}
```

Press-haptic Click. Visual-only (link to internal route).

---

## 5. State Derivation

### 5.1 Type

```ts
// src/lib/v4/derive-event-state.ts
export type V4EventState =
  | 'soldout'
  | 'inplan'
  | 'match'
  | 'lineup'
  | 'ticket'
  | 'free'
  | 'doorsale'
  | 'unknown';

interface DeriveCtx {
  savedEventIds: Set<string>;
  followedArtistIds: Set<string>;
  // mapped per-event server-side via JOIN/sub-query:
  artistMatchEventIds: Set<string>;        // event_id → user has follow on artist_events.artist_id
  lineupMatchEventIds: Set<string>;        // event_id → festival_id has festival_artists.artist_id in followedArtistIds
}

export function deriveEventState(event: Event, ctx: DeriveCtx): V4EventState {
  // Priority order — first match wins.
  if (event.publish_status === 'expired') return 'unknown';      // safety
  // 1. soldout — currently not derivable from existing fields; reserved for future
  //    when Eventim API or `availability` enrichment flag arrives.
  //    if (event.price_flags?.includes('ausverkauft')) return 'soldout';
  if (ctx.savedEventIds.has(event.id))     return 'inplan';
  if (ctx.artistMatchEventIds.has(event.id)) return 'match';
  if (ctx.lineupMatchEventIds.has(event.id)) return 'lineup';
  if (event.ticket_url &&
      event.price_tier && ['günstig', 'mittel', 'premium'].includes(event.price_tier))
                                            return 'ticket';
  if (event.price_tier === 'gratis' ||
      event.price_flags?.includes('freier-eintritt') ||
      event.price_flags?.includes('spende-erbeten'))
                                            return 'free';
  if (event.price_flags?.includes('abendkasse'))
                                            return 'doorsale';
  return 'unknown';
}
```

### 5.2 Context Loading

```ts
// src/lib/v4/get-landing-context.ts
export async function getLandingContext(): Promise<DeriveCtx & { signedIn: boolean }>;
```

- Reads supabase session (server-side, cookie-based via `@supabase/ssr`).
- For authed: query `saved_events.event_id WHERE user_id = ?`, `artist_follows.artist_id WHERE user_id = ?`. From those, JOIN `artist_events` and `festival_artists` to build `artistMatchEventIds` and `lineupMatchEventIds` (restricted to events in the upcoming-window the Landing shows — ~30 days forward).
- For anon: returns empty sets, `signedIn: false`.

### 5.3 Soldout Status (deferred)

`soldout` is reserved in the type and visually defined in `V4Badge`, but **not derivable** in Phase 2 from current data. The priority slot in `deriveEventState` stays commented as a placeholder. When a future enrichment adds an `ausverkauft` flag to `price_flags` or an Eventim availability source is connected, the comment becomes the active check.

---

## 6. Landing Sections (detailed)

### 6.1 Hero

```
┌──────────────────────────────┬──────────────────────────┐
│ Badge: "Events in Österreich" │ ┌────────────────────┐  │
│                              │ │ 01 Lieblingskünstler│ │
│ Headline: "Finde Events,     │ │    folgen          │ │
│   die wirklich zu dir passen"│ │ → "Künstler suchen"│ │
│ Sub: "Folge deinen           │ └────────────────────┘  │
│   Lieblingskünstlern …"      │ ┌────────────────────┐  │
│                              │ │ 02 Events entdecken│ │
│ [Künstler suchen] [Heute &   │ └────────────────────┘  │
│   Wochenende]                │ ┌────────────────────┐  │
│                              │ │ 03 Abend planen    │ │
│ Search (Künstler/Events tabs)│ └────────────────────┘  │
│ Trend chips                  │                          │
└──────────────────────────────┴──────────────────────────┘
```

- Left col: badge eyebrow → H1 (Inter+Fraunces italic for "wirklich zu dir passen") → sub → 2 CTAs → search affordance (visuell, klick → `/entdecken` Phase 2; echtes Modal kommt Phase 3/4) → trend chips
- Right col: 3 V4FunnelCard stacked
- Mobile: single column, funnel cards under hero text

**Where the search submits:** Phase 2 = klick auf Search affordance routet zu `/entdecken` (Bestand bleibt). Trend chips routen zu `/entdecken?q={chip}`. Künstler-Suche-Tab routet zu `/artists?q={query}`.

### 6.2 Artist Teaser

Standalone section between Hero and content sections. Promo card with 3 sample popular artists fetched server-side via `getLandingData()`. Source: `artists` table joined with `artist_follows` ordered by `count(user_id) DESC` (most-followed-on-the-platform) limited to 3. Falls keine `artist_follows`-Daten existieren (frühe Plattform-Phase), Fallback auf eine hartkodierte Liste `['Bilderbuch', 'Wanda', 'Pizzera & Jaus']`. Click auf der Card → `/artists?artist={name}`. **Kein Follow-Button hier** (das ist Phase 4 auf der /artists-Seite).

### 6.3 Logged-in: `MatchesSection` / Anon: `AnonFollowTeaser`

Conditionally rendered based on `ctx.signedIn`.

**MatchesSection (authed):** Eyebrow "Deine Lieblingskünstler · spielen demnächst", H2 "Auftritte deiner Lieblingskünstler", list of `V4CardH` for events where `state in ['match', 'lineup']`. If `events.length === 0`: empty state ("Noch keine Auftritte gefunden — folge weiteren Künstlern.").

**AnonFollowTeaser (anon):** Dashed-border CTA card prompting to login and follow artists. Link → `/auth/login?next=/artists`.

### 6.4 `WeekendSection`

- Eyebrow: dynamic date range "Sa DD. – So DD. {Monat}"
- H2: "Heute & Wochenende"
- V4CardHero (height 380 desktop / 320 mobile) for the top-scored event in the next 7 days (with `priority` for LCP)
- 6 V4CardV in 2 rows of 3 below for next-best events (mixed states — `mixedStates: true` heißt: organisch was die DB hergibt)

Data: `eventQueries.byDateRange({ from: today, to: today+7 }).orderBy('event_score', 'desc').limit(7)`.

### 6.5 `ConcertsSection`

- Eyebrow: "Live in Österreich"
- H2: "Konzerte diese Woche"
- 3 V4CardV
- Data: same as WeekendSection but filter `category = 'music' OR primary_category = 'konzerte'`, limit 3.

### 6.6 `FestivalsSection`

- Eyebrow: "Sommer · Line-ups verfügbar"
- H2: "Festivals mit Line-up"
- 4 V4FestivalCard (Desktop 4-col / Mobile 2-col)
- Data: `festivals` table, `WHERE end_date >= today`, ordered by `start_date`, limit 4.

### 6.7 `MapPreview`

- Eyebrow "Karte"
- H2 "Events in deiner Nähe"
- Stylized SVG map with sample markers (same SVG as Mockup, deterministic dots — keine echte Mapbox-Integration, das wäre Bundle-Bloat). Link → `/map`.
- Render exactly like the mockup's `_MapPreview` function. Static; no live data.

### 6.8 `HowItWorks`

- Eyebrow "So geht's"
- H2 "In drei Schritten unterwegs"
- 3 step cards (Künstler folgen · Tickets sichern · Abend planen) — static copy from mockup
- Hairline-bordered 1-column-on-mobile / 3-column-on-desktop grid

### 6.9 No more

- Old Stats badge ("X.000 Events in Österreich") → ersetzt durch Hero-Eyebrow + Trend-Chips. Wenn der User es vermisst, kommt's als kleinen Trust-Indikator in Phase 2.1 zurück.
- Old "Karte zeigen" Link mit Erklärung → ersetzt durch `MapPreview`-Sektion-CTA.

---

## 7. Files Added / Modified / Untouched

### 7.1 Added

**Cards (RSC-safe, kein 'use client'):**
- `src/components/Events/v4/V4Badge.tsx` — ~80 LOC
- `src/components/Events/v4/V4CardV.tsx` — ~120 LOC
- `src/components/Events/v4/V4CardH.tsx` — ~100 LOC
- `src/components/Events/v4/V4CardHero.tsx` — ~150 LOC
- `src/components/Events/v4/V4FestivalCard.tsx` — ~90 LOC
- `src/components/Events/v4/V4FunnelCard.tsx` — ~80 LOC (kann Client für press-haptic)
- `src/components/Events/v4/index.ts` — barrel

**Landing Sections (alle RSC, in own files for review separation):**
- `src/components/Landing/v4/HeroV4.tsx`
- `src/components/Landing/v4/ArtistTeaserV4.tsx`
- `src/components/Landing/v4/MatchesSection.tsx`
- `src/components/Landing/v4/AnonFollowTeaser.tsx`
- `src/components/Landing/v4/WeekendSection.tsx`
- `src/components/Landing/v4/ConcertsSection.tsx`
- `src/components/Landing/v4/FestivalsSection.tsx`
- `src/components/Landing/v4/MapPreview.tsx`
- `src/components/Landing/v4/HowItWorks.tsx`
- `src/components/Landing/v4/index.ts` — barrel

**Server helpers:**
- `src/lib/v4/derive-event-state.ts` — type + deriveEventState
- `src/lib/v4/get-landing-context.ts` — getLandingContext (reads session)
- `src/lib/v4/get-landing-data.ts` — getLandingData (parallel queries)

**Tests:**
- `src/__tests__/lib/v4/derive-event-state.test.ts` — ~15 specs
- `src/__tests__/components/events/v4/V4Badge.test.tsx` — ~10 specs (1 per kind)
- `src/__tests__/components/events/v4/V4CardV.test.tsx` — ~5 specs
- `src/__tests__/components/events/v4/V4CardH.test.tsx` — ~3 specs
- `src/__tests__/components/events/v4/V4CardHero.test.tsx` — ~3 specs
- `src/__tests__/components/events/v4/V4FestivalCard.test.tsx` — ~3 specs
- `src/__tests__/components/events/v4/V4FunnelCard.test.tsx` — ~3 specs
- `src/__tests__/components/landing/v4/landing-smoke.test.tsx` — ~2 integration tests

### 7.2 Modified

- `src/app/page.tsx` — **kompletter Rewrite** (siehe §3). Beta-Hinweis-Banner, `Onboarding`-Overlay, `AuthErrorToast` bleiben drin. Alles andere wird ersetzt.

### 7.3 Untouched

- Alles unter `src/components/Events/` außer dem neuen `v4/`-Unterordner
- Alle anderen Routes (`/entdecken`, `/map`, `/artists`, `/feed`, `/saved`, `/groups`, `/profile`, `/blog`, `/auth/*`)
- `src/app/layout.tsx` — Phase 1 hat bereits global gemountet, kein Bedarf hier
- `src/components/Layout/v4/*` — Phase-1-Komponenten
- `globals.css` — keine neuen Tokens; v4-Tokens aus Phase 1 reichen
- Scraper / Enrichment / Geocoding / Pipeline

### 7.4 Files left in place but no longer mounted

(Cleanup ist Phase-3+-Material)

- `src/components/Landing/HeroSection.tsx`
- `src/components/Landing/LandingStats.tsx`
- `src/components/Landing/LandingSections.tsx`
- `src/components/Landing/WeeklyHighlights.tsx`
- `src/components/Landing/RegionExplorer.tsx`
- `src/components/Landing/PopularCategories.tsx`
- `src/components/Landing/ParticleBackground.tsx`
- `src/components/Landing/ScrollHint.tsx`

---

## 8. Performance Budget

| Asset | Vorher (Phase 1) | Nachher (Phase 2) | Delta |
|---|---|---|---|
| Landing Client-JS | ~3.5 KB (V4Nav) | ~5-6 KB (V4Nav + V4FunnelCard interactivity) | +1.5-2.5 KB |
| Landing Critical CSS | unchanged | unchanged | 0 |
| Landing HTML | small | larger (more sections) | +5-15 KB before gzip |
| Landing RSC payload (streamed) | small | larger | +20-30 KB |
| Mapbox bundle | not touched | not touched | 0 |
| Font payload | Geist only | Geist + Fraunces italic for hero | +~6-10 KB Fraunces subset, **lazy via next/font with `display: swap`** |

**LCP optimization:**
- `V4CardHero` für WeekendSection bekommt `priority` Prop → next/image preload
- Erstes Foto erscheint sofort, alle anderen lazy-loaded

**Acceptance:** Lighthouse Mobile Performance Score auf `/` muss ≥ 75 bleiben (von aktuell ~85 nach fn-15; Spielraum für die zusätzlichen Sektionen + Bilder).

**ISR:** `revalidate = 3600` bleibt. `getLandingData()` ist cache-fähig durch Supabase-Query-Cache + RSC-Streaming.

---

## 9. Edge Cases & Constraints

- **Anon ohne Session-Cookie:** `getLandingContext()` returnt leere Sets, `signedIn: false`. State-Derivation fällt auf `ticket`/`free`/`doorsale`/`unknown` zurück.
- **Authed mit 0 saved + 0 follows:** wie anon, aber `signedIn: true` → MatchesSection wird gerendert mit Empty-State.
- **Authed mit followed Artists, aber keine upcoming events:** MatchesSection empty-state.
- **WeekendSection ohne genug Events:** Wenn DB nicht ≥ 7 Events im Range liefert, fülle mit nächstbesten. Wenn < 1: empty-state mit Link zu `/entdecken`.
- **FestivalsSection ohne aktuelle Festivals:** komplett ausblenden (kein leeres Skeleton).
- **State-Derivation Konflikte:** Priority-Order ist deterministisch und stable. Ein Event mit `ticket_url` + `inplan` zeigt `inplan`, weil der Save-Indicator vom User wichtiger ist als die Ticket-Verfügbarkeit. Das matched das Mockup-Behavior.
- **Image-Fallback:** Events ohne `image_url` bekommen Category-Image-Fallback (bestehende Logik aus `EventImage.tsx` re-used — nicht refactored).
- **Hero ohne LCP-Image:** Wenn WeekendSection's top event kein Image hat, `priority` Prop wandert zum nächsten Event mit Image, oder das Hero rendert Logo-Pattern als LCP-Element.
- **CSP (fn-15.6):** Keine neue inline-script-tag-Hash-Drift; Critical CSS bleibt identisch zu Phase 1. Wenn doch hot-path-Inline-Styles nötig, Hash-Recompute via `npm run build` postbuild prüfen.
- **View-Transition (fn-15.5):** `route-root` Anchor bleibt; Phase 2 ändert nichts an der Layout-Struktur.

---

## 10. Acceptance Criteria

- [ ] `/` rendert das v4-Layout: Hero mit 3 Funnel-Cards rechts, danach Artist-Teaser, dann (authed) Matches oder (anon) AnonFollowTeaser, dann WeekendSection (Hero + 6 Grid-Cards), Concerts, Festivals, MapPreview, HowItWorks, dann Footer
- [ ] V4TopNav + V4TabBar aus Phase 1 weiterhin korrekt gemountet (Active: Entdecken)
- [ ] State-Derivation deterministisch: `inplan` > `match` > `lineup` > `ticket` > `free` > `doorsale` > `unknown`; per Unit-Test gedeckt
- [ ] `V4Badge` korrekte Farben + Icons für alle 9 Kinds; per Test gedeckt
- [ ] V4CardV/H/Hero/Festival/Funnel rendern mit allen relevanten Prop-Kombinationen; per Test gedeckt
- [ ] `npm run build` durchläuft, ISR-Marker für `/` bleibt (`●` oder `○ with revalidate`)
- [ ] Bestehende `EventCard` und Konsumenten unangetastet
- [ ] `/entdecken`, `/map`, `/artists`, `/blog` etc. visuell + funktional unverändert vs Phase 1
- [ ] Vitest gesamte v4-Suite grün (Phase 1 + Phase 2 zusammen ≥ 50 tests)
- [ ] Lighthouse Mobile Performance auf `/` ≥ 75
- [ ] Anon User: keine `saved_events`/`artist_follows`-Query-Aufrufe (Session-Cookie absent → getLandingContext skipped DB-Queries)
- [ ] LCP-Element ist V4CardHero-Image mit `priority`-Prop bei ausreichend Events; sonst sinnvoller Fallback
- [ ] `getLandingData` fetched alle Daten parallel via `Promise.all` (kein N+1)

---

## 11. Decision Log

| Decision | Rationale |
|---|---|
| Voller Rebuild von `page.tsx` (Option A) | User explizit gewählt; Phase 1 hat ja bereits Chrome-Bereinigt, konsequenter Schritt. |
| State-Derivation Server-Side | Kein Hydration-Flash; Cards sind dumme Renderer; SEO-konform. |
| Reuse existierende Enrichment-Felder (`price_tier`, `price_flags`) | User-Vorschlag: was schon da ist nutzen, keine neuen Types erfinden. Nur `abendkasse` Flag fehlt — PR #3 adressiert das. |
| `soldout` bleibt definiert aber nicht-derivable | Wartet auf Eventim-API oder explicit-Flag-Enrichment. Type-Slot + Visual reserviert, Code-Pfad kommentiert. |
| `getLandingData()` als Helper, kein neuer API-Endpoint | Spart HTTP-Roundtrip, integriert sauber mit RSC. Bestehende API-Routes (`/api/events/*`) bleiben unangetastet. |
| Cards in `src/components/Events/v4/`, Sektionen in `src/components/Landing/v4/` | Semantische Trennung: Cards = Event-Display, Sektionen = Page-Layout. Wiederverwendung in Phase 4+5 erleichtert. |
| Alte Landing-Komponenten bleiben als Files liegen | Minimal-scope-Regel: Phase 2 fasst nicht an, was Phase 2 nicht braucht. Cleanup ist späterer Phase-Job. |
| Funnel-Cards = eigene Komponente, nicht V4Card | Funnel-Cards sind keine Events, sie sind CTAs. Anderer Datentyp, anderer Hover-Behavior. |
| Soft cutover statt Feature-Flag | User Wahl. Risiko durch Phase 1 Verification gemildert; Phase 2 PR kann reviewed werden bevor merge. |
| MapPreview = static SVG, nicht echte Mapbox | Mapbox-Bundle ist ~480 KB; das auf der Landing zu mounten würde fn-15-Bundle-Win zerstören. Static SVG genügt für die "Karte gibt's hier"-Botschaft. |
