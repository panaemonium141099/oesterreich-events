# fn-11-social-features-launch-ready-uxlogic-fix.6 Groups Page: Event Links + Mobile Delete + Member Guard + Widget Cleanup

## Description
Fix the Groups page: make linked events navigate to `/events/[id]`, make contribution delete button visible on mobile, add member-only guard for chat/contributions, remove dead widget code.

**Size:** M
**Files:** `src/app/groups/[id]/page.tsx`

## Approach

**Event links (L858-875):**
- Currently only links to `source_url` (external). Add internal link to `/events/[id]` as primary, `source_url` as secondary "Original-Quelle" link.
- All events in the system have an internal ID — always link to `/events/[id]`.

**Contribution delete button (L810):**
- Currently `opacity-0 group-hover:opacity-100` — invisible on touch devices.
- Use `@media (hover: hover)` guard: show always on touch, hover-reveal on desktop.
- Pattern: `.action-btn { opacity: 1; } @media (hover: hover) { .action-btn { opacity: 0; } .card:hover .action-btn { opacity: 1; } }`
- Ensure touch target is minimum 44x44px.

**Member-only guard:**
- Non-members should see group info + "Beitreten" (join) prompt but NOT chat messages or contribution form.
- Wrap chat and contribution sections in a guard component that checks membership status.
- This is a UX guard only — Supabase RLS handles real security.

**Dead widget code:**
- Widget system has state defined but UI never rendered. Find and delete all widget-related state, types, and handlers.
- Verify no other file imports widget types from this page.

**Feedback:**
- Add toast for RSVP updates (currently no feedback on success/error).
- Add toast for contribution delete.

## Key context

- Group page is large (~900+ lines). Widget state is dead code bloat.
- Contribution delete button hover-only pattern is a common mobile UX anti-pattern.
- Member check likely available from existing Supabase query that loads group data.
## Acceptance
- [ ] Linked events navigate to `/events/[id]` (internal link always present)
- [ ] Contribution delete button visible on touch devices (no hover required)
- [ ] Delete button touch target >= 44x44px
- [ ] Non-members see group info but NOT chat or contribution form
- [ ] Non-members see "Beitreten" prompt
- [ ] All widget-related dead code removed
- [ ] Toast on RSVP update (success + error)
- [ ] Toast on contribution delete (success + error)
- [ ] `npm run build` passes (no broken imports from widget removal)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
