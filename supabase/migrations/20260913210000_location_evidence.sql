-- fn-25 Phase C3/C4: Belegquellen und Korrekturhistorie für die Ortsentscheidung.
--
-- 1. source_venue_map: bestätigte Zuordnung einer Quellen-Venue-Kennung
--    (eventim:<id>, registry:<uuid>, …) zu Position/Venue. Gültigkeit
--    zeitlich begrenzt, weil Venues umziehen und Quellen IDs recyceln.
-- 2. event_location_corrections: manuelle Korrekturen mit Geltungsbereich,
--    Beleg und Gültigkeit — getrennt von automatischen Labels.
-- 3. geocode_cache: Trefferebene, Anbieter, Status (auch negative Treffer
--    mit Ablauf) für den Adress-Geocoder-Nachtjob; lat/lng dürfen dafür
--    NULL sein.
-- 4. Indizes für die Kandidatensuche in venues/venue_aliases (313k Zeilen,
--    bisher ohne Index auf name_normalized/postal_code).
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>
--   danach: ANALYZE public.venues; ANALYZE public.venue_aliases;

set statement_timeout = '15min';

create table if not exists public.source_venue_map (
  source_venue_id text primary key,
  venue_id uuid references public.venues(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  precision text not null default 'building'
    check (precision in ('entrance', 'building', 'site', 'street', 'locality', 'municipality')),
  confirmed_by text not null,
  evidence text,
  valid_from timestamptz,
  valid_to timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.source_venue_map is
  'fn-25: bestätigte Zuordnung Quellen-Venue-Kennung → Position/Venue. Nur geprüfte Einträge; Gültigkeit beachten.';

create table if not exists public.event_location_corrections (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('event', 'source_venue', 'venue')),
  scope_id text not null,
  before jsonb,
  after jsonb not null,
  reason text not null,
  evidence text,
  corrected_by text not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  resolver_version integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_event_location_corrections_scope
  on public.event_location_corrections (scope, scope_id);
comment on table public.event_location_corrections is
  'fn-25: manuelle Ortskorrekturen (vorher/nachher, Grund, Beleg, Geltungsbereich, Gültigkeit).';

alter table public.geocode_cache
  alter column latitude drop not null,
  alter column longitude drop not null,
  add column if not exists status text not null default 'ok',
  add column if not exists precision text,
  add column if not exists provider text,
  add column if not exists expires_at timestamptz,
  add column if not exists raw jsonb;
alter table public.geocode_cache
  drop constraint if exists geocode_cache_status_check,
  add constraint geocode_cache_status_check check (status in ('ok', 'none', 'error'));
alter table public.geocode_cache
  drop constraint if exists geocode_cache_coords_check,
  add constraint geocode_cache_coords_check check (status <> 'ok' or (latitude is not null and longitude is not null));

-- Genauigkeitsangabe des Adapters zur Quellkoordinate, damit ein Event ohne
-- neuen Abruf erneut entschieden werden kann (Nachtjob, Phase D/E).
alter table public.events add column if not exists coords_precision_raw text;

create index if not exists idx_venues_name_normalized on public.venues (name_normalized);
create index if not exists idx_venues_postal_code on public.venues (postal_code);
create index if not exists idx_venue_aliases_alias_normalized on public.venue_aliases (alias_normalized);

alter table public.source_venue_map enable row level security;
alter table public.event_location_corrections enable row level security;

notify pgrst, 'reload schema';
