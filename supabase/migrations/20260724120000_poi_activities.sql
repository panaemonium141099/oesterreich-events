-- fn-18.1: Basis-Schema fuer Freizeitaktivitaeten (POI-Bestand, Epic fn-18).
--
-- ANWENDUNG: NICHT automatisch — via Supabase-Dashboard (SQL-Editor) einspielen.
-- Reihenfolge: DIESE Datei vor dem Initial-Load (Task 2) anwenden; die separate
-- Index-Migration 20260724121000_poi_activities_indexes.sql erst NACH dem
-- Bulk-Load (schnellerer Initial-Import, danach ANALYZE — siehe dort).
--
-- Namenswahl: `poi_activities`, weil `activities` bereits die Social-Feed-
-- Tabelle ist (20260424_activities_delete_policy.sql, auth.uid() = user_id).
--
-- Keine GIN/trgm-Indizes hier (bewusst) — alle Sekundaer-Indizes leben in der
-- Index-Migration, damit der Initial-Load von Task 2 nicht gegen sie schreibt.

create table if not exists public.poi_activities (
  id                          uuid primary key default gen_random_uuid(),

  -- Quelle & Identitaet -----------------------------------------------------
  source                      text not null,                    -- 'deskline'
  source_region               text not null,                    -- INSERT-ONLY: Region-Slug der Erst-Sichtung.
                                                                -- Ist im Update-Pfad NIE enthalten, sonst flappt
                                                                -- der Wert bei Mirror-Regionen (Task 2, E5/E6).
  source_id                   text not null,
  unique (source, source_id),

  -- Anzeige & URL -----------------------------------------------------------
  name                        text not null,
  slug                        text not null,                    -- {slugify(name)}-{shortid}; beim Insert fixiert,
                                                                -- NIE regeneriert (Epic E5). UNIQUE via Index-Migration.
  shortid                     text not null,                    -- erste 12 Hex-Zeichen von sha1('{source}:{source_id}'),
                                                                -- lowercase. EIGENE Spalte: der Task-3-Resolver-Fallback
                                                                -- laeuft hierueber (kein Suffix-Scan auf slug).
                                                                -- UNIQUE via Index-Migration.
  description                 text,
  description_short           text,

  -- Taxonomie (Task-1-Lib: src/lib/activities/taxonomy.ts) --------------------
  tags                        text[] not null default '{}',     -- Werte aus dem bestehenden TAGS-Vokabular
                                                                -- (enrichment-taxonomy.ts, read-only)
  topics_raw                  jsonb,                            -- Deskline-Topics unveraendert (Debug/Reprocessing)
  setting                     text check (setting in ('indoor','outdoor','mixed')),
                                                                -- deterministisches Wetter-Signal, AUSSCHLIESSLICH aus
                                                                -- der Topic-Whitelist abgeleitet (jeder Whitelist-Eintrag
                                                                -- deklariert indoor/outdoor/mixed). NULL = unbekannt.
                                                                -- Task 6 filtert Regen-Queries NUR ueber dieses Feld.

  -- Geo & Gemeinde ------------------------------------------------------------
  lat                         double precision not null,
  lng                         double precision not null,
  town                        text,
  gemeinde_slug               text,                             -- {plz}-{name-slug} aus der Gemeinde-Registry
                                                                -- (nearest-Haversine, Epic E4)
  bundesland                  text not null,                    -- kanonische lowercase-ID wie im Bestand
                                                                -- ('burgenland', 'steiermark', 'kaernten', ...).
                                                                -- Autoritative Quelle: die gematchte Gemeinde-Registry-
                                                                -- Zeile (via bundeslandToId), NICHT die REGIONS-Config
                                                                -- (die enthaelt 'Österreich'-Eintraege, nur Fallback/Log).

  -- Oeffnungszeiten -----------------------------------------------------------
  opening_times_raw           jsonb,                            -- Deskline-Original (nur Debug/Reprocessing)
  opening_times               jsonb,                            -- normalisiert nach Epic-E8-Vertrag: Array von
                                                                -- {from:'YYYY-MM-DD', to:'YYYY-MM-DD',
                                                                --  timeFrom:'HH:MM', timeTo:'HH:MM',
                                                                --  weekdays:<Bitmaske Mo=1..So=64>|null (null=alle Tage)};
                                                                -- timeFrom==timeTo=='00:00' = durchgehend geoeffnet.
                                                                -- EINZIGER Lesepfad fuer Badge + Noindex-Gate.
  open_status                 int,                              -- Deskline-Enum `openStatus` — SNAPSHOT zur Import-Zeit,
                                                                -- KEIN Live-Signal. Empirisch verprobt 2026-07-24
                                                                -- (burgenland+blsalzb+kaernten, n~1600):
                                                                --   0     = keine (gueltigen) Oeffnungszeiten hinterlegt
                                                                --   2     = zum Abfragezeitpunkt geoeffnet
                                                                --   1/3/4 = zum Abfragezeitpunkt geschlossen (Feratel-
                                                                --           interne Feinabstufung ohne oeffentliche Doku;
                                                                --           empirisch: 3/4 = heute Fenster vorhanden aber
                                                                --           gerade zu, 1 = naechste Oeffnung an anderem Tag).
                                                                -- "Jetzt geoeffnet"-Badge liest AUSSCHLIESSLICH
                                                                -- opening_times (E8), nie dieses Feld.
  online_bookable             boolean not null default false,

  -- Medien & Kommerz ----------------------------------------------------------
  images                      jsonb,                            -- Array mit urls/copyright/license/author (Attribution!)
  guest_cards                 jsonb,
  price_hint                  text,                             -- deterministischer Euro-Regex (price-hint.ts), kein KI
  affiliate_product           jsonb,                            -- Mindest-Contract (Task 5 baut darauf):
                                                                -- {product_code, title, teaser, image_url, price_from,
                                                                --  currency, rating, review_count, url, matched_at,
                                                                --  refreshed_at}

  -- Dedup & Sichtbarkeit ------------------------------------------------------
  content_fingerprint         text not null,                    -- sha1 aus normalisiertem Namen + Koordinaten quantisiert
                                                                -- auf round(x*1000)/1000 (Epic E11, fingerprint.ts)
  duplicate_of                uuid references public.poi_activities(id),
                                                                -- gesetzt fuer nicht-kanonische Fingerprint-Duplikate
  visible                     boolean not null default true,    -- gehoert AUSSCHLIESSLICH Prune/Dedup (Task 2)
  is_closed                   boolean not null default false,   -- dauerhaft gesperrte/geschlossene POIs (GESPERRT-Praefix /
                                                                -- entspr. open_status): werden importiert (Datenpflege,
                                                                -- Wiedereroeffnungs-Erkennung), aber ueberall ausgeschlossen.
                                                                -- Anzeige-Bedingung ist immer (visible AND NOT is_closed).
                                                                -- Bewusst SEPARAT von visible.

  -- Run-Provenienz (Epic E6; Ordnung IMMER ueber run_seq, nie Run-UUIDs) -------
  last_seen_run_seq           bigint,                           -- JEDER full_attempt aktualisiert (reine Provenienz)
  last_seen_complete_run_seq  bigint,                           -- NUR complete_runs aktualisieren; Prune UND Canonical-
                                                                -- Liveness laufen AUSSCHLIESSLICH ueber dieses Feld —
                                                                -- sonst haelt ein Fehllauf-Sighting POIs am Leben, die in
                                                                -- 2 kompletten Laeufen fehlten.
  last_seen_at                timestamptz,
  seen_regions                text[] not null default '{}',     -- all-time-Union, reine Provenienz

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

comment on table public.poi_activities is
  'Freizeitaktivitaeten/POIs (fn-18). Quelle: Feratel Deskline infrastructures. '
  'NICHT verwechseln mit `activities` (Social-Feed). Anzeige-Bedingung ueberall: '
  'visible AND NOT is_closed.';

-- Run-Bookkeeping (Epic E6). Begriffe: full_attempt = Lauf, der alle Regionen
-- VERSUCHT (auch mit Fehl-Regionen); complete_run = full_attempt mit leerem
-- regions_failed. run_seq ist die einzige Ordnungsquelle (UUIDs sind nicht
-- zeitlich ordbar). Fehlendes finished_at = abgebrochener Lauf (Crash-Marker).
create table if not exists public.poi_activity_runs (
  run_id          uuid primary key default gen_random_uuid(),
  run_seq         bigint generated always as identity unique,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  regions_ok      jsonb,
  regions_failed  jsonb,
  is_complete     boolean not null default false
);

-- ── RLS & Public-Lesepfad ────────────────────────────────────────────────────
-- poi_activities: public-read NUR fuer sichtbare, nicht gesperrte Rows UND
-- NUR ueber die spaltenreduzierte View poi_activities_public (s. u.) —
-- die Tabelle enthaelt interne Provenienz-/Debug-Spalten (source_id,
-- source_region, topics_raw, opening_times_raw, open_status,
-- content_fingerprint, duplicate_of, visible, is_closed, last_seen_*,
-- seen_regions), die Clients nichts angehen. Direkte Tabellen-Reads sind
-- anon/authenticated deshalb komplett entzogen.
-- Slug-/Shortid-/Duplicate-Resolution (Task 3) laeuft server-seitig ueber
-- den Service-Role-Client (bypasst RLS und sieht alle Spalten/Rows).
alter table public.poi_activities enable row level security;

-- Defense-in-depth: Row-Policy bleibt bestehen, falls direkte Grants je
-- zurueckkehren — der aktive Public-Pfad ist aber ausschliesslich die View.
drop policy if exists poi_activities_public_read on public.poi_activities;
create policy poi_activities_public_read
  on public.poi_activities
  for select
  to anon, authenticated
  using (visible = true and is_closed = false);

revoke select on table public.poi_activities from anon, authenticated;

-- Public-View: nur frontend-sichere Spalten, fest eingebauter Sichtbarkeits-
-- Filter. BEWUSST ohne security_invoker (Definer-Semantik): anon hat keine
-- Tabellen-Grants mehr, die View selbst filtert identisch zur RLS-Policy.
-- Der Supabase-Linter-Hinweis "security definer view" ist hier akzeptiert
-- und begruendet. Task 3/4/6: /api/activities & Co. lesen ueber diese View
-- (anon-Client) oder direkt die Tabelle (Service-Role, server-only).
create or replace view public.poi_activities_public as
  select
    id, slug, shortid, name, description, description_short,
    tags, setting, lat, lng, town, gemeinde_slug, bundesland,
    opening_times, online_bookable, images, guest_cards, price_hint,
    affiliate_product, source, created_at, updated_at
  from public.poi_activities
  where visible = true and is_closed = false;

comment on view public.poi_activities_public is
  'Public-Lesepfad fuer poi_activities (fn-18): nur sichtbare, nicht '
  'gesperrte Rows und nur frontend-sichere Spalten. Interne Provenienz-/'
  'Dedup-Spalten bleiben service-only.';

grant select on public.poi_activities_public to anon, authenticated;

-- poi_activity_runs: NUR service-role (RLS an, keine Policies, keine Grants
-- fuer anon/authenticated).
alter table public.poi_activity_runs enable row level security;
revoke all on table public.poi_activity_runs from anon, authenticated;
