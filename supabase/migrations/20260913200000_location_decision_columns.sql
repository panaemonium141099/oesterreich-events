-- fn-25 Phase A3: Rohwerte der Quelle und Ortsentscheidung als eigene
-- Spalten (additiv, keine Datenänderung).
--
-- Hintergrund (docs/ORTSDATEN-ANALYSE-2026-09-13.md): der Schreibpfad hat
-- `location_name` durch GeoNames-Treffer ersetzt und die PLZ aus der
-- (falschen) Koordinate zurückgerechnet. Der Rohwert war danach nirgends
-- mehr vorhanden. Ab jetzt werden Rohwerte unverändert gespeichert und jede
-- Position trägt Status, Genauigkeit, Herkunft und Entscheidungsprotokoll.
--
-- Reihenfolge: ZUERST diese Migration auf Prod anwenden, DANN den Code
-- deployen — der Upsert schreibt die Spalten und scheitert sonst für den
-- ganzen Batch.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>

set statement_timeout = '10min';

alter table public.events
  add column if not exists location_name_raw text,
  add column if not exists address_raw text,
  add column if not exists postal_code_raw text,
  add column if not exists city_raw text,
  add column if not exists country_raw text,
  add column if not exists source_venue_id text,
  add column if not exists latitude_raw double precision,
  add column if not exists longitude_raw double precision,
  add column if not exists location_status text,
  add column if not exists location_precision text,
  add column if not exists location_resolution jsonb,
  add column if not exists location_provenance jsonb;

comment on column public.events.location_name_raw is
  'Veranstaltungsort exakt wie von der Quelle geliefert (fn-25). Nie normalisiert.';
comment on column public.events.address_raw is
  'Adresse exakt wie von der Quelle geliefert (fn-25).';
comment on column public.events.postal_code_raw is
  'PLZ-Feld der Quelle (fn-25); NULL wenn die Quelle keine PLZ liefert.';
comment on column public.events.city_raw is
  'Von der Quelle genannter Ort/Gemeinde (Eventim eventCity, Feratel town, Gemeinde-Kalender).';
comment on column public.events.country_raw is
  'Länderangabe der Quelle; NULL wenn die Quelle nichts liefert (dann gilt AT als Vorgabe).';
comment on column public.events.source_venue_id is
  'Venue-Kennung der Quelle im Namensraum der Quelle, z. B. eventim:12345.';
comment on column public.events.latitude_raw is
  'Koordinate exakt wie von der Quelle geliefert (fn-25); nie ein PLZ- oder Regionsmittelpunkt.';
comment on column public.events.longitude_raw is
  'Koordinate exakt wie von der Quelle geliefert (fn-25); nie ein PLZ- oder Regionsmittelpunkt.';
comment on column public.events.location_status is
  'Wissensstand zum Ort: venue_confirmed | address_confirmed | municipality_only | region_only | unresolved | conflict | online (fn-25).';
comment on column public.events.location_precision is
  'Räumliche Genauigkeit der gespeicherten Position: entrance | building | site | street | locality | municipality | postcode | region | unknown.';
comment on column public.events.location_resolution is
  'Protokoll der Ortsentscheidung (Version, Gründe, Belege, verworfene Angaben, erlaubte Ausspielung, Eingabehash).';
comment on column public.events.location_provenance is
  'Herkunft je Ortsfeld: source | address_text | title_text | registry | derived:plz | derived:coords | default | manual.';

alter table public.events
  drop constraint if exists events_location_status_check,
  add constraint events_location_status_check check (
    location_status is null or location_status in (
      'venue_confirmed', 'address_confirmed', 'municipality_only', 'region_only',
      'unresolved', 'conflict', 'online'
    )
  ) not valid;

alter table public.events
  drop constraint if exists events_location_precision_check,
  add constraint events_location_precision_check check (
    location_precision is null or location_precision in (
      'entrance', 'building', 'site', 'street', 'locality', 'municipality',
      'postcode', 'region', 'unknown'
    )
  ) not valid;

-- Für Phase E (Bestand nach Status sichten) und die spätere Ausspielung.
create index if not exists idx_events_location_status
  on public.events (location_status)
  where location_status is not null;

-- Rohschicht: Parser-Version je Rohzeile (Phase B1 schreibt sie).
alter table public.raw_events
  add column if not exists parser_version text;

-- Master-Koordinaten werden nicht gelöscht, sondern versioniert ungültig
-- gesetzt (Phase C4); die Spalten kommen jetzt, damit A4 den Trigger
-- stilllegen kann, ohne Daten zu verlieren.
alter table public.location_master_coords
  add column if not exists status text not null default 'active',
  add column if not exists revoked_reason text,
  add column if not exists revoked_at timestamptz;

alter table public.location_master_coords
  drop constraint if exists location_master_coords_status_check,
  add constraint location_master_coords_status_check check (status in ('active', 'revoked'));

notify pgrst, 'reload schema';
