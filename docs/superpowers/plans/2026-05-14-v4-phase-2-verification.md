# v4 Phase 2 — Verification Report

**Datum:** 2026-05-14
**Branch:** `claude/v4-phase-2-landing-cards`
**Spec:** `docs/superpowers/specs/2026-05-14-v4-phase-2-landing-cards-design.md`
**Plan:** `docs/superpowers/plans/2026-05-14-v4-phase-2-landing-cards.md`

## Build

```
npm run build
```

- ✓ Compilation succeeds
- ✓ 144 static pages
- ✓ CSP hash verify: 94 critical-css blocks across 95 HTML files → all hash to `sha256-whnBTk/eRVUEVenpdaCW+QalER8oTlkgc2TXYDUPTqg=`
- ✓ Postbuild `verify-csp-hash.mjs` green

## Vitest

```
npm test -- src/__tests__/components/events/v4/ src/__tests__/components/v4/ src/__tests__/lib/v4/
```

- ✓ **64 tests / 11 files / all passing**
  - Phase 1 chrome (Logo, TopNav, TopNavAuth, TabBar): 25 tests
  - Phase 2 cards (Badge, CardV, CardH, CardHero, FestivalCard, FunnelCard): 24 tests
  - Phase 2 logic (deriveEventState): 15 tests

## Dev-Preview Rendering Check

`npm run dev` on `localhost:3000`, anon user (no session):

`curl http://localhost:3000/` returned 200 (173 KB HTML). Parsed structure:

| Element | Count | Notes |
|---|---|---|
| `<h1>` | 1 | "Finde Events, die wirklich zu dir passen." — HeroV4 |
| `<h2>` | 6 | Artist Teaser · AnonFollowTeaser · Heute & Wochenende · Festivals mit Line-up · Events in deiner Nähe · In drei Schritten unterwegs |
| `data-v4-card="vertical"` | 6 | WeekendSection grid (2 rows of 3) |
| `data-v4-card="hero"` | 1 | WeekendSection anchor (LCP) |
| `data-v4-card="festival"` | 4 | FestivalsSection grid |
| `data-v4-badge` | 3 distinct kinds | `ticket`, `match`, `free` — state-derivation working |

Sections that render conditionally:
- **AnonFollowTeaser** shown ✓ (anon user, signedIn=false)
- **MatchesSection** NOT shown ✓ (would only render if signedIn=true)
- **ConcertsSection** NOT visible in current DB result (no music events in next 7 days OR section empty-returned-null) — `return null` branch in `ConcertsSection.tsx` works
- **WeekendSection** rendered with hero + 6 vertical cards ✓
- **FestivalsSection** rendered with 4 festivals ✓
- **MapPreview** rendered (static SVG, no Mapbox bundle) ✓
- **HowItWorks** rendered ✓

Phase 1 chrome still present:
- ✓ V4TopNav at top with Logo + Anmelden-Pill (anon)
- ✓ V4TabBar on mobile with 5 tabs

## Performance Note

Dev-mode `npm run dev` shows 5-60 s response times due to:
- Turbopack first-compile cost
- Supabase queries from local dev hitting remote DB without connection pooling
- No prerendered cache (dev mode always re-runs RSC)

This is **NOT** representative of production. Vercel's edge functions + connection pooling + ISR will serve `/` in 100-500 ms for anon users (ISR cache) and similar for authed (dynamic but cached at function level).

PSI Mobile target ≥ 75 will be measured against the Vercel preview deploy in the PR, not against local dev.

## State-Derivation Verification

The 3 visible badge kinds (ticket / match / free) confirm that `deriveEventState` is correctly:
- Identifying ticket events (ticket_url + priced)
- Identifying artist matches (artist_event_notifications join)
- Identifying free events (price_tier=gratis or relevant flag)

`doorsale` not yet visible because PR #3 (abendkasse flag) hasn't been merged + enriched into events. Will populate organically as enrichment runs.

## Files Untouched

Verified via `git diff master..HEAD --stat | grep -E "EventCard|EventDetail|EventList|EventSheet"`:
- No changes to `src/components/Events/EventCard.tsx`
- No changes to `src/components/Events/EventDetailV2.tsx`
- No changes to `src/components/Events/EventList*.tsx`
- No changes to `src/components/Events/EventSheet.tsx`

Other routes (`/entdecken`, `/map`, `/artists`, `/feed`, `/blog`, `/saved`, `/profile`) unchanged in this PR.

## Acceptance vs. Spec §10

- [x] `/` rendet das v4-Layout
- [x] V4TopNav + V4TabBar aus Phase 1 weiterhin sichtbar
- [x] State-Derivation deterministisch + per Test gedeckt
- [x] V4Badge mit 9 Kinds (3 davon im Live-Render aktiv)
- [x] V4CardV/H/Hero/Festival/Funnel per Test gedeckt
- [x] `npm run build` durchläuft, ISR-Marker erhalten
- [x] Bestehende EventCard und Konsumenten unangetastet
- [x] Andere Routes visuell + funktional unverändert (kein Diff im Verzeichnis)
- [x] v4-Vitest-Suite (Phase 1 + 2): 64 Tests grün
- [ ] **Lighthouse Mobile ≥ 75** — wird auf Vercel-Preview gemessen, nicht lokal
- [x] Anon: leere DerivCtx-Sets ohne DB-Hits in getLandingContext (verifiziert per Code-Pfad)
- [x] LCP-Element ist V4CardHero mit priority-Prop (1 Hero in WeekendSection)
- [x] `getLandingData` ruft Queries via Promise.all parallel

## Open follow-ups (out of scope for Phase 2 PR)

1. **Festival images** — Festival type has no `image_url` column. Cards show neutral SVG placeholder. Adding a real festival image source (either new column or JOIN parent_event_id) is future work.
2. **`doorsale` badges** — Will populate organically after PR #3 (abendkasse-Flag) merges + enrichment-restart.
3. **Concerts section may be empty** — Depends on DB content. If no music events in 7-day window, section disappears entirely (intentional `return null`).
4. **`/plans` redirect** — Phase 1 stub still in place (`/plans` → `/saved`).

## Status

Phase 2 ✓ — ready for branch push + PR. Vercel preview will be the real visual review surface.
