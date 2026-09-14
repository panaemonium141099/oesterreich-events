-- fn-25 O1: Zeitpunkt des letzten Statuswechsels der Ortsentscheidung.
--
-- Die Kennzahl „neue Konflikte (24 h)" zählte bisher Konflikt-Zeilen mit
-- frischem updated_at; da Score-Lauf und Sync jede Zeile nächtlich anfassen,
-- wäre der Alarm dauerhaft rot. Sync, Backfill und Stale-Schritt setzen die
-- Spalte nur, wenn sich location_status tatsächlich ändert. Bestandszeilen
-- bleiben NULL (unbekannt), zählen also nicht als neu.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>
alter table public.events add column if not exists location_status_changed_at timestamptz;
comment on column public.events.location_status_changed_at is
  'fn-25: letzter Wechsel von location_status (Sync/Backfill/Stale); NULL = unbekannt.';
create index if not exists idx_events_location_status_changed
  on public.events (location_status, location_status_changed_at)
  where location_status = 'conflict';
notify pgrst, 'reload schema';
