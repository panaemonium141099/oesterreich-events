# v4 Redesign — Phase 3: Event-Detail-Redesign

**Datum:** 2026-05-14
**Branch:** `claude/v4-phase-3-event-detail` (basiert auf master, das jetzt Phase 1 + Phase 2 enthält)
**Status:** Design — awaiting user review
**Phasen-Kontext:** Phase 3/5 des v4-Redesigns. Voraussetzungen erfüllt: Phase 1 (Foundation/Nav) und Phase 2 (Card-System + State-Derivation) sind gemerged.

---

## 1. Goal & Context

Ersetze die bestehende Event-Detail-Page (`EventDetailV2`, 963 LOC) durch eine v4-konforme Komponente mit 8 State-Boxen (basierend auf `deriveEventState` aus Phase 2) und einer Mobile-Sticky-Bar. Trust-Copy wird strikt nach chat2-Brief enforced — banned strings (`"Kein Aufpreis"`, `"Personalisierte e-Tickets"`, `"Boardkarte"`, `"Bei ÖBB buchen"`) entfernt; nur die zwei zugelassenen Strings sind erlaubt.

### Driving Brief (aus chat2)

> *"Trust copy is SAFE: 'Kauf und Zahlung erfolgen beim offiziellen Anbieter.' Provider line: 'Offizieller Ticketshop: <Name>'. Primary CTA: 'Ticket sichern' or 'Zu Eventim'."*
>
> *"Friends/social should only appear in the context of planning: Share plan, Invite friends, Later: group plan."*

---

## 2. Out of Scope (explicit)

Diese Phase fasst **nicht** an:

- `EventDetailV2.tsx` (963 LOC) bleibt als Datei stehen (kein Mount nach Route-Swap). Cleanup ist späterer Phase-Job — minimal-scope-Regel.
- `EventDetail.tsx` (v1, 45 KB) — bleibt
- `RelatedEvents`, `EventDetailActions`, `AfterSavePanel`, `EventPreviewCard`, `EventSheet` — bleiben falls anderswo genutzt
- Plan-Wizard (Phase 5) — der "Abend planen"-Button linkt von Phase 3 erstmal zu `/saved` (gleicher Stub wie `/plans`)
- Auth-Modals (Phase 4) — anon-User klickt "Plan speichern" → redirect zu `/auth/login?next=<event-url>`
- `/entdecken`, `/map`, `/artists`, `/feed` Inhalte — unverändert
- Scraper, Enrichment, Geocoding, Pipeline — null Berührung
- Friends-Avatars / RSVP-zählung im Event-Detail — **raus** (chat2-konform: Friends gehören in Plan-Kontext, nicht Event-Detail)

---

## 3. Architecture

```
/events/[...slug]/page.tsx (RSC, bleibt strukturell)
├── resolveEvent(slugArr) (bestehend)
├── getLandingContext()    NEU — wird in Phase 3 mit-gerufen für deriveEventState
├── deriveEventState(event, ctx)  NEU — server-side state-derivation
└── <V4EventDetail event={event} state={state} venue={…} lineup={…} similar={…} />
    ├── <V4EventDetailHero />          — full-bleed image, eyebrow, title, location, share
    ├── <V4EventDetailContent />        — description, tags, lineup, map, similar-events
    └── <V4SideBox state={state} ev={event} />
        └── switch(state):
             ticket | match | lineup    → <V4TicketBox/>     (gold variant for match/lineup)
             free                        → <V4FreeBox/>
             doorsale                    → <V4DoorsaleBox/>
             inplan                      → <V4InPlanBox/>
             unknown                     → <V4UnknownBox/>
             soldout                     → <V4SoldoutBox/>
    └── <V4MobileStickyBar state={state} ev={event} />  (md:hidden)
```

**State-Derivation läuft Server-Side**: Event kommt aus DB als roher Record, wird durch `deriveEventState(event, ctx)` zu `{...event, state}` angereichert. Side-Box und Mobile-Sticky-Bar lesen den derived state. Boxen sind reine Renderer.

---

## 4. Component Contracts

### 4.1 `V4EventDetail` (RSC)

```ts
interface V4EventDetailProps {
  event: Event & { state: V4EventState };
  venue?: Venue | null;
  lineup?: FestivalArtist[];
  similarEvents?: Event[];
  bundeslandHref?: string | null;
}
```

Layout: max-w 1180, 2-col Grid (desktop) `[content, side-rail-400px]`. Mobile: single column + sticky bottom bar.

### 4.2 `V4EventDetailHero`

- Full-bleed image (16:9 ratio mobile, 21:9 desktop), gradient overlay
- Eyebrow: date with weekday + time
- H1 title (text-3xl md:text-4xl, Inter bold, tracking-tight)
- Location chip (location_name + bundesland)
- Top-right floating: Share + Save buttons (icon-only, glassmorphic)

### 4.3 `V4EventDetailContent` (RSC)

