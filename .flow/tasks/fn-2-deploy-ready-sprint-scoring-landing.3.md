# fn-2-deploy-ready-sprint-scoring-landing.3 Stats Counts API & WeeklyHighlights Component

## Description
Create a single `/api/stats/counts` endpoint returning all region and category event counts in one Supabase query. Build the `WeeklyHighlights` landing section as a CSS scroll-snap carousel fetching from `/api/events/featured`.

**Size:** M
**Files:** `src/app/api/stats/counts/route.ts` (new), `src/components/Landing/WeeklyHighlights.tsx` (new)

## Approach

**`/api/stats/counts`:** Single Supabase query using `GROUP BY` to return counts per bundesland and per category in one round-trip. Response shape: `{ regions: { Wien: 1234, ... }, categories: { Musik: 456, ... } }`. Filter `start_date >= today` to count only upcoming events. Use service role client (same pattern as `src/app/api/events/route.ts:9-12`). Add `Cache-Control: public, max-age=3600` header to avoid repeated DB calls.

**`WeeklyHighlights`:** `"use client"` component (Framer Motion requires client). Fetches `/api/events/featured?limit=8` on mount. Horizontal CSS scroll-snap container (`scroll-snap-type: x proximity`, `overflow-x: auto`). Each card: `next/image` (80x80 thumbnail), title (truncated at 2 lines), formatted date (`src/lib/utils/date.ts`), location_name, category badge with color from existing `src/lib/categories.ts`. Framer Motion `whileInView` fade-in on the section container (`viewport={{ once: true }}`). Shows loading skeleton while fetching. Shows "Keine Highlights verfügbar" if empty. "Alle Events entdecken →" link to `/map` at the end.

## Key Context
- Existing category colors: check `src/lib/categories.ts` for the `categoryColors` or similar export — reuse those for badges
- Date formatting: use `formatDate()` from `src/lib/utils/date.ts` — already used throughout the app
- Existing landing components in `src/components/Landing/` are all client components except `LandingStats.tsx` (server component) — `WeeklyHighlights` should be `"use client"` for Framer Motion
- `scroll-snap-type: x proximity` (not `mandatory`) — mandatory can trap users, proximity feels natural
- Do NOT add the component to `page.tsx` in this task — that's Task 4
## Acceptance
- [ ] `GET /api/stats/counts` returns `{ regions: {...}, categories: {...} }` with counts for all 9 Bundeslaender and 13 categories
- [ ] Response has `Cache-Control: public, max-age=3600` header
- [ ] `WeeklyHighlights` component renders scroll-snap carousel with event cards
- [ ] Each card shows: image (next/image), title, date, location, category badge
- [ ] Loading skeleton shown while fetching
- [ ] Empty state: "Keine Highlights verfügbar" shown if API returns 0 events
- [ ] "Alle Events entdecken →" link present
- [ ] Framer Motion viewport fade-in animation works (`viewport={{ once: true }}`)
- [ ] `npm run build` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
