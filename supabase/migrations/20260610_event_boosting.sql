-- Event-Boosting (Phase 2 der Firmen-Monetarisierung).
-- Ein geboostetes Event wird auf der Karte NICHT geclustert und mit einem
-- auffälligen Marker hervorgehoben; in den featured/score-Listen rankt es vor.
--
-- WICHTIG (Performance): Die Default-Map-Query läuft über
-- idx_events_map_publishable_v2 (ORDER BY start_date, id). Diese Sortierung
-- wird NICHT verändert — Boosting wirkt rein über das Flag + Map-Rendering,
-- nicht über die Default-Sortierung. Nur featured + sort=score ranken boosted-first.

set statement_timeout = '5min';

-- ───────────────────────────────────────────────────────────────
-- 1) Spalten
-- ───────────────────────────────────────────────────────────────
alter table public.events
  add column if not exists is_boosted boolean not null default false,
  add column if not exists boost_until timestamptz,
  add column if not exists boost_tier  text;

-- boost_tier: optional, welches Paket den Boost trägt (für Reporting).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_boost_tier_check'
  ) then
    alter table public.events
      add constraint events_boost_tier_check
      check (boost_tier is null or boost_tier in ('boost', 'abo', 'scraper'));
  end if;
end
$$;

-- ───────────────────────────────────────────────────────────────
-- 2) Partial-Index — nur die (wenigen) geboosteten Events.
--    Klein & günstig; beschleunigt boosted-first ORDER BY und das
--    Ableiten der Boosted-IDs.
-- ───────────────────────────────────────────────────────────────
create index if not exists idx_events_boosted
  on public.events (start_date)
  where is_boosted = true;

-- ───────────────────────────────────────────────────────────────
-- 3) RLS — Boosting wird ausschließlich serverseitig (Service-Role
--    Admin-API) gesetzt. Keine neue Policy nötig: die bestehende
--    events-UPDATE-Policy (created_by = auth.uid() OR is_god()) bleibt;
--    die Admin-API umgeht RLS via Service-Role nach eigenem Rollencheck.
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
      and table_name   = 'events'
      and column_name  = 'is_boosted'
  ) then
    raise exception 'events.is_boosted column missing';
  end if;
end
$$;
