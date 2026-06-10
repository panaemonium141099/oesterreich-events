-- Business-Leads: Anfragen von Firmen über den /fuer-firmen Katalog.
-- Eine Zeile pro Kontaktformular-Absendung. Die Firma ist NICHT eingeloggt,
-- daher läuft der Insert über die API-Route mit Service-Role (umgeht RLS).
-- Öffentliches Lesen ist gesperrt; nur Admins/God dürfen Leads einsehen.

set statement_timeout = '5min';

-- ───────────────────────────────────────────────────────────────
-- 1) Tabelle
-- ───────────────────────────────────────────────────────────────
create table if not exists public.business_leads (
  id            uuid primary key default gen_random_uuid(),
  company       text not null,
  contact_name  text not null,
  email         text not null,
  phone         text,
  website       text,
  -- Gewünschtes Paket aus dem Katalog: boost | abo | scraper | unsure
  plan          text not null default 'unsure'
                  check (plan in ('boost', 'abo', 'scraper', 'unsure')),
  message       text,
  -- Bearbeitungsstatus für dich im Admin
  status        text not null default 'new'
                  check (status in ('new', 'contacted', 'won', 'lost')),
  source        text not null default 'fuer-firmen',
  user_agent    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists business_leads_status_idx
  on public.business_leads (status, created_at desc);

-- ───────────────────────────────────────────────────────────────
-- 2) RLS — kein öffentlicher Zugriff. Inserts kommen ausschließlich
--    über die Service-Role-API-Route. Admins/God dürfen lesen + updaten.
-- ───────────────────────────────────────────────────────────────
alter table public.business_leads enable row level security;

drop policy if exists "business_leads_admin_select" on public.business_leads;
drop policy if exists "business_leads_admin_update" on public.business_leads;

create policy "business_leads_admin_select" on public.business_leads
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'god')
    )
  );

create policy "business_leads_admin_update" on public.business_leads
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'god')
    )
  );

-- ───────────────────────────────────────────────────────────────
-- 3) Schema-Cache reloaden
-- ───────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
select pg_sleep(0.5);
notify pgrst, 'reload schema';

-- ───────────────────────────────────────────────────────────────
-- 4) Verifikation
-- ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'business_leads'
      and column_name  = 'plan'
  ) then
    raise exception 'business_leads table missing or incomplete';
  end if;
end
$$;
