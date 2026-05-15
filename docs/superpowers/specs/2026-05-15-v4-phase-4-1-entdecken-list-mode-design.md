# v4 Phase 4.1 — /entdecken List-Mode (Map → Entdecken extract)

**Datum:** 2026-05-15
**Status:** approved (UX-Pivot vom User nach Phase 4 deploy)

## 1. Problem & Ziel

Phase 4 hat `/entdecken` als Dual-Mode (Filter-Chips + Smart-Suche) gebaut. Der
User möchte stattdessen die **bewährte EventListView + FilterDrawer aus `/map`
als Default-Tab auf `/entdecken`** sehen ("die alte Suche aus map mit dem neuen
UI"). Begründung: räumlich/textuell sauber trennen.

**Klare Trennung nach 4.1:**
- `/map` = nur Karte (Mapbox + Marker + Map-Filter-Drawer für Marker)
- `/entdecken?mode=list` (default) = EventListView + FilterDrawer aus heutigem /map, restyled in v4
- `/entdecken?mode=smart` = NLP-Smart-Suche (unverändert aus Phase 4)

User-Constraint (explizit): **Filter+Sort-Logik aus EventListView muss 1:1
identisch bleiben** — sie funktioniert "wunderbar". Diese Phase ist
reine Umlagerung, keine Logic-Änderung.

## 2. Architektur — Extract via Custom Hook

Die Daten-Pipeline aus `src/app/map/page.tsx` (~755 LOC) ist tief mit dem Page
verflochten. Statt zu kopieren → **eine custom React-Hook `useFilteredEvents()`**
die exakt die heutige Logic kapselt und sowohl /map als auch /entdecken nutzt.

Heutige Daten-Pipeline (map/page.tsx, zu extrahieren):
- `useState` für: `filters` (EventFilters), `bundeslandIds`, `allEvents`,
  `loading`, `backgroundLoading`, `apiTotalCount`, `bundesland` (current)
- `useCallback fetchEventsProgressive` — batched cursor pagination,
  AbortController, generation-guard, IndexedDB-cache
- `useMemo bundeslandEvents` → `dedupedEvents` → `finalEvents` (client-side
  filtering pipeline mit Bundesland, Dedup, District, Category, Price-Tier)
- `useMemo categoryCounts` für FilterDrawer-Chip-Counts
- `useMemo scopeLabel` für "Heute · Burgenland"-Anzeige
- `useEffect` URL-Sync (bundesland, view, district query params)

Was bleibt PAGE-spezifisch (nicht in Hook):
- Map-spezifisch: `dynamicFlyTo`, `userLocation` (geolocation), `hasUrlContext`,
  `hoveredEventId`, Map-Chips-Overlay state
- Selected-Event Modal-State
- View-Toggle (entfällt komplett auf /map nach 4.1)

Hook-Signatur:
```ts
function useFilteredEvents(initialBl?: string): {
  // state + setters
  filters: EventFilters;
  setFilters: (f: EventFilters | ((p: EventFilters) => EventFilters)) => void;
  bundeslandIds: string[];
  setBundeslandIds: (ids: string[]) => void;
  // derived data
  allEvents: Event[];
  finalEvents: Event[];           // post-bundesland + dedup + district + cat + price
  loading: boolean;
  backgroundLoading: boolean;
  apiTotalCount: number | null;
  totalMatchCount: number;
  categoryCounts: Record<string, number>;
  scopeLabel: string;
  // bundesland context
  bundesland: Bundesland;
}
```

Der Hook ist ein 1:1-Extract — alle existing Tests + Verhalten bleiben.

## 3. UI-Komponenten neu

### `V4EntdeckenListMode` (neu)
- Lebt unter `src/components/Discover/v4/V4EntdeckenListMode.tsx`
- Mountet:
  - `useFilteredEvents()` für Daten
  - V4-styled Action-Bar: Such-Pill + "Filter"-Button (öffnet FilterDrawer)
  - Existing `EventListView` (unverändert; tokens passen für /entdecken-Dark-Theme)
  - Existing `FilterDrawer` (unverändert; mit aktuellen Filters + bundeslandIds)
- Event-Detail wird über bestehende `<EventDetail>` Modal geöffnet (gleich wie heute)

### `V4EntdeckenHero` (anpassen)
- Tab-Labels: "Liste" + "Smart-Suche" (statt "Filter" + "Smart-Suche")
- Subtitle leicht anpassen: "Filter nach Datum, Region, Kategorie — oder Smart-Suche in Alltagssprache."

### `V4EntdeckenTabs` (anpassen)
- Mode-Union: `'list' | 'smart'` (statt `'filter' | 'smart'`)
- Default-Tab: 'list'

## 4. /entdecken/page.tsx — Mode-Orchestrator anpassen
- URL: `?mode=list|smart` (default 'list'). Legacy `?mode=filter` wird zu
  'list' gemappt (silent migration).
- Im `list`-Mode: render `<V4EntdeckenListMode/>` — der Hook macht alles.
- Im `smart`-Mode: bleibt `<V4EntdeckenSmartMode initialQuery={q}/>`.
- V4EntdeckenFilterMode aus Phase 4 wird NICHT mehr gemountet (Komponente bleibt
  auf der Platte für eventuelle Wiederverwendung, etwa /heute oder /wochenende).

## 5. /map/page.tsx — Aufräumen
- ViewToggle-Mounts (2 Stellen, mobile + desktop) entfernen.
- `view`-State entfernen (bzw. konstant 'map' setzen).
- `view === 'list'`-Block (EventListView mount, ~12 LOC) entfernen.
- `view`-URL-param-Sync entfernen.
- **Filter-Drawer bleibt** — der filtert die Map-Marker.
- **Daten-Pipeline bleibt unverändert** (siehe Punkt 6).

## 6. Daten-Pipeline-Refactor
Map-Page nutzt nach 4.1 den gleichen `useFilteredEvents()`-Hook. Die heutige
Inline-Logic (filters/bundeslandIds/allEvents/finalEvents/etc.) wandert in den
Hook; map/page.tsx ruft `const { filters, setFilters, finalEvents, ... } =
useFilteredEvents(initialBl);` auf und der Rest des Page bleibt unverändert
(Mapbox bekommt `finalEvents` wie heute).

**Risiko-Mitigation:** Der Hook ist ein 1:1-Cut, kein Rewrite. Wenn der
TypeScript-Compiler grün ist + die existing Tests grün sind + Map visuell
gleich aussieht im Preview, ist das Verhalten erhalten.

## 7. Out-of-Scope
- EventListView Tokens/Styling-Anpassung (sieht im /entdecken-Dark-Theme aus
  wie heute auf /map — Token-System ist bereits konsistent)
- FilterDrawer Styling-Anpassung
- Smart-Suche Änderungen
- /api/events Änderungen
- Map-spezifische Features (Marker, Cluster, Flyto, etc.)
- V4EntdeckenFilterMode Löschung (bleibt für mögliche Phase-5-Wiederverwendung)

## 8. Akzeptanz
- [ ] `/entdecken?mode=list` (default) zeigt EventListView + Filter-Button → öffnet FilterDrawer
- [ ] FilterDrawer-Filterung (Wann/Region/Kategorie/Mit wem/Preis) verändert Liste live wie heute auf /map
- [ ] Sort-Tabs in EventListView (Datum/Distanz/Score) funktionieren wie heute
- [ ] Infinite-Scroll in der Liste funktioniert wie heute
- [ ] `/entdecken?mode=smart` ist NLP-Suche unverändert
- [ ] Deep-Link `/entdecken?mode=list&bl=burgenland&kat=musik` öffnet vorgefiltert
- [ ] `/map` zeigt KEINEN ViewToggle, KEINE Liste — nur Karte
- [ ] `/map` Map-Marker zeigen denselben Filter-Output wie /entdecken-Liste (gleicher Hook)
- [ ] Legacy `/entdecken?mode=filter` wird silent zu `mode=list` (Backwards-Compat)
- [ ] `/map?view=list` redirected zu `/entdecken?mode=list` (Backwards-Compat)
- [ ] `npm run build` grün, CSP postbuild OK
- [ ] v4 Vitest Suite ≥ 166 Tests grün
