# fn-11-social-features-launch-ready-uxlogic-fix.8 Profile + Artists: Dead Button Removal + Dark Theme + Avatar Feedback

## Description
Fix Profile page (remove dead Facebook button, add avatar upload feedback) and convert Artists page from light to dark theme.

**Size:** M
**Files:** `src/app/profile/page.tsx`, `src/app/artists/page.tsx`, `src/components/Artists/ArtistCard.tsx`, `src/components/Artists/ArtistSearch.tsx`, `src/components/Artists/ImportedArtistsList.tsx`, `src/components/Artists/ArtistEventsSection.tsx`

## Approach

**Profile — Facebook button (L404-423):**
- Remove the entire Facebook "Verbinden" button. It has no `onClick` handler and no Facebook App ID configured.
- Clean up any related state or imports.

**Profile — Avatar upload feedback:**
- Avatar upload errors currently only logged to `console.log`. Add `toast.error('Avatar konnte nicht hochgeladen werden')` in catch block.
- Add `toast.success('Avatar aktualisiert')` on success.
- Update background to `bg-surface` token.

**Artists page — dark theme conversion:**
- Currently uses light theme: `bg-[#f8fafc] text-slate-800`
- Convert to dark theme matching other social pages: `bg-surface text-white`
- Update all sub-components (ArtistCard, ArtistSearch, ImportedArtistsList, ArtistEventsSection) to dark variants.
- This is theme-only — no feature changes to Artists page.
- Follow existing dark patterns from other social pages (text colors, border colors, input styles).

## Key context

- Profile page Facebook button at L404-423 is a `<button>` with icon but zero functionality.
- Artists page is the ONLY social page with light theme — all others are dark.
- Artists sub-components may use light-specific colors (slate, gray on white) that need dark equivalents.
- Artists page scope: theme ONLY, no feature changes.
## Acceptance
- [ ] Facebook "Verbinden" button removed from profile
- [ ] No dead Facebook-related code remains
- [ ] Avatar upload error shows toast
- [ ] Avatar upload success shows toast
- [ ] Profile background uses `bg-surface` token
- [ ] Artists page uses dark theme (`bg-surface`, white/gray text)
- [ ] All Artists sub-components converted to dark theme
- [ ] Artists page functionality unchanged (search, follow, events still work)
- [ ] No light-on-light or dark-on-dark contrast issues
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
