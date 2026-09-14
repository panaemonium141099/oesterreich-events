-- fn-25 (Review §6): Ein Ortskonflikt wird nicht veröffentlicht. Als
-- DB-Regel, damit kein Schreibpfad (Sync, Backfill, Geocoder, Stale,
-- Admin) eine Konflikt-Zeile veröffentlicht lassen kann. Bestand vorher
-- bereinigt (892 künftige Konflikt-Zeilen standen als published, Prod
-- 2026-09-14, Snapshot snap_20260914_conflict_publish).
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>
set statement_timeout = '15min';
create table if not exists public.snap_20260914_conflict_publish as
  select id, publish_status, location_status, now() as fixed_at from public.events
  where location_status = 'conflict' and publish_status in ('published', 'published_low_confidence');
update public.events
  set publish_status = 'needs_review',
      location_resolution = case
        when location_resolution is null then null
        when coalesce(location_resolution->'reasons', '[]'::jsonb) ? 'location_conflict_withheld' then location_resolution
        else jsonb_set(location_resolution, '{reasons}', coalesce(location_resolution->'reasons', '[]'::jsonb) || '["location_conflict_withheld"]'::jsonb)
      end
  where location_status = 'conflict' and publish_status in ('published', 'published_low_confidence');
alter table public.events
  drop constraint if exists events_location_conflict_not_published,
  add constraint events_location_conflict_not_published
    check (location_status is distinct from 'conflict' or publish_status not in ('published', 'published_low_confidence')) not valid;
alter table public.events validate constraint events_location_conflict_not_published;
notify pgrst, 'reload schema';