- Description text (max-w 65ch, leading-relaxed)
- Tags chips (V4Badge-style, neutral)
- If lineup: line-up grid (festival_artists), mini-cards with billing tier
- If venue: small map snippet (Mapbox Static, single pin) + venue name + address
- Similar events row (3 × V4CardV, reuses Phase 2 cards)

### 4.4 Side-Box Family (RSC)

Each box is small (~60-100 LOC), shares structure:
- Color-accent top-stripe (3px) keyed to state
- V4Badge + headline + supplementary info + CTA(s)
- Trust copy at bottom (only for ticket/match/lineup variants)

**V4TicketBox** (also handles match + lineup variants via prop):
- Provider line: `"Offizieller Ticketshop: <provider>"`
- Price block: eyebrow "ab" + bold price + "pro Person"
- CTA: `"Zu {provider}"` (sand-tone for ticket, gold-tone for match/lineup)
- Secondary: "Zum Plan" · "Merken" · "Teilen"
- Trust: `"Kauf und Zahlung erfolgen beim offiziellen Anbieter."` + `"Du wirst zum offiziellen Ticketshop weitergeleitet."`

**V4FreeBox**:
- Badge "Eintritt frei" + headline "Plane deinen Abend und lass dich rechtzeitig erinnern."
- Sub: "Kein Ticket nötig. Wir merken Anreise und Reminder in deinem Plan."
- CTA: `"Abend planen"` (green)
- Secondary: Merken · Teilen

**V4DoorsaleBox**:
- Badge "Abendkasse" + headline "Tickets gibt's nur vor Ort — kein Online-Verkauf."
- If `price_text` known: small box "Vor Ort: <price>"
- Sub: "Plane Anreise und Reminder — wir erinnern dich rechtzeitig."
- CTA: `"Abend planen"`
- Secondary: Route · Merken

**V4InPlanBox**:
- Badge "In deinem Plan"
- Status checklist: Ticket-Status / Anreise-Status / Reminder-Status (mini bullets)
- CTA: `"Plan öffnen"`
- Secondary: Aus Plan entfernen (dezenter)

**V4UnknownBox**:
- Badge "Kein Online-Verkauf bekannt"
- Headline: "Wir kennen keinen Ticketshop für dieses Event."
- Sub: "Wenn du hin willst, merken wir es — Anreise & Reminder gehen trotzdem."
- CTA: `"Merken"` (secondary tone)
- Secondary: Route

**V4SoldoutBox**:
- Badge "Ausverkauft" (rot dezent)
- Headline: "Tickets sind aktuell vergriffen."
- Sub: "Wir zeigen dir ähnliche Events darunter."
- CTA: `"Ähnliche Events"` (scrollt zu Similar-Events-Section)

### 4.5 `V4MobileStickyBar` (Client für press-haptic + share-API)

Fixed bottom, md:hidden, höhe ~76px + safe-area. State-variants kondensieren die Side-Box-Botschaft:

- ticket: `Zu {provider}` button + price
- match/lineup: gold variant des ticket
- free: `Abend planen` + "Eintritt frei"
- doorsale: `Abend planen` + "Abendkasse"
- inplan: `Plan öffnen` + "In deinem Plan"
- unknown: `Merken` + "Kein Ticket bekannt"
- soldout: `Ähnliche Events` + "Ausverkauft"

---

## 5. Trust Copy Allowlist

**Erlaubte Strings** (chat2-Brief):
- `"Kauf und Zahlung erfolgen beim offiziellen Anbieter."`
- `"Du wirst zum offiziellen Ticketshop weitergeleitet."`
- `"Offizieller Ticketshop: {provider}"`

**Banned Strings** (chat2-Brief, **dürfen NICHT** vorkommen):
- `"Kein Aufpreis"`
- `"Personalisierte e-Tickets"`
- `"Boardkarte"`
- `"Bei ÖBB buchen"`
- Generally: keine Garantien zu Tickets-Verfügbarkeit oder Preisen

Implementation: Vitest-Snapshot-Test schaut nach Banned Strings in V4EventDetail Render → schlägt fehl wenn welche drin sind.

---

## 6. Files Added / Modified

### 6.1 Added

- `src/components/Events/v4/V4EventDetail.tsx` — ~120 LOC
- `src/components/Events/v4/V4EventDetailHero.tsx` — ~80 LOC
- `src/components/Events/v4/V4EventDetailContent.tsx` — ~120 LOC
- `src/components/Events/v4/V4SideBoxes.tsx` — ~400 LOC (6 box-components + dispatcher)
- `src/components/Events/v4/V4MobileStickyBar.tsx` — ~150 LOC
- `src/lib/v4/derive-detail-context.ts` — small helper to load per-user detail-context (savedEventIds for inplan derivation on a single event)
- Tests pro Komponente (~5 files, ~30 specs total)

### 6.2 Modified

