# fn-1-comprehensive-audit-and-feature-upgrade.4 Code Deduplication and Dead Dependency Cleanup

## Description
Extract duplicated code into shared utilities and remove dead dependencies. Key duplications: `formatDate`/`formatTime` in 23+ files, `isProfileComplete` in 2 locations, date formatting with midnight/1am handling. Remove Leaflet dependencies that remain after Mapbox migration.

**Size:** M
**Files:** src/lib/utils/date.ts (new), src/lib/utils/profile.ts (new), src/components/Events/EventCard.tsx, src/components/Events/EventDetail.tsx, src/lib/supabase/auth-context.tsx, src/app/auth/callback/route.ts, package.json

## Approach
- Create `src/lib/utils/date.ts` with shared `formatDate()`, `formatTime()`, `formatDateRange()` — extract from EventCard.tsx (the midnight/1am handling logic)
- Create `src/lib/utils/profile.ts` with `isProfileComplete()` — single source of truth, currently duplicated in auth-context.tsx:35 and callback/route.ts:22
- Replace all ~23 usages of inline date formatting with the shared utility
- Remove dead Leaflet deps from package.json: `leaflet`, `react-leaflet`, `react-leaflet-cluster`, `@types/leaflet`
- Check if `src/components/Map/EventMarker.tsx` still imports from react-leaflet — if so, migrate or remove
- Run `npm run build` to verify no breakage

## Key context
- `formatDate()` and `formatTime()` both handle midnight (00:00) and 1am as "no time specified" — this is an important business rule
- Date formatting uses `de-AT` locale throughout — the shared utility must maintain this
- EventMarker.tsx may still use react-leaflet even though EventMap.tsx uses Mapbox — check before removing
## Acceptance
- [ ] `src/lib/utils/date.ts` created with `formatDate`, `formatTime`, `formatDateRange`
- [ ] `src/lib/utils/profile.ts` created with `isProfileComplete`
- [ ] All duplicate date formatting replaced with shared utility (verify via grep)
- [ ] Profile completeness check uses single source of truth
- [ ] Leaflet dependencies removed from package.json (if no longer used)
- [ ] EventMarker.tsx migrated away from react-leaflet or removed if unused
- [ ] `npm run build` succeeds
- [ ] No functional regression in date display or profile checks
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
