-- ─────────────────────────────────────────────────────────────────
-- Phase 5 — Plan-Wizard + Meine Pläne
-- ─────────────────────────────────────────────────────────────────
--
-- Zwei Tabellen:
--   plans       — der "Abend-Plan" mit Name, Datum, optional Notiz
--   plan_items  — N:M-Bridge zwischen plan und event (mit Position)
--
-- RLS: jeder User sieht/editiert nur seine eigenen Pläne.

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  plan_date date not null,
  note text,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade not null,
  event_id uuid references events(id) not null,
  position int not null default 0,
  added_at timestamptz not null default now(),
  unique(plan_id, event_id)
);

create index if not exists idx_plans_user_date on plans(user_id, plan_date desc);
create index if not exists idx_plan_items_plan on plan_items(plan_id, position);

alter table plans enable row level security;
drop policy if exists "users own their plans" on plans;
create policy "users own their plans" on plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table plan_items enable row level security;
drop policy if exists "users own their plan_items via plan" on plan_items;
create policy "users own their plan_items via plan" on plan_items for all
  using (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()));

create or replace function plans_set_updated_at() returns trigger
  language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists plans_set_updated_at_trg on plans;
create trigger plans_set_updated_at_trg before update on plans
  for each row execute function plans_set_updated_at();