- `src/app/events/[...slug]/page.tsx` — swap import von `EventDetailV2` zu `V4EventDetail`. Pass derived state. Behält ISR, metadata, slug-redirect-logic.
- `src/components/Events/v4/index.ts` — barrel exports erweitern

### 6.3 Untouched

- `src/components/Events/EventDetailV2.tsx` — bleibt als File
- `src/components/Events/EventDetailActions.tsx` — bleibt
- `src/components/Events/RelatedEvents.tsx` — bleibt (vielleicht in V4EventDetailContent als child reused?)
- `EventSheet`, `EventPreviewCard`, `AfterSavePanel` — bleiben
- Alles unter Phase 1 + Phase 2 Verzeichnissen — nicht angefasst
- Andere Routes — unverändert

---

## 7. Performance Budget

| Asset | Vorher | Nachher | Delta |
|---|---|---|---|
| Event-Detail Client-JS | EventDetailV2 ~25 KB gzipped client-side | V4MobileStickyBar ~3 KB Client-Island | **-22 KB Bundle** (Reduktion!) |
| Server-rendered HTML | EventDetailV2 inline-styles + lots of state | V4EventDetail RSC + tokens | similar or smaller |
| Critical CSS | unchanged | unchanged | 0 |
| New CSS-vars | none — reuses Phase 1 `--v4-*` tokens | 0 |
| Font payload | Geist (bestehend) | Geist (unchanged) | 0 |

Phase 3 sollte die Event-Detail-Page-Bundle **schlanker** machen (RSC-first statt Client-State-heavy).

---

## 8. Acceptance Criteria

- [ ] `/events/<slug>` rendert das v4-Layout für alle 8 States (test-coverable via mock events)
- [ ] State-Box-Switch korrekt: `match`/`lineup` → gold TicketBox; `ticket` → sand TicketBox; `free` → green FreeBox; `doorsale` → blue DoorsaleBox; `inplan` → green InPlanBox; `unknown` → neutral UnknownBox; `soldout` → red SoldoutBox
- [ ] Mobile-Viewport: V4MobileStickyBar sichtbar, korrekt für jeden State
- [ ] Banned-Strings vitest-snapshot grün: keiner der 4 Banned-Strings ist in irgendeinem Render-Output
- [ ] Trust-Copy: nur die 2 zugelassenen Strings in TicketBox/MobileStickyBar
- [ ] Friends-Avatars / RSVP-zählung **nicht** mehr im Event-Detail sichtbar (sind dann Plan-Wizard-Material)
- [ ] `npm run build` erfolgreich, ISR-Marker bleibt
- [ ] Bestehende ISR, metadata, slug-redirects auf Event-Detail-Page funktionieren wie bisher
- [ ] Vitest-Suite (v4 phase 1+2+3 zusammen) ≥ 80 tests, alle grün
- [ ] `EventDetailV2` wird nicht mehr importiert (grep verifiziert)

---

## 9. Edge Cases

- **Event ohne ticket_url**: Side-Box fällt auf doorsale/unknown/free zurück je nach price_flags. Mobile-Sticky-Bar zeigt entsprechenden Pfad.
- **Event mit ticket_url ohne provider**: TicketBox fällt auf "Offizieller Ticketshop" (ohne Name) zurück. Vermutlich nie der Fall in echten Daten.
- **Event in der Vergangenheit**: `publish_status === 'expired'` → deriveEventState gibt `unknown`; UnknownBox shown. Acceptable.
- **Sehr lange Description**: max-w 65ch, line-clamp nur auf Card-Surfaces nicht hier — Detail-Page zeigt volle Description.
- **Festival-Detail**: wenn lineup vorhanden, Lineup-Grid erscheint im Content. Side-Box ist meist `lineup` (gold).

---

## 10. Decision Log

| Decision | Rationale |
|---|---|
| V4EventDetail neu, EventDetailV2 bleibt liegen | Minimal-scope-Regel; alte Komponente nicht angefasst. Cleanup in späterer Aufräum-Phase. |
| Side-Box als eigene Komponentenfamilie mit dispatcher | Klare State→UI-Trennung; jede Box testbar in Isolation. |
| Friends-Avatars raus | chat2-Brief: Friends gehören in Plan-Kontext, nicht Event-Detail. |
| Trust-Copy als Konstanten + Snapshot-Test | Verhindert dass spätere Edits versehentlich Banned-Strings reinbringen. |
| Mobile-Sticky-Bar separate Komponente | Client-Island (~3 KB) bleibt klein; Desktop-Rail ist RSC. |
| State-Derivation re-uses Phase 2 helper | DRY; konsistent zwischen Landing-Cards und Event-Detail. |
| "Abend planen"-Button linkt für Phase 3 zu /saved | Plan-Wizard kommt Phase 5; `/saved` ist sinnvolles Stub-Target. |
| Anon-User "Plan speichern" → /auth/login?next=<event> | Auth-Modal kommt Phase 4; direct redirect ist akzeptabler Übergang. |
