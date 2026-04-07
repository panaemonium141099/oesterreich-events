# fn-11-social-features-launch-ready-uxlogic-fix.9 Consistency Pass: Loading Skeletons + Auth States + Background Unification + Docs

## Description
Final consistency pass across all social pages: standardize loading states to skeletons, unify auth loading patterns, verify all backgrounds use theme tokens, update documentation.

**Size:** M
**Files:** `src/app/saved/loading.tsx`, `src/app/feed/loading.tsx`, `src/app/friends/page.tsx` (inline skeleton), `src/app/groups/[id]/page.tsx` (loading state), `src/app/memories/page.tsx` (loading state), `src/app/notifications/page.tsx` (loading state), `CHANGELOG.md`, `CLAUDE.md`

## Approach

**Loading state unification:**
- Replace all spinner-based loading states with skeleton screens.
- Follow the pattern in `src/components/Feed/FeedSkeleton.tsx` (Instagram-style skeletons).
- Each page needs a skeleton that matches its content layout (list pages = list skeleton, detail pages = detail skeleton).
- `loading.tsx` files: update background from `bg-black` to `bg-surface` with matching skeleton.
- Inline loading states (in page components): replace spinner divs with skeleton components.

**Auth loading standardization:**
- Check how each social page handles the auth loading state (before user data is available).
- Standardize: show skeleton while auth resolves, redirect to login if unauthenticated.
- Follow whatever pattern the majority of pages already use.

**Background verification:**
- Verify ALL social pages now use `bg-surface` or `bg-surface-elevated` tokens (not hardcoded hex).
- Check: feed, friends, saved, messages, memories, groups, notifications, profile, artists, events/[id].

**Documentation:**
- `CHANGELOG.md`: Add Phase 11 entry following existing pattern (`### Phase 11: Social Features Launch-Ready (2026-04-07)`) with features list and files changed table.
- `CLAUDE.md`: Add toast component path to "Wichtige Pfade" section if a new toast provider/hook file was created.
- Update heart→bookmark mention in CHANGELOG L752 if applicable.

**Build validation:**
- Run `npm run build` — must pass with zero TypeScript errors.
- Run `npm test` — all 547+ tests must pass.

## Key context

- Current loading inconsistency: Feed has `FeedSkeleton`, Friends has inline 4-pulse skeleton, Saved/Groups/Memories use centered spinner.
- CHANGELOG follows a strict pattern: `### Phase N: Title (date)`, features bullets, files table. See latest phase entry as template.
- CLAUDE.md paths use format: `- \`src/path/file.ts\` — description`
## Acceptance
- [ ] All social pages use skeleton loading (not spinners)
- [ ] All `loading.tsx` files use `bg-surface` background
- [ ] Auth loading pattern is consistent across all social pages
- [ ] No hardcoded hex background colors remain on social pages
- [ ] CHANGELOG.md has Phase 11 entry with all changes documented
- [ ] CLAUDE.md updated with toast component path (if new file created)
- [ ] `npm run build` passes with zero errors
- [ ] `npm test` passes (547+ tests)
- [ ] Manual spot-check: navigate between 3+ social pages, verify consistent look
## Done summary
Unified all social page loading states from spinners to content-matching skeleton screens, standardized auth loading patterns with SocialNav + page-layout skeletons, replaced all hardcoded hex page backgrounds with @theme tokens (bg-surface, bg-surface-elevated, bg-surface-inset), and added Phase 11 CHANGELOG entry.
## Evidence
- Commits: b8d19674236981774816e31de3f40744f4b788a4
- Tests: npm run build, npm test
- PRs: