-- fn-25 Phase D1: Ergebnismenge des Vergleichslaufs (neuer Resolver über den
-- gespeicherten Quellenstand), getrennt von den öffentlichen Zeilen.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>

set statement_timeout = '5min';

create table if not exists public.location_compare_runs (
  run_id text not null,
  event_id uuid not null,
  source_name text,
  has_raw boolean not null,
  klass text not null,
  old_status text,
  new_status text,
  old_name text,
  new_name text,
  raw_name text,
  old_lat double precision,
  old_lng double precision,
  new_lat double precision,
  new_lng double precision,
  moved_km double precision,
  precision text,
  reasons text[],
  evidence text[],
  publish_old text,
  publish_intent text,
  legacy_place_name boolean,
  created_at timestamptz not null default now(),
  primary key (run_id, event_id)
);
create index if not exists idx_location_compare_runs_klass on public.location_compare_runs (run_id, klass);
alter table public.location_compare_runs enable row level security;
comment on table public.location_compare_runs is
  'fn-25 D1: Vergleichslauf Resolver vs. Bestand; nur Service-Role. Keine Ausspielung.';

notify pgrst, 'reload schema';
