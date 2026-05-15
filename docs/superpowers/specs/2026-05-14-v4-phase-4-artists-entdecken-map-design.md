# v4 Redesign — Phase 4: Künstler-Tab + Entdecken-Dual-Mode + Map-Polish

**Datum:** 2026-05-14
**Branch:** `claude/v4-phase-4-artists-entdecken-map` (gebrancht von master mit Phase 1+2+3 gemerged)
**Status:** Design — awaiting user review
**Phasen-Kontext:** Phase 4/5 des v4-Redesigns. Voraussetzungen: Phase 1+2+3 sind alle gemerged auf master.

---

## 1. Goal & Context

Drei Surfaces:

1. **Künstler-Page** (`/artists`) — volles v4-Redesign der primären Retention-Surface (Follow-Funnel)
2. **/entdecken** — Dual-Mode mit Tabs zwischen bestehender Smart-Suche (NLP-semantic) und neuem Filter+Sort+Grid
3. **/map** — leichte v4-Polish: Page-Header + Filter-Chips-Overlay + Marker-Color-Legende, Mapbox-Core unangetastet

### Driving Brief (chat2)

> *"03 · Artists (/artists) — Primäres Retention-Feature. Search-Result mit Follow-Toggle. Post-Follow-Toast: 'Du folgst jetzt [Artist]. Wir benachrichtigen dich bei Österreich-Terminen.' Empty-State: 'Noch kein Österreich-Termin gefunden.'"*
>
> *"07 · Karte (/map) — Headline: 'Events auf der Karte.' Marker-Farben (Sand · Gold · Grün · Neutral) mit text-basierter Legende — nie Farbe allein. Filter-Chips über der Karte."*

User explicit decision on /entdecken: **Tabs (Option B)** — Smart-Suche bleibt voll funktional, Filter-Mode kommt zusätzlich. Default beim ersten Besuch: Filter.

---

## 2. Out of Scope (explicit)

- Plan-Wizard → Phase 5
- Friends-Avatars / RSVP-Counter — bleiben raus (kommen mit Phase 5)
- Auth-Modals — wenn anon "Folgen" tippt, redirect zu `/auth/login?next=/artists` (gleiches Pattern wie Phase 3)
- Scraper, Enrichment, Geocoding, Artist-Matching-Engine — null Berührung
- Mapbox-GL Core (Marker rendering, clustering, viewport) — bleibt
- FilterDrawer-Logik im Map — wird wiederverwendet, nicht angefasst
- `EventDetailV2.tsx` Cleanup — separater Cleanup-Phase-Job
- Bestehende `/api/search/semantic` Backend — NLP-Logik unverändert
- Bestehende `/api/events` Backend — wird konsumiert, nicht erweitert (sollte aktuelle Filter alle unterstützen)
- /feed, /saved, /groups, /messages, /memories — bleiben

---

## 3. Architecture

### 3.1 Künstler-Page

```
/artists/page.tsx (RSC entry, bleibt strukturell)
└── <V4ArtistsPageClient />  NEU — ersetzt aktuelle ArtistsPageClient (428 LOC)
    ├── V4ArtistsHero            — Hero + V4SearchTabs (mode='artists')
    ├── V4ArtistSearchResult     — Result-Card mit Follow-Toggle
    │     ├── V4Toast            — Post-Follow-Toast (Phase 4 atom NEU)
    │     └── Empty-State / Matches-Callout
    ├── V4MatchingEvents          — Liste gold-accent Match-Cards
    └── V4FollowedArtistsGrid     — Card-Grid mit Match-Count pro Artist
```

**Daten-Quellen** (alle bereits implementiert, nicht angefasst):
- `/api/artists/search` — Spotify search via Client Credentials
- `/api/artists/follow` — POST follow / DELETE unfollow
- `/api/artists/following` — list followed (paginated)
- `/api/artists/events` — matched events (joined via artist_event_notifications)
- `/api/spotify/status` — connection check für Spotify-Import-Panel

