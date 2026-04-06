# fn-11-social-features-launch-ready-uxlogic-fix.5 Event Detail: Dynamic Back Button + Social Actions

## Description
Fix the Event Detail page: replace hardcoded back-to-map with dynamic back button, add Save (bookmark) and Share social actions.

**Size:** M
**Files:** `src/app/events/[id]/page.tsx`

## Approach

**Back button (L154-159):**
- Currently hardcoded to `/map`. Replace with dynamic back navigation.
- Use `router.back()` with `window.history.length > 1` fallback to `/` (home).
- IMPORTANT: `window.history.length` must only be accessed in event handlers (not during render) to avoid hydration mismatch. The back button is a client component.
- Note: `history.length` is unreliable across browsers. A safer approach: store a `from` query param when navigating TO event detail, use it for back navigation. Fallback: `router.back()` then `/`.

**Social actions:**
- Add a Save/Bookmark toggle button. Use the bookmark icon pattern from `src/components/Feed/FeedItem.tsx`.
- Requires Supabase call to check if event is saved + toggle save state. Follow existing saved events API pattern.
- Add a Share button using Web Share API (`navigator.share()`) with fallback to "copy link" (`navigator.clipboard.writeText()`).
- Show toast on share success ("Link kopiert") and save toggle ("Event gespeichert" / "Event entfernt").
- Position: floating action bar or inline buttons near the event title area.
- Update background to use `bg-surface` token (currently `bg-gray-950`).

## Key context

- Event detail page is SSR (`generateMetadata`). Social action bar must be a `'use client'` island component.
- The page currently has ZERO social integration — no save, no share, no social context.
- `window.history` access during SSR/render will cause hydration errors. Only use in event handlers or `useEffect`.
- Web Share API is available on mobile browsers and modern desktop Chrome/Edge. Safari desktop does NOT support it — need clipboard fallback.
## Acceptance
- [ ] Back button navigates to previous page (not always `/map`)
- [ ] Back button fallback works when user has no history (direct URL visit)
- [ ] Save/bookmark button toggles saved state with toast feedback
- [ ] Share button uses Web Share API on supported browsers
- [ ] Share button falls back to "copy link" on unsupported browsers
- [ ] Toast appears on share/copy action
- [ ] No hydration errors from `window.history` access
- [ ] Page background uses `bg-surface` token
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
