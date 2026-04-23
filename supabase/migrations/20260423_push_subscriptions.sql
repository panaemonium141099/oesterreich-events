-- Push-Subscriptions für Web-Push-Benachrichtigungen (nur Desktop/PC).
-- Eine Zeile pro (Nutzer × Browser). Endpoint ist global eindeutig; der
-- Unique-Constraint auf (user_id, endpoint) ist trotzdem günstig für Upserts.

set statement_timeout = '5min';

-- ───────────────────────────────────────────────────────────────
-- 1) Tabelle
-- ───────────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now()
);

create unique index if not exists push_subscriptions_user_endpoint_key
  on public.push_subscriptions (user_id, endpoint);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- ───────────────────────────────────────────────────────────────
-- 2) RLS — nur der Besitzer sieht / mutiert seine eigenen Subscriptions.
--    Die API-Route für Push-Versand läuft mit Service-Role und umgeht RLS.
-- ───────────────────────────────────────────────────────────────
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_own_select" on public.push_subscriptions;
drop policy if exists "push_subs_own_insert" on public.push_subscriptions;
drop policy if exists "push_subs_own_delete" on public.push_subscriptions;

create policy "push_subs_own_select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_subs_own_insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_subs_own_delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────
-- 3) Co-Owner: Admins dürfen den Plan editieren (UPDATE), aber nicht löschen.
--    Wir replacen defensive jede bestehende Update-Policy auf public.groups
--    durch eine, die Owner UND Admins akzeptiert. Delete bleibt Creator-only.
-- ───────────────────────────────────────────────────────────────
alter table public.groups enable row level security;

drop policy if exists "groups_update_owner"         on public.groups;
drop policy if exists "groups_update_owner_or_admin" on public.groups;

create policy "groups_update_owner_or_admin" on public.groups
  for update using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id
        and gm.user_id  = auth.uid()
        and gm.role     = 'admin'
    )
  ) with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id
        and gm.user_id  = auth.uid()
        and gm.role     = 'admin'
    )
  );

drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner" on public.groups
  for delete using (created_by = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- 4) Schema-Cache zweimal reloaden (PostgREST braucht manchmal einen zweiten Tritt)
-- ───────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
select pg_sleep(0.5);
notify pgrst, 'reload schema';

-- ───────────────────────────────────────────────────────────────
-- 5) Verifikation
-- ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'push_subscriptions'
      and column_name  = 'endpoint'
  ) then
    raise exception 'push_subscriptions table missing or incomplete';
  end if;
end
$$;