**Bestehende Komponenten die migrieren:**
- `AddArtistsPanel.tsx` — Spotify-Import-Funktion bleibt, wird in v4-Style gewrappt (Layout-only)
- `PopularArtistsSuggestions.tsx` — bleibt, restyled
- `ImportedArtistsList.tsx` — bleibt, restyled

**Was komplett raus:**
- `ArtistsPageClient.tsx` (428 LOC) wird durch neue v4-Implementierung ersetzt. Bleibt als Datei stehen (minimal-scope-Regel — Cleanup separate Phase). Datei wird NICHT mehr importiert.

### 3.2 /entdecken — Dual-Mode mit Tabs

```
/entdecken/page.tsx (Client bleibt 'use client')
├── <V4EntdeckenHero>          — Eyebrow + H1 + Subtitle + Tabs
├── Tabs: [Filter] [Smart-Suche]
└── If mode === 'filter':
    ├── <V4FilterChips>         — 9 toggle-chips (Tickets/Gratis/Heute/...)
    ├── <V4SortRow>             — Empfohlen / Datum / Tickets / Nähe
    └── Grid of V4CardV (events via /api/events with active filters)
   Else mode === 'smart':
    └── <SmartSearchPanel>      — bestehende NLP-UI (Textarea + Beispiele + Result-List)
        Result-Cards werden auf V4CardV migriert (gleiche Card-Komponente wie Filter-Mode)
```

URL-Persistierung via `useSearchParams` + `router.replace`:
- `/entdecken?mode=filter&chip=tickets,heute&sort=score`
- `/entdecken?mode=smart&q=ich+will+heute+saufen`

Default-Mode beim ersten Besuch: `filter`. Auf `back`-Button bleibt der zuletzt gewählte Modus.

### 3.3 /map — v4 Chrome-Polish

Bestehende `/map/page.tsx` (755 LOC) bleibt strukturell. Nur additive Layer:

```
<MapPage>                       — bestehende Mapbox-Composition
  ├── <V4MapHeader>             NEU — Sticky-Top im V4-Style: Eyebrow + H1 "Events auf der Karte"
  ├── <V4MapFilterChipsOverlay> NEU — horizontal-scrollbare Chips über dem Mapbox-Container
  ├── <Mapbox>                   — UNVERÄNDERT
  ├── <V4MarkerLegend>          NEU — kleines hairline-bordered Panel unten-links mit Sand/Gold/Grün/Neutral Legende
  └── <FilterDrawer>            — bestehend, unverändert
```

Chips entry-point ist optional: Klick auf eine Chip kann (a) lokalen Filter setzen (z.B. "Tickets verfügbar" → `ticket_url IS NOT NULL` in der Map-Query), oder (b) FilterDrawer öffnen mit dieser Chip vorgewählt. Phase 4 macht (a) für die simplen Chips und (b) als Fallback.

---

## 4. Component Contracts

### 4.1 V4Toast (NEU — Atom)

```ts
interface V4ToastProps {
  kind?: 'match' | 'success' | 'info';
  children: React.ReactNode;
  /** Auto-dismiss after this ms; 0 = sticky. Default 6000. */
  duration?: number;
  onDismiss?: () => void;
}
```

Wird gemounted in `V4ArtistSearchResult` nach erfolgreichem Follow. Position: floating bottom-right (oder bottom-center mobile). Auto-dismiss nach 6s, manual close-button.

### 4.2 V4ArtistsHero (RSC)

Static hero — eyebrow, H1 mit Fraunces-italic-Accent, sub, search input. Klick auf search input fokussiert das echte Such-Input darunter im `V4ArtistSearchResult`-Block.

### 4.3 V4ArtistSearchResult (Client)

```ts
interface V4ArtistSearchResultProps {
  initialQuery?: string;
}
```

