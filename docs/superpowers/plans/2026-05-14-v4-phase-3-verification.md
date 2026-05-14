# v4 Phase 3 — Verification Report

**Datum:** 2026-05-14
**Branch:** `claude/v4-phase-3-event-detail`
**Spec:** `docs/superpowers/specs/2026-05-14-v4-phase-3-event-detail-design.md`
**Plan:** `docs/superpowers/plans/2026-05-14-v4-phase-3-event-detail.md`

## Build

```
npm run build
```

- ✓ Compilation succeeds (Turbopack)
- ✓ All routes generate
- ✓ CSP postbuild verify: 94 critical-css blocks across 95 HTML files all hash green
- ✓ No new TypeScript errors

## Vitest

```
npm test -- src/__tests__/components/events/v4/ src/__tests__/components/v4/ src/__tests__/lib/v4/
```

- ✓ **123 tests / 24 files / all passing**
  - Phase 1 (Logo, TopNav, TopNavAuth, TabBar): 25
  - Phase 2 (Badge, CardV/H/Hero/Festival/Funnel, deriveEventState): 39
  - Phase 3 (TicketBox/Free/Doorsale/InPlan/Unknown/Soldout, SideBox dispatcher, Hero, Content, MobileStickyBar, EventDetail, banned-strings, trust-copy): 59

## EventDetailV2 No-Longer-Imported Check

Both production routes that used `EventDetailV2` are swapped to `V4EventDetail`:
- `src/app/events/[...slug]/page.tsx` — full event-detail page
- `src/app/@modal/(.)events/[...slug]/page.tsx` — intercepting modal route

Remaining references:
- `src/lib/events/event-detail-loaders.ts` — **only `type FriendAttendee` and `type LineupAct` type imports**, not the component itself. Harmless dead types; cleanup in a later phase.

`EventDetailV2.tsx` (963 LOC) stays on disk per minimal-scope rule. No production code imports it.

## Trust-Copy Snapshot

The banned-strings test renders `V4SideBox` for all 8 states and asserts none of the four banned phrases (`Kein Aufpreis`, `Personalisierte e-Tickets`, `Boardkarte`, `Bei ÖBB buchen`) appears in output. All 8 state-renderings pass — trust-copy hygiene is enforced going forward.

## Side-Box Coverage

| State | Component | Variant | Action |
|---|---|---|---|
| ticket | V4TicketBox | sand stripe | "Zu {provider}" |
| match | V4TicketBox | gold stripe + "Du folgst …" | "Zu {provider}" |
| lineup | V4TicketBox | gold stripe + "… im Line-up" | "Zu {provider}" |
| free | V4FreeBox | green stripe | "Abend planen" |
| doorsale | V4DoorsaleBox | blue stripe + optional "vor Ort: €X" | "Abend planen" |
| inplan | V4InPlanBox | green stripe | "Plan öffnen" |
| unknown | V4UnknownBox | neutral hairline | "Merken" + "Route öffnen" |
| soldout | V4SoldoutBox | red stripe (restrained) | "Ähnliche Events" (anchor) |

All 8 covered. Mobile sticky-bar mirrors the same state→action map.

## Acceptance vs. Spec §8

- [x] /events/<slug> renders v4 layout for all 8 states (test-covered)
- [x] State-Box-Switch correct (match/lineup → gold ticket; free → green; doorsale → blue; etc.)
- [x] Mobile sticky-bar visible + correct per state (test-covered)
- [x] Banned-strings snapshot green for all 8 states
- [x] Only the 2 approved trust-copy strings in ticket-bearing surfaces
- [x] Friends-Avatars / RSVP-Counter NOT visible on event detail
- [x] `npm run build` succeeds, ISR marker intact
- [x] Slug-redirects + metadata still work (logic untouched)
- [x] v4-vitest suite (Phase 1+2+3) = 123 tests green
- [x] EventDetailV2 not imported in production code

## Open follow-ups (out of scope for Phase 3 PR)

1. **Lineup-Grid + Venue-Map snippet** — Phase 3.1. Currently `V4EventDetailContent` has only description + tags + similar-events anchor. Festival lineup display + small Mapbox-static venue snippet are wired-up steps for the next phase.
2. **`EventDetailV2.tsx` cleanup** — 963-LOC file stays on disk; eventual delete in a dedicated cleanup phase.
3. **`event-detail-loaders.ts` type-only imports from EventDetailV2** — clean up when the cleanup phase happens; harmless until then.
4. **Plan-Wizard route** — All "Abend planen" / "Plan öffnen" CTAs link to `/saved` as Phase-3 stubs. Phase 5 introduces the real Wizard.

## Status

Phase 3 ✓ — ready for branch push + PR. Vercel preview will be the real visual review surface.
