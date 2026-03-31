# Audit: Event Planner Features (2026-03-30)

## Files Audited
1. `src/app/memories/page.tsx`
2. `src/app/memories/[id]/page.tsx`
3. `src/app/groups/page.tsx`
4. `src/app/groups/[id]/page.tsx`
5. `src/components/Map/EventMap.tsx`
6. `src/components/Layout/SocialNav.tsx`

## Issues Found & Fixed

### A. Logic & Data

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `memories/page.tsx` | Object URL memory leak: `URL.createObjectURL()` called inline in JSX on every render, never revoked | Added `useMemo` for preview URLs + `useEffect` cleanup with `URL.revokeObjectURL()` |
| 2 | `EventMap.tsx` | God filter searched `email` field from profiles table -- privacy concern and likely blocked by RLS | Removed `email.ilike` from the `.or()` filter, now searches only `first_name` and `last_name` |
| 3 | `groups/[id]/page.tsx` | `setTimeout` for invite code copy feedback not cleaned up on unmount | Added `useRef` for timer + cleanup `useEffect` |

**Verified OK (no issues found):**
- Memory creation inserts into all 3 tables (memories, memory_participants, memory_photos)
- Notifications created for participants on memory/group creation
- Activities created for feed on memory/group creation
- RSVP updates save to DB and refresh members list
- Group chat realtime subscription set up correctly with proper cleanup via `supabase.removeChannel(channel)`
- Planned events markers fetch correctly via group_members JOIN
- Location coordinates properly passed to Mapbox static image URL (lng,lat order correct)
- Supabase client is cached singleton -- safe as useCallback/useEffect dependency
- No `dangerouslySetInnerHTML` usage anywhere
- Supabase queries are parameterized (no string interpolation in SQL)
- God-role check uses `isGod` from auth context which derives from `profile?.role === 'god'`
- No `console.log` statements in any audited file

### B. UI/UX Pro Max Compliance

| # | File(s) | Issue | Fix |
|---|---------|-------|-----|
| 4 | `memories/page.tsx` | Glassmorphism: used `bg-white/5 border border-white/10` instead of `bg-white/[0.03] border border-white/[0.06]` | Replaced all occurrences |
| 5 | `memories/[id]/page.tsx` | Same glassmorphism issue | Replaced all occurrences |
| 6 | `groups/page.tsx` | Same glassmorphism issue | Replaced all occurrences |
| 7 | `groups/[id]/page.tsx` | Same glassmorphism issue on empty state containers | Replaced selectively (kept bg-white/5 on interactive form elements) |
| 8 | `memories/page.tsx` | Loading state used spinner instead of skeleton screen | Replaced with 3-item skeleton with pulse animation |
| 9 | `memories/[id]/page.tsx` | Loading state used spinner instead of skeleton screen | Replaced with structured skeleton matching page layout |
| 10 | `groups/page.tsx` | Loading state used spinner instead of skeleton screen | Replaced with card-shaped skeleton matching event list layout |
| 11 | `groups/[id]/page.tsx` | Loading state used spinner instead of skeleton screen | Replaced with structured skeleton matching dashboard layout |
| 12 | ALL files | Missing `prefers-reduced-motion` support on all `animate-spin` spinners | Added `motion-reduce:animate-none` to every spinner |
| 13 | `groups/page.tsx` | Missing reduced-motion on `active:scale-95` press feedback | Added `motion-reduce:transform-none` |
| 14 | `groups/[id]/page.tsx` | Same active:scale-95 issue | Added `motion-reduce:transform-none` |
| 15 | `EventMap.tsx` | Planned event marker hover scale animation ignored reduced-motion | Added `prefers-reduced-motion` media query check, conditionally applies transition and hover handlers |
| 16 | `SocialNav.tsx` | Tooltip `animate-fade-in` lacked reduced-motion support | Added `motion-reduce:animate-none` |
| 17 | `memories/page.tsx` | Photo delete button too small (w-4 h-4 = 16px, minimum is 44px touch target) | Increased to w-6 h-6 with proper positioning |

**Verified OK:**
- No emoji used as icons anywhere -- all SVG inline icons
- All nav touch targets >= 44px (w-11 h-11 = 44px)
- All animations use 150-300ms durations with ease-out timing
- Error/empty states have icon + helpful text
- Consistent 4px grid spacing
- Color contrast adequate (white on dark backgrounds)

### C. Code Quality

| # | File | Issue | Fix |
|---|------|-------|-----|
| -- | -- | No console.log found | -- |
| -- | -- | No unused imports found | -- |
| -- | -- | No TypeScript errors (build passes) | -- |
| -- | -- | All subscriptions cleaned up in useEffect returns | -- |

### D. Security

| # | File | Issue | Fix |
|---|------|-------|-----|
| 2 | `EventMap.tsx` | God filter queried `email` field -- exposes PII to client | Removed email from search query |

**Verified OK:**
- No `dangerouslySetInnerHTML` usage
- All Supabase queries use parameterized builders
- God-role gated by auth context `isGod` flag

## Build Result

```
npx next build -- Compiled successfully in 9.1s
All 30 static pages generated. Zero TypeScript errors.
```

Pre-existing warning (not related to audit): missing `src/scripts/validate-events.js` dynamic import in admin scrapers route.

## Summary

**17 issues found and fixed** across 6 files:
- 3 logic/data bugs (memory leak, privacy leak, timer cleanup)
- 13 UI/UX compliance issues (glassmorphism values, skeleton screens, reduced-motion)
- 1 security issue (email field exposure in god filter)