State-Maschine:
- `idle` — keine Suche aktiv, zeigt "Tipp einen Künstlernamen…" Hint
- `searching` — Spinner während `/api/artists/search` läuft
- `result` — Ergebnis-Card mit Spotify-Avatar, Name, Genre, Follow-Button
- `result_followed` — same Card aber mit "Folgst du" + Match-Callout (matching events from `/api/artists/events?artist=`)
- `result_empty` — gleiche Card aber Empty-State-Callout ("Noch kein Österreich-Termin gefunden.")
- `error` — fail-soft inline error

Follow-Click:
- Anon-User: redirect zu `/auth/login?next=/artists?q={query}` (Auth-Gate, gleiches Pattern wie Phase 3)
- Authed: POST `/api/artists/follow` → success: zeige V4Toast + transition zu `result_followed`

### 4.4 V4FollowedArtistsGrid (Client)

```ts
interface V4FollowedArtistsGridProps {
  artists: FollowedArtistWithMatches[];
}

interface FollowedArtistWithMatches {
  id: string;
  artist_name: string;
  artist_name_normalized: string;
  spotify_image_url: string | null;
  upcoming_matches: number; // pre-computed server-side
}
```

Grid von 2 Spalten (desktop) / 1 Spalte (mobile). Jede Card zeigt: Avatar, Name, Genre, `N kommend{e/er} Auftritt{e}` oder `Kein Termin · wir bleiben dran`, "Auftritte"-Link.

Daten kommt RSC-fetched in `V4ArtistsPageClient`, gepaged 50 default.

### 4.5 V4MatchingEvents (Client)

Liste von ~5-10 gold-accent Match-Cards. Daten aus `/api/artists/events` (bestehende API). Jede Card:
- Image left, content right
- Match-Badge oder Lineup-Badge mit personalisierter Copy
- "Ticket sichern · €X" wenn ticket_url vorhanden
- "Planen"-Button (linkt zu /saved als Phase-4-Stub bis Plan-Wizard kommt)

### 4.6 V4EntdeckenTabs (NEU — Client)

```ts
interface V4EntdeckenTabsProps {
  current: 'filter' | 'smart';
  onChange: (next: 'filter' | 'smart') => void;
}
```

Visual: 2-pill segmented control. Active state highlighted with `--v4-surface-elevated`. Mobile: same, nicht stacked.

### 4.7 V4FilterChips (Client)

```ts
interface V4FilterChipsProps {
  active: Set<string>;
  onToggle: (chip: string) => void;
}

const CHIPS = [
  { key: 'tickets',   label: 'Tickets verfügbar', icon: 'ticket' },
  { key: 'free',      label: 'Gratis',            icon: 'check' },
  { key: 'doorsale',  label: 'Abendkasse',        icon: 'coffee' },
  { key: 'today',     label: 'Heute',             icon: 'dot' },
  { key: 'weekend',   label: 'Wochenende',        icon: null },
  { key: 'concerts',  label: 'Konzerte',          icon: null },
  { key: 'festivals', label: 'Festivals',         icon: null },
  { key: 'nearby',    label: 'In deiner Nähe',    icon: 'map' },
  { key: 'mine',      label: 'Meine Künstler',    icon: 'music' },
];
```

Active-chip render: sand background tint + icon if defined. Multiple chips can be active. Each toggle mutates URL param `?chip=` (comma-separated).

### 4.8 V4SortRow (Client)

Pills: Empfohlen (default) / Datum / Tickets / Nähe. URL: `?sort=score|date|tickets|distance`.

Maps to existing `/api/events?sort=...` params (existing API supports score+date; tickets/distance need verification at impl time — if not, fallback to score).

### 4.9 V4MapHeader (RSC, additive)

Mounted above Mapbox container. Eyebrow "KARTE" + H1 "Events auf der Karte." in v4-typography (Inter bold, tracking-tight, max-w 1180).

### 4.10 V4MapFilterChipsOverlay (Client)

Horizontal-scrollable chip-row. Same chips as V4FilterChips but only the simplest ones (Tickets / Gratis / Heute / Konzerte). Klick auf Chip setzt Map-state-Filter.

### 4.11 V4MarkerLegend (RSC)

