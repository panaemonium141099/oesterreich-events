# fn-11-social-features-launch-ready-uxlogic-fix.7 Messages + Memories: Error Handling + DM Friend Validation

## Description
Fix error handling in Messages and Memories pages: add try/catch with toast feedback to message sending, validate DM recipient is friend, add toast for memory photo upload errors.

**Size:** M
**Files:** `src/app/messages/` (conversation page), `src/app/memories/` (memory detail or upload page)

## Approach

**Messages — send error handling:**
- Message sending currently has no try/catch. If Supabase insert fails, the optimistic message disappears without feedback.
- Wrap send in try/catch, show `toast.error('Nachricht konnte nicht gesendet werden')` on failure.
- Consider optimistic UI: show message immediately, revert on error with toast.

**Messages — DM friend validation:**
- Before rendering compose UI, check if recipient is in user's friend list.
- If not friend: show "Ihr muesst Freunde sein um Nachrichten zu senden" message with option to send friend request.
- This prevents strangers from DMing via URL manipulation (`/messages/[userId]`).
- Check if friend list data is already available in the page, or if a new query is needed.

**Memories — photo upload errors:**
- Photo upload errors are currently swallowed (no user feedback).
- Add try/catch around upload, show `toast.error('Foto konnte nicht hochgeladen werden')` on failure.
- Show `toast.success('Foto hochgeladen')` on success.

## Key context

- Messages page likely uses Supabase Realtime for live updates — error handling must not break the subscription.
- DM friend validation is a UX guard. Supabase RLS should enforce the actual security (not in scope here).
- Memory photo upload may use Supabase Storage — check the existing upload pattern.
## Acceptance
- [ ] Message send failure shows toast error (not silent)
- [ ] Message send success does NOT show toast (normal flow, no need)
- [ ] Non-friend visiting `/messages/[userId]` sees friend-required message
- [ ] Non-friend can send friend request from the DM page
- [ ] Memory photo upload failure shows toast error
- [ ] Memory photo upload success shows toast confirmation
- [ ] Supabase Realtime subscription not broken by error handling changes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
