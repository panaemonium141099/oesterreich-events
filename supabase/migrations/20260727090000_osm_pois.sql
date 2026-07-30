-- fn-18.7: OSM-Freizeit-POI-Bestand (Volumen-Slice des Epics fn-18).
--
-- ANWENDUNG: NICHT automatisch — via Supabase-Dashboard (SQL-Editor) bzw.
-- Supabase-MCP einspielen. Reihenfolge: DIESE Datei VOR dem Initial-Load
-- (npm run import-osm-pois); die separate Index-Migration
-- 20260727091000_osm_pois_indexes.sql erst DANACH (schnellerer Bulk-Load,
-- anschliessend ANALYZE — siehe Header dort).
--
-- ── ODbL: WARUM DIESE TABELLE STRIKT GETRENNT LEBT ──────────────────────────
-- OpenStreetMap steht unter ODbL 1.0 (Share-Alike auf Datenbank-Ebene).
-- `osm_pois` ist deshalb eine EIGENSTAENDIGE Datenbank neben dem eigenen
-- Bestand (`poi_activities` aus dem Feratel-Deskline-Feed, `venues`):
--
--   * KEIN Merge-, Dedup- oder Join-SCHREIBPFAD zwischen osm_pois und
--     poi_activities/venues. Es gibt bewusst keine FK-Spalte, keinen
--     gemeinsamen content_fingerprint, keine duplicate_of-Verknuepfung
--     ueber Tabellengrenzen und keinen Trigger/View, der beide Bestaende
--     zu einer Zeile verrechnet.
--   * Verknuepft wird ausschliesslich zur ANZEIGE-Zeit ueber eine reine
--     Geo-Query (Gemeinde-Hub-Sektion: beide Bestaende werden nebeneinander
--     gerendert, nie ineinander gerechnet). Dass dieselbe Einrichtung in
--     beiden Listen auftauchen kann, ist AKZEPTIERT — Cross-Dedup waere
--     genau der abgeleitete Datenbank-Fall, den ODbL Share-Alike traefe.
--   * Keine eigenen Detailseiten fuer OSM-POIs (Thin-Content-Vermeidung und
--     kleiner Herausgabe-Umfang).
--   * Attribution "(c) OpenStreetMap contributors" + ODbL-Link auf /quellen
--     UND an der Hub-Sektion.
--
-- Naming: `osm_pois` (nicht `osm_venues`) — die bestehende `venues`-Tabelle
-- enthaelt bereits OSM-abgeleitete Venue-Rows aus einem aelteren Import und
-- wird von diesem Bestand NICHT beruehrt.

create table if not exists public.osm_pois (
  id            uuid primary key default gen_random_uuid(),

  -- OSM-Identitaet ----------------------------------------------------------
  -- OSM-IDs sind nur innerhalb ihres Typs eindeutig -> zusammengesetzter Key
  -- (kein Offset-Trick wie in venues.osm_id; hier ist der Typ eine eigene,
  -- lesbare Spalte und `unique (osm_type, osm_id)` der Upsert-Konflikt-Target).
  osm_type      text   not null check (osm_type in ('node','way','relation')),
  osm_id        bigint not null,
  unique (osm_type, osm_id),

  -- Anzeige -----------------------------------------------------------------
  name          text not null,                 -- OSM `name` (Pflicht — namenlose
                                               -- Objekte werden nicht importiert)
  category      text not null,                 -- interne Kategorie-ID aus der
                                               -- kuratierten Whitelist
                                               -- (src/lib/osm/poi-whitelist.ts)
  osm_tag       text not null,                 -- der matchende OSM-Tag als
                                               -- `key=value` (Provenienz/Debug)
  setting       text check (setting in ('indoor','outdoor','mixed')),
                                               -- deterministisch aus der Kategorie
                                               -- (gleiche Semantik wie
                                               --  poi_activities.setting)
  website       text,                          -- tags.website / contact:website

  -- Geo & Gemeinde ------------------------------------------------------------
  lat           double precision not null,
  lng           double precision not null,
  gemeinde_slug text,                          -- {plz}-{name-slug}, nearest-Haversine
                                               -- ueber dieselbe Registry wie
                                               -- poi_activities (matchGemeinde)
  bundesland    text not null,                 -- kanonische lowercase-ID
  town          text,                          -- OSM addr:city, sonst Registry-Name

  -- Provenienz ----------------------------------------------------------------
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.osm_pois is
  'Freizeit-/Ausflugs-POIs aus OpenStreetMap (fn-18.7), ODbL 1.0, '
  '(c) OpenStreetMap contributors. STRIKT getrennt von poi_activities/venues: '
  'kein Merge-/Dedup-/Join-Schreibpfad, Verknuepfung nur zur Anzeige-Zeit per '
  'Geo-Query. Keine eigenen Detailseiten.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Kein anon/authenticated-Lesepfad: die einzige Anzeige-Flaeche (Gemeinde-Hub-
-- Sektion) laeuft server-seitig ueber den Service-Role-Client
-- (src/lib/osm/nearby-pois.ts, unstable_cache). Bewusst KEINE Public-View wie
-- bei poi_activities — ohne Client-Konsumenten waere sie ungenutzte
-- Angriffsflaeche.
alter table public.osm_pois enable row level security;
revoke all on table public.osm_pois from anon, authenticated;
grant all on table public.osm_pois to service_role;
