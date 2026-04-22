-- ============================================================================
-- Migration: group pinboard notes (interactive post-it wall per plan)
--
-- Replaces the flat `groups.notes` text field with a multi-user, multi-
-- sticky-note system. Each note has: content or image, a color, a small
-- rotation for "stuck on a corkboard" feel, and x/y position as 0-100
-- percentage of the board's width/height (makes responsiveness trivial).
--
-- Permission model on the group: 'all_members' (default, anyone invited
-- can pin) vs 'owner_only' (only the creator can pin — others read-only).
-- Set at creation time, editable later by the owner.
-- ============================================================================

-- ────────────────── Table ──────────────────

create table if not exists group_pinboard_notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text,
  image_url text,
  color text not null default 'creme'
    check (color in ('creme', 'sage', 'rose', 'lavender')),
  rotation real not null default 0,   -- radians, kept small (~ -0.08..0.08)
  position_x real not null default 50, -- 0-100 % of board width
  position_y real not null default 50, -- 0-100 % of board height
  z_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Either content or image_url must be non-empty; both is fine.
  constraint pinboard_has_content check (
    (content is not null and length(trim(content)) > 0)
    or image_url is not null
  )
);

create index if not exists idx_pinboard_notes_group on group_pinboard_notes(group_id);

-- ────────────────── Permission column on groups ──────────────────

alter table groups
  add column if not exists pinboard_permission text not null default 'all_members'
    check (pinboard_permission in ('all_members', 'owner_only'));

-- ────────────────── RLS ──────────────────

alter table group_pinboard_notes enable row level security;

-- Members can read all notes on their group
drop policy if exists "pinboard_notes_select" on group_pinboard_notes;
create policy "pinboard_notes_select"
  on group_pinboard_notes for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = group_pinboard_notes.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- Insert policy honors groups.pinboard_permission
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
        )
    )
  );

-- Users can update their own notes (content, position, color, rotation)
drop policy if exists "pinboard_notes_update_own" on group_pinboard_notes;
create policy "pinboard_notes_update_own"
  on group_pinboard_notes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete their own notes
drop policy if exists "pinboard_notes_delete_own" on group_pinboard_notes;
create policy "pinboard_notes_delete_own"
  on group_pinboard_notes for delete
  using (user_id = auth.uid());

-- Group creator can delete any note (moderation safety net)
drop policy if exists "pinboard_notes_delete_owner" on group_pinboard_notes;
create policy "pinboard_notes_delete_owner"
  on group_pinboard_notes for delete
  using (
    exists (
      select 1 from groups
      where groups.id = group_pinboard_notes.group_id
        and groups.created_by = auth.uid()
    )
  );

-- ────────────────── updated_at trigger ──────────────────

create or replace function set_updated_at_timestamp() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pinboard_notes_updated_at on group_pinboard_notes;
create trigger trg_pinboard_notes_updated_at
  before update on group_pinboard_notes
  for each row execute function set_updated_at_timestamp();

-- ────────────────── Seed existing notes into the pinboard ──────────────────
-- One-time: turn each existing groups.notes into a single creme-colored
-- post-it pinned in the center. Idempotent via the NOT EXISTS guard.

insert into group_pinboard_notes (group_id, user_id, content, color, position_x, position_y, rotation)
select
  g.id,
  g.created_by,
  g.notes,
  'creme',
  50,
  30,
  ((random() - 0.5) * 0.12)::real  -- -0.06 .. 0.06 radians (~ ±3.4°)
from groups g
where g.notes is not null
  and length(trim(g.notes)) > 0
  and not exists (
    select 1 from group_pinboard_notes pn where pn.group_id = g.id
  );

-- ────────────────── Realtime ──────────────────
-- Enable Supabase Realtime on this table so live collaborative pinning
-- works across connected clients.

alter publication supabase_realtime add table group_pinboard_notes;