Bottom-left floating panel mit 4 colored-dots + Labels (Sand "Tickets verfügbar", Gold "Künstler im Line-up", Grün "In deinem Plan", Neutral "Kein Online-Verkauf"). Accessibility: Color never alone — jeder Label steht daneben.

---

## 5. Files Added / Modified

### 5.1 Added

**Atoms / shared:**
- `src/components/Events/v4/V4Toast.tsx` (~50 LOC)
- `src/components/Events/v4/V4FilterChips.tsx` (~80 LOC)
- `src/components/Events/v4/V4SortRow.tsx` (~50 LOC)
- `src/components/Events/v4/V4EntdeckenTabs.tsx` (~40 LOC)

**Artists page:**
- `src/app/artists/V4ArtistsPageClient.tsx` (~300 LOC) — replaces existing ArtistsPageClient mount
- `src/components/Artists/v4/V4ArtistsHero.tsx`
- `src/components/Artists/v4/V4ArtistSearchResult.tsx`
- `src/components/Artists/v4/V4FollowedArtistsGrid.tsx`
- `src/components/Artists/v4/V4MatchingEvents.tsx`
- `src/components/Artists/v4/index.ts` (barrel)

**Entdecken:**
- `src/components/Discover/v4/V4EntdeckenHero.tsx`
- `src/components/Discover/v4/V4EntdeckenFilterMode.tsx`
- `src/components/Discover/v4/V4EntdeckenSmartMode.tsx` (extracted from current /entdecken UI)
- `src/components/Discover/v4/index.ts`

**Map:**
- `src/components/Map/v4/V4MapHeader.tsx`
- `src/components/Map/v4/V4MapFilterChipsOverlay.tsx`
- `src/components/Map/v4/V4MarkerLegend.tsx`
- `src/components/Map/v4/index.ts`

**Tests:** ~10 test files matching component structure, ~40 specs total (smaller than Phase 3 because more layout/integration, less state-machine).

### 5.2 Modified

- `src/app/artists/page.tsx` — swap import to V4ArtistsPageClient (1 line)
- `src/app/entdecken/page.tsx` — full rewrite (current 275 LOC → ~80 LOC orchestrator with tab-mode switching + 2 child components)
- `src/app/map/page.tsx` — additive only: import + mount V4MapHeader, V4MapFilterChipsOverlay, V4MarkerLegend in the right slots. NO refactoring of existing Mapbox logic.

### 5.3 Untouched

- `src/app/artists/ArtistsPageClient.tsx` — bleibt als Datei (kein Mount mehr)
- `/api/artists/*`, `/api/search/semantic`, `/api/events` — alle Backends bleiben
- Mapbox-GL Logik, FilterDrawer, Filter-State-Maschine in /map
- Spotify-Import (`AddArtistsPanel`, `PopularArtistsSuggestions`, `ImportedArtistsList`) — werden re-imported und in v4-Style umrahmt, aber intern nicht angefasst
- Phase 1+2+3 Komponenten — null Berührung

---

## 6. Performance Budget

| Surface | Vorher | Nachher | Delta |
|---|---|---|---|
| /artists Client-JS | 428 LOC ArtistsPageClient + heavy auth/Spotify state | 300 LOC V4ArtistsPageClient (same features, v4 layout) | similar (~0 net) |
| /entdecken Client-JS | 275 LOC monolith | 80 LOC orchestrator + 2 modes lazy-loaded via mode prop | similar or slightly larger (extra abstraction) |
| /map Client-JS | 755 LOC | 755 + ~150 LOC new chrome | +small |
| Critical CSS | unchanged | unchanged | 0 |
| Mapbox-GL bundle | unchanged | unchanged | 0 (kein zusätzlicher Map-Code) |

Target: Lighthouse Mobile auf `/artists` und `/entdecken` ≥ 75 (vergleichbar zur Landing nach Phase 2).

---

## 7. Acceptance Criteria

