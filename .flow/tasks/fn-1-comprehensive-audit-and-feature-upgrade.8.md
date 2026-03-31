# fn-1-comprehensive-audit-and-feature-upgrade.8 Multi-Tag System Frontend

## Description
Update the frontend to display and filter by multiple tags. Add multi-tag filter UI to FilterBar, show tag chips on EventCard and EventDetail, and update all event display components.

**Size:** M
**Files:** src/components/Filters/FilterBar.tsx, src/components/Events/EventCard.tsx, src/components/Events/EventDetail.tsx, src/components/UI/TagChip.tsx (new), src/app/map/page.tsx

## Approach
- Create `TagChip` component following existing glassmorphism style (`bg-white/[0.03] border border-white/[0.06]`)
- Update FilterBar: replace single category dropdown with multi-select tag filter — follow existing `min-h-[44px]` touch target convention
- Update EventCard: show up to 3 tag chips below title, overflow as "+N more"
- Update EventDetail: show all tags with clickable chips that filter the map
- Update map page to pass `tags[]` filter to events API
- Use category color mapping from existing `getCategoryColor()` for tag chips
- Maintain `motion-reduce:animate-none` on any tag animations

## Key context
- Current FilterBar at `src/components/Filters/FilterBar.tsx` has Gemeinde autocomplete and category/district/date filters
- EventCard uses `getCategoryColor()` for category-based styling — reuse for tags
- UI conventions: glassmorphism cards, 44px touch targets, skeleton loading, staggered animations with 30-40ms delay
- Dark theme: `text-white` with opacity variants, `bg-white/[0.03]` for card backgrounds
## Acceptance
- [ ] TagChip component created with category colors
- [ ] FilterBar supports multi-tag selection
- [ ] EventCard shows up to 3 tags with overflow indicator
- [ ] EventDetail shows all tags, clickable to filter
- [ ] Map page passes tags filter to API
- [ ] Touch targets ≥44px on all interactive elements
- [ ] `motion-reduce` support on tag animations
- [ ] `npm run build` succeeds
## Done summary
Implemented multi-tag frontend UI: TagChip component with category colors, TagFilter multi-select dropdown in FilterBar, EventCard showing up to 3 tags with overflow, EventDetail with clickable tag chips that filter the map, and map page passing tags[] to the API.
## Evidence
- Commits: ca907f77351e8cee2c8d95851351e82d80f952c7
- Tests: npx tsc --noEmit, npm run build
- PRs: