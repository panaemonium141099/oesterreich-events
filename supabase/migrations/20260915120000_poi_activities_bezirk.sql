-- Bezirks-Filter fuer /aktivitaeten (2026-09-15).
--
-- Die Uebersichtsseite bekommt ein Filter-Modul mit Bezirks-Mehrfachauswahl
-- unterhalb des Bundeslands. Dafuer traegt jeder POI seinen kanonischen
-- Bezirk (lowercase, Vokabular DISTRICTS_BY_BUNDESLAND == events.district),
-- abgeleitet aus der Gemeinde-Registry-Zeile seines gemeinde_slug
-- (src/lib/activities/bezirk.ts). Der woechentliche Import schreibt die
-- Spalte ab jetzt mit; den Bestand fuellt einmalig
-- `npm run backfill:activity-bezirk` (gleiche TS-Ableitung, kein zweiter
-- Rechenweg in SQL).
--
-- ANWENDUNG: per psql auf dem Hetzner-Server (Maintenance-SQL geht nicht
-- ueber PostgREST), danach NOTIFY pgrst — sonst kennt PostgREST die neue
-- Spalte/View nicht.

alter table public.poi_activities
  add column if not exists bezirk text;

comment on column public.poi_activities.bezirk is
  'Kanonischer Bezirk (lowercase, Vokabular DISTRICTS_BY_BUNDESLAND wie events.district), '
  'aus der Gemeinde-Registry via src/lib/activities/bezirk.ts. NULL = nicht ableitbar (Wien).';

-- Filterpfad /api/activities?bundesland=..&bezirk=a,b (nur sichtbare Rows).
create index if not exists poi_activities_bundesland_bezirk_visible_idx
  on public.poi_activities (bundesland, bezirk)
  where visible;

-- Facetten fuers Filter-Modul: Bezirke je Bundesland mit Anzahl sichtbarer,
-- nicht geschlossener POIs. Wird vom ISR-Render der Uebersichtsseite gelesen
-- (Service-Role, 1 h gecacht) — ein GROUP BY, den PostgREST selbst nicht
-- kann. Bewusst ohne anon-Grant: der Public-Pfad ist ausschliesslich die
-- Seite.
create or replace view public.poi_activity_bezirk_counts as
  select bundesland, bezirk, count(*)::int as n
  from public.poi_activities
  where visible and not is_closed and bezirk is not null
  group by bundesland, bezirk;

revoke all on public.poi_activity_bezirk_counts from anon, authenticated;
grant select on public.poi_activity_bezirk_counts to service_role;

notify pgrst, 'reload schema';
