# fn-11-social-features-launch-ready-uxlogic-fix.3 Friends Page: Profile Links + Action Feedback

## Description
Fix the Friends page: make friend names/avatars clickable to view profile, add toast feedback for all friend request actions (send/accept/reject).

**Size:** M
**Files:** `src/app/friends/page.tsx`

## Approach

- Wrap friend name + avatar in each friend row with `<Link href="/profile/[userId]">` (check if `/profile/[userId]` route exists; if not, use appropriate route)
- Style the link so it looks like current design (no underline, hover effect)
- Add toast feedback to all friend request mutations:
  - Send request: `toast.success('Freundschaftsanfrage gesendet')`
  - Accept request: `toast.success('Freundschaftsanfrage angenommen')`
  - Reject request: `toast.success('Anfrage abgelehnt')`
  - Error cases: `toast.error('Fehler bei der Anfrage')` (currently NO error handling)
- Update background to `bg-surface` token (currently hardcoded `bg-[#141416]`)

## Key context

- Friends page has tabs: friends list, incoming requests, outgoing requests
- Each friend row already has a "Nachricht" (message) link — the name/avatar should also be clickable
- Friend request actions currently have zero feedback — no toast, no animation, no state change indication
- Check if a user profile viewing route exists (e.g., `/profile/[id]` or `/users/[id]`)
## Acceptance
- [ ] Clicking friend name or avatar navigates to their profile
- [ ] Toast appears after sending friend request
- [ ] Toast appears after accepting friend request
- [ ] Toast appears after rejecting friend request
- [ ] Toast appears on any friend action error
- [ ] Page background uses `bg-surface` token
- [ ] Existing "Nachricht" link still works
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
