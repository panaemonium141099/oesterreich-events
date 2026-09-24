-- Handverlesene Events für die Saison-Karte im Landing-Hero.
--
-- Admins pinnen hier Events (bezahlte Platzierung oder eine eigene
-- Saison-Auswahl), die VOR der automatischen Saison-Rotation stehen.
-- Bewusst eigene Tabelle statt Spalten auf events (~280k Zeilen): die
-- Landing liest nur die paar aktiven Zeilen, is_boosted bleibt der
-- Karten-/Carousel-Boost und hat andere Wirkung.
--
-- Lesen: öffentlich (die Landing ist eine ISR-Shell mit Anon-Client).
-- Schreiben: nur über /api/admin/landing-feature mit Service-Role nach
-- Rollencheck, deshalb keine Insert/Update/Delete-Policy.

create table if not exists public.landing_features (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id)
);

create index if not exists landing_features_active_idx
  on public.landing_features (starts_at, ends_at);

alter table public.landing_features enable row level security;

drop policy if exists landing_features_public_read on public.landing_features;
create policy landing_features_public_read
  on public.landing_features for select
  using (true);

grant select on public.landing_features to anon, authenticated;
grant all on public.landing_features to service_role;
