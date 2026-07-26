-- fn-18.1: Sekundaer-Indizes fuer poi_activities — SEPARATE Migration, bewusst
-- NICHT zusammen mit dem Basis-Schema anwenden.
--
-- ANWENDUNG: via Supabase-Dashboard (SQL-Editor), erst NACH dem Initial-
-- Bulk-Load durch Task 2 (import-activities.ts). Grund: 11 Sekundaer-Indizes
-- wuerden den 20k+-Row-Initial-Import unnoetig verlangsamen.
--
-- OPS-SCHRITT NACH DEM ANWENDEN (dokumentiert, kein Script-Schritt — PostgREST/
-- Service-Key kann kein Maintenance-SQL):
--   ANALYZE public.poi_activities;
-- einmalig im Dashboard ausfuehren, danach uebernimmt Autovacuum.

create extension if not exists pg_trgm;

-- Task 3: slug ist der kanonische URL-Schluessel von /aktivitaet/[slug];
-- UNIQUE erzwingt E5 (ein Slug -> genau eine Row).
create unique index if not exists poi_activities_slug_key
  on public.poi_activities (slug);

-- Task 3: Resolver-Fallback — bei unbekanntem Slug wird ueber die shortid
-- (12-Hex-Suffix) aufgeloest und per 301 auf den aktuellen Slug umgeleitet.
create unique index if not exists poi_activities_shortid_key
  on public.poi_activities (shortid);

-- Task 3/4: Gemeinde-Hub-Sektion + /api/activities?gemeinde=... (nur sichtbare).
create index if not exists poi_activities_gemeinde_slug_visible_idx
  on public.poi_activities (gemeinde_slug)
  where visible;

-- Task 3: Bundesland-Listen/-Filter (nur sichtbare).
create index if not exists poi_activities_bundesland_visible_idx
  on public.poi_activities (bundesland)
  where visible;

-- Task 3/6: Tag-Filter (API + Smart-Suche activityMatches).
create index if not exists poi_activities_tags_gin_idx
  on public.poi_activities using gin (tags);

-- Task 6: Fuzzy-Namenssuche der Smart-Suche. trgm NUR auf name —
-- description ist Sekundaer-Scoring ohne Index (bewusst, Micro-Instanz).
create index if not exists poi_activities_name_trgm_idx
  on public.poi_activities using gin (name gin_trgm_ops);

-- Task 4: bbox-Nearby ("Aktivitaeten in der Naehe" am Event-Detail) —
-- Muster wie bei events (billige >=/<=-Vergleiche auf lat/lng).
create index if not exists poi_activities_lat_idx
  on public.poi_activities (lat);
create index if not exists poi_activities_lng_idx
  on public.poi_activities (lng);

-- Task 2: Fingerprint-Dedup-Gruppen (Canonical-Wahl/Rekonsolidierung, E11).
create index if not exists poi_activities_content_fingerprint_idx
  on public.poi_activities (content_fingerprint);

-- Task 2: Prune/Canonical-Liveness rechnen ausschliesslich ueber
-- last_seen_complete_run_seq (E6).
create index if not exists poi_activities_last_seen_complete_run_seq_idx
  on public.poi_activities (last_seen_complete_run_seq);

-- Task 3: Cursor-Pagination der /api/activities-Liste (Sortierung name, id;
-- nur sichtbare Rows).
create index if not exists poi_activities_name_id_visible_idx
  on public.poi_activities (name, id)
  where visible;
