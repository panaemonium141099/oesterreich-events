-- ============================================================================
-- Migration: pinboard "specific_users" permission variant
--
-- Extends the existing binary pinboard_permission ('all_members'|'owner_only')
-- with a third mode 'specific_users', which uses a new uuid[] column on
-- groups to list who (besides the owner) is allowed to pin.
--
-- The owner always retains pin rights regardless of mode.
-- ============================================================================

-- ────────────────── 1. Loosen the CHECK constraint ──────────────────

alter table groups drop constraint if exists groups_pinboard_permission_check;
alter table groups
  add constraint groups_pinboard_permission_check
  check (pinboard_permission in ('all_members', 'owner_only', 'specific_users'));

-- ────────────────── 2. New column for the allow-list ──────────────────

alter table groups
  add column if not exists pinboard_allowed_users uuid[] not null default '{}'::uuid[];

-- ────────────────── 3. Replace the insert policy with the 3-mode version ──

drop policy if exists "pinboard_notes_insert" on group_pinboard_notes;
create policy "pinboard_notes_insert"
  on group_pinboard_notes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from groups g
      join group_members gm on gm.group_id = g.id
      where g.id = group_pinboard_notes.group_id
        and gm.user_id = auth.uid()
        and (
          g.pinboard_permission = 'all_members'
          or (g.pinboard_permission = 'owner_only' and g.created_by = auth.uid())
          or (
            g.pinboard_permission = 'specific_users'
            and (
              g.created_by = auth.uid()
              or auth.uid() = any(g.pinboard_allowed_users)
            )
          )
        )
    )
  );
