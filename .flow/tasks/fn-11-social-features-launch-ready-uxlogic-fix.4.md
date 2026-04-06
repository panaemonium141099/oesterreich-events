# fn-11-social-features-launch-ready-uxlogic-fix.4 Feed Page: Event Navigation + End Indicator + Report Cleanup

## Description
Fix the Feed page: change event click destination from `/map?eventId=...` to `/events/[id]`, add "end of feed" indicator, remove non-functional report button from PostMenu.

**Size:** M
**Files:** `src/app/feed/page.tsx`, `src/components/Feed/FeedEventMiniCard.tsx`, `src/components/Feed/PostMenu.tsx`

## Approach

- In `feed/page.tsx` (~L110-112): change `router.push('/map?search=&eventId=${eventId}')` to `router.push('/events/${eventId}')`
- In `FeedEventMiniCard.tsx`: update `onEventClick` handler to navigate to `/events/[id]` instead of `/map`
- Add "end of feed" indicator: when no more items to load, show a subtle message like "Du hast alles gesehen" with a small illustration or divider. Reference existing empty state patterns.
- In `PostMenu.tsx` (~L64-69): remove the "Melden" (report) button entirely — it currently only calls `setOpen(false)` with no actual report functionality. Removing is more honest than a no-op.
- Update background to `bg-surface` token (currently `bg-[#0a0a0c]` — will match since #0a0a0c IS the surface token)

## Key context

- Feed page at L110 uses `router.push('/map?search=&eventId=${eventId}')` — this navigates AWAY from feed context, losing scroll position
- `FeedEventMiniCard.tsx` fires `onEventClick` which the parent handles with the map navigation
- PostMenu "Melden" button (L64-69) is a confirmed no-op — just closes menu
- Feed already has infinite scroll with `FeedSkeleton` — the end indicator goes after the last item when `hasMore` is false
## Acceptance
- [ ] Clicking event in feed navigates to `/events/[id]` (not `/map`)
- [ ] "Melden" button removed from PostMenu
- [ ] "End of feed" indicator shows when all posts are loaded
- [ ] Empty feed state is handled (zero posts)
- [ ] Feed scroll position is preserved when navigating back (verify with browser back)
- [ ] Page background uses `bg-surface` token
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
