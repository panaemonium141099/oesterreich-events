-- fn-25 Phase C/F: zulässige Zustandskombinationen auf Datenbankebene.
--
-- Ein Konflikt hat keine Position, eine präzise Aussage braucht eine
-- Position und eine Entscheidung. NOT VALID: gilt für neue und geänderte
-- Zeilen; der Altbestand wird in Phase E nachgezogen und die Constraints
-- danach validiert.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>

set statement_timeout = '5min';

alter table public.events
  drop constraint if exists events_location_conflict_no_position,
  add constraint events_location_conflict_no_position
    check (location_status is distinct from 'conflict' or (latitude is null and longitude is null)) not valid;

alter table public.events
  drop constraint if exists events_location_precise_has_position,
  add constraint events_location_precise_has_position
    check (
      location_status not in ('venue_confirmed', 'address_confirmed')
      or (latitude is not null and longitude is not null and location_resolution is not null)
    ) not valid;

notify pgrst, 'reload schema';