- [ ] `/artists` zeigt v4-Hero + Search-Result + Followed-Grid + Matches-Liste
- [ ] Follow-Click anon → redirect `/auth/login?next=/artists?q={query}`
- [ ] Follow-Click authed → POST + V4Toast erscheint mit Artist-Namen
- [ ] Empty-State: "Noch kein Österreich-Termin gefunden." sichtbar wenn followed-artist keine matches
- [ ] Spotify-Import-Panel weiterhin funktional (Import-Flow ungebrochen)
- [ ] `/entdecken?mode=filter` (default) zeigt Chips + Sort + V4CardV-Grid
- [ ] `/entdecken?mode=smart` zeigt NLP-Textarea + Beispiele wie bisher, Results rendern als V4CardV
- [ ] Tab-Switch ohne Page-Reload, URL aktualisiert via router.replace
- [ ] Aktive Filter-Chips persistent in URL (`?chip=`)
- [ ] `/map` zeigt v4-Header oben + Filter-Chips-Overlay über Mapbox + Marker-Legend bottom-left
- [ ] Mapbox-Interaktivität, Filter-Drawer, alle bestehenden Map-Features funktionieren wie vor Phase 4
- [ ] Banned-Strings (Phase 3 snapshot) auch für /artists Match-Cards grün
- [ ] `npm run build` durchläuft, ISR-Marker stabil
- [ ] v4-Vitest Suite (Phase 1+2+3+4) ≥ 150 Tests grün

---

## 8. Edge Cases

- **Anon `/artists`-Visit**: V4ArtistsPageClient zeigt Hero + Search-Input, Follow-Click redirected. Followed-Grid und Matches-Liste werden nicht gerendert (kein User).
- **Authed but no follows**: Followed-Grid mit Empty-State ("Such einen Künstler oben"). Matches-Liste verborgen.
- **Authed, follows but no matches**: Followed-Grid zeigt artists mit "Kein Termin · wir bleiben dran". Matches-Liste mit Empty-Hint ("Wir warten auf erste Auftritte.").
- **Search-API down**: Result-Card zeigt fail-soft Inline-Error mit retry.
- **Smart-Mode mit leerem Query**: Beispiele werden gezeigt (gleiche UX wie heute).
- **Filter-Mode mit aktiven Chips aber 0 Treffer**: Empty-State "Keine Events passen zu deinen Filtern." + "Filter zurücksetzen"-CTA.
- **Map ohne Mapbox-Token (selten)**: Marker-Legend + Header rendern, Mapbox-Bereich zeigt fallback (bestehend).

---

## 9. Decision Log

| Decision | Rationale |
|---|---|
| /entdecken Dual-Mode mit Tabs (Option B) | User-Wahl explizit. Semantik bleibt erhalten, neue Filter-UI parallel verfügbar. |
| Filter-Mode default | Casual-User-Behavior; Power-User finden Smart-Suche einen Tap entfernt. |
| URL-persistierte Mode + Filter-Params | Deep-Links funktionieren, Share-Links bleiben sauber, Browser-Back funktioniert intuitiv. |
| V4Toast als neuer Atom in Events/v4/ (nicht Artists-spezifisch) | Wiederverwendbar in Phase 5 für Plan-Speichern-Toast etc. |
| ArtistsPageClient (alt) bleibt liegen | Minimal-scope-Regel; Cleanup in eigener späterer Phase. |
| Spotify-Import unverändert wiederverwenden | AddArtistsPanel + PopularArtistsSuggestions sind komplexe Integrationen, kein UX-Problem; nur v4-Frame drum rum. |
| /map nur additive Chrome-Polish, kein Mapbox-Refactor | 755 LOC Mapbox-Composition ist arbeitsam und kritisch; Risiko/Nutzen-Verhältnis schlecht für volle Migration. |
| Anon-Follow → /auth/login statt Auth-Modal | Phase-4-Stub; Phase 5 bringt das richtige Auth-Modal. Konsistent mit Phase 3. |
| V4FilterChips als eigene Komponente unter Events/v4/ | Wird auch von /map Overlay und potentiell /plans Phase 5 wiederverwendet. |
