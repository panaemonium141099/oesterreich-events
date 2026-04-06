# fn-11-social-features-launch-ready-uxlogic-fix.2 Saved Page: Click Navigation + Bookmark Icon + Toast Feedback

## Description
Fix the Saved page: make event cards clickable, replace heart icon with bookmark, add toast feedback on unsave.

**Size:** M
**Files:** `src/app/saved/page.tsx`, `src/app/saved/loading.tsx`

## Approach

- Wrap each saved event card in `<Link href="/events/[id]">` for navigation
- The unsave/remove button must use `e.stopPropagation()` + `e.preventDefault()` to prevent Link navigation when clicking remove
- Replace heart icon with bookmark icon (follow the pattern in `src/components/Feed/FeedItem.tsx` which already uses filled/unfilled bookmark)
- Add `toast.success('Event entfernt')` after successful unsave
- Add `toast.error('Fehler beim Entfernen')` in catch block (currently errors are silently swallowed)
- Update background to `bg-surface` token (currently hardcoded `bg-[#141416]`)

## Key context

- Saved page currently renders items as non-clickable divs with only a heart-remove action
- `FeedItem.tsx` already has the correct bookmark icon pattern — reuse that icon choice
- Nested interactive elements (button inside Link) need careful event handling to avoid accessibility issues
## Acceptance
- [ ] Clicking a saved event card navigates to `/events/[id]`
- [ ] Unsave button uses bookmark icon (not heart)
- [ ] Unsave button click does NOT trigger card navigation
- [ ] Toast appears on successful unsave ("Event entfernt" or similar)
- [ ] Toast appears on unsave error
- [ ] Page background uses `bg-surface` token
- [ ] Loading state background matches page background
## Done summary
Saved page now navigates to /events/[id] on card click, uses bookmark icon (not heart), shows toast feedback on unsave/error, and uses bg-surface theme token.
## Evidence
- Commits: 8b0660e8121244e37545d91483d05651485cbf13
- Tests: npm test -- --run (547 passed)
- PRs: