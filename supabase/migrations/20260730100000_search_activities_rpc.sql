-- fn-18.6: search_activities — Retrieval-RPC des Aktivitaets-Pfads der
-- Smart-Suche (/api/search/semantic, Feld `activityMatches`).
--
-- ANWENDUNG: NICHT automatisch — via Supabase-Dashboard/MCP einspielen.
-- Voraussetzung: 20260724120000_poi_activities.sql UND
-- 20260724121000_poi_activities_indexes.sql sind angewandt (die RPC lebt
-- vom GIN-trgm-Index auf `name` und den btree-Indizes auf lat/lng).
--
-- ── WARUM eine RPC statt PostgREST ───────────────────────────────────────
-- PostgREST kann kein indexgestuetztes `%`/similarity-Ranking: `ilike '%x%'`
-- nutzt den GIN-trgm-Index nicht als Aehnlichkeits-Operator und PostgREST
-- kann nicht nach `similarity(name, q)` sortieren. Beides braucht SQL.
--
-- ── WARUM die BASISTABELLE statt der View poi_activities_public ──────────
-- Die Public-View exponiert `visible`/`duplicate_of` NICHT (fn-18.1), diese
-- Filter waeren dort also nicht anwendbar. Deshalb liest die Funktion
-- `public.poi_activities` und wendet die Anzeige-Bedingung SELBST an:
--     visible = true AND is_closed = false AND duplicate_of IS NULL
-- (fn-18.2 setzt is_closed unabhaengig von visible/duplicate_of.)
-- SECURITY DEFINER + fixiertem search_path, damit auch der anon-Key den
-- Pfad nutzen kann, ohne dass RLS auf der Basistabelle geoeffnet wird.
--
-- ── FILTER-REIHENFOLGE (verbindlich) ─────────────────────────────────────
-- setting/bundesland/bbox/tags sind SQL-WHERE-Filter und greifen damit VOR
-- Ranking UND VOR dem Result-Cap. Wuerde `setting` erst nach dem LIMIT
-- angewandt, verdraengen besser gerankte Outdoor-Treffer die Indoor-Matches
-- aus der Shortlist und "was tun bei Regen in Graz" liefert nichts.
--
-- ── ZWEI ZWEIGE (q vs. q IS NULL) ────────────────────────────────────────
-- Bewusst zwei getrennte RETURN QUERY statt `q IS NULL OR name % q`: nur so
-- ist der trgm-Operator im Zweig mit Suchterm die einzige indexnutzbare
-- Bedingung und der Planner waehlt sicher einen Bitmap-Scan ueber
-- poi_activities_name_trgm_idx. Der q=NULL-Zweig ist Pflicht: bleibt nach
-- Location-/Stopword-Stripping kein Suchbegriff uebrig ("was tun bei Regen
-- in Graz"), laeuft die Suche rein ueber setting + Radius + Tags,
-- deterministisch sortiert (Tag-Treffer DESC, dann name ASC).
--
-- ── EXPLAIN (nach dem Anwenden im SQL-Editor gegenpruefen, Micro-Instanz) ─
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT * FROM public.search_activities('mountaincart', NULL, NULL, NULL,
--                                          47.2, 13.1, 15, 24);
-- Erwarteter Plan im q-Zweig:
--   Limit -> Sort -> Bitmap Heap Scan on poi_activities
--            Recheck Cond: (name % 'mountaincart')
--            -> Bitmap Index Scan on poi_activities_name_trgm_idx
-- Der Sort laeuft ueber die wenigen trgm-Treffer, nicht ueber die Tabelle.
-- Im q=NULL-Zweig mit Bundesland-Filter:
--   Limit -> Sort -> Bitmap Heap Scan
--            -> Bitmap Index Scan on poi_activities_bundesland_visible_idx
-- Sieht der Plan stattdessen einen Seq Scan auf poi_activities: pruefen ob
-- die Index-Migration angewandt und `ANALYZE public.poi_activities` gelaufen
-- ist — NICHT die Sortierung "optimieren".

create or replace function public.search_activities(
  q                 text                default null,
  tag_filter        text[]              default null,
  setting_filter    text                default null,
  bundesland_filter text                default null,
  center_lat        double precision    default null,
  center_lng        double precision    default null,
  radius_km         double precision    default null,
  max_results       integer             default 24
)
returns table (
  id                uuid,
  slug              text,
  name              text,
  description       text,
  description_short text,
  tags              text[],
  setting           text,
  lat               double precision,
  lng               double precision,
  town              text,
  gemeinde_slug     text,
  bundesland        text,
  images            jsonb,
  price_hint        text,
  online_bookable   boolean,
  name_similarity   double precision,
  tag_hits          integer,
  distance_km       double precision
)
language plpgsql
stable
security definer
-- search_path MUSS `extensions` enthalten: Supabase installiert pg_trgm in
-- das Schema `extensions`, nicht in `public`. Mit `set search_path = public`
-- allein schlaegt die Funktion zur Laufzeit fehl ("function similarity(text,
-- text) does not exist") — verifiziert gegen die Prod-DB 2026-07-30.
set search_path = public, extensions
as $$
declare
  v_limit   integer          := least(greatest(coalesce(max_results, 24), 1), 60);
  v_q       text             := nullif(btrim(coalesce(q, '')), '');
  v_radius  double precision := greatest(coalesce(radius_km, 15), 1);
  v_geo     boolean          := center_lat is not null and center_lng is not null;
  v_min_lat double precision;
  v_max_lat double precision;
  v_min_lng double precision;
  v_max_lng double precision;
begin
  if v_geo then
    -- bbox-Vorfilter ueber die btree-Indizes auf lat/lng (billige >=/<=),
    -- Haversine danach als exakter Nachfilter. 1 Grad Breite ~ 111 km,
    -- Laenge schrumpft mit cos(lat) — identische Formel wie bboxAround()
    -- in src/lib/gemeinden/data.ts.
    v_min_lat := center_lat - (v_radius / 111.0);
    v_max_lat := center_lat + (v_radius / 111.0);
    v_min_lng := center_lng - (v_radius / (111.0 * greatest(cos(radians(center_lat)), 0.01)));
    v_max_lng := center_lng + (v_radius / (111.0 * greatest(cos(radians(center_lat)), 0.01)));
  end if;

  if v_q is null then
    -- ── Zweig B: kein Suchterm → setting + Location + Tags, deterministisch
    return query
      with base as (
        select
          a.id, a.slug, a.name, a.description, a.description_short, a.tags,
          a.setting, a.lat, a.lng, a.town, a.gemeinde_slug, a.bundesland,
          a.images, a.price_hint, a.online_bookable,
          0::double precision as name_similarity,
          case
            when tag_filter is null then 0
            else (select count(*)::integer from unnest(a.tags) t where t = any(tag_filter))
          end as tag_hits,
          case
            when not v_geo then null::double precision
            else 6371.0 * acos(least(1.0::double precision, greatest(-1.0::double precision,
                   sin(radians(center_lat)) * sin(radians(a.lat)) +
                   cos(radians(center_lat)) * cos(radians(a.lat)) *
                   cos(radians(a.lng - center_lng)))))
          end as distance_km
        from public.poi_activities a
        where a.visible = true
          and a.is_closed = false
          and a.duplicate_of is null
          and (setting_filter is null or a.setting = setting_filter)
          and (bundesland_filter is null or a.bundesland = bundesland_filter)
          and (not v_geo or (a.lat between v_min_lat and v_max_lat
                         and a.lng between v_min_lng and v_max_lng))
          and (tag_filter is null or a.tags && tag_filter)
      )
      select b.id, b.slug, b.name, b.description, b.description_short, b.tags,
             b.setting, b.lat, b.lng, b.town, b.gemeinde_slug, b.bundesland,
             b.images, b.price_hint, b.online_bookable,
             b.name_similarity, b.tag_hits, b.distance_km
      from base b
      where b.distance_km is null or b.distance_km <= v_radius
      order by b.tag_hits desc, b.name asc
      limit v_limit;
  else
    -- ── Zweig A: trgm-Suche auf name (GIN gin_trgm_ops)
    return query
      with base as (
        select
          a.id, a.slug, a.name, a.description, a.description_short, a.tags,
          a.setting, a.lat, a.lng, a.town, a.gemeinde_slug, a.bundesland,
          a.images, a.price_hint, a.online_bookable,
          similarity(a.name, v_q)::double precision as name_similarity,
          case
            when tag_filter is null then 0
            else (select count(*)::integer from unnest(a.tags) t where t = any(tag_filter))
          end as tag_hits,
          case
            when not v_geo then null::double precision
            else 6371.0 * acos(least(1.0::double precision, greatest(-1.0::double precision,
                   sin(radians(center_lat)) * sin(radians(a.lat)) +
                   cos(radians(center_lat)) * cos(radians(a.lat)) *
                   cos(radians(a.lng - center_lng)))))
          end as distance_km
        from public.poi_activities a
        where a.visible = true
          and a.is_closed = false
          and a.duplicate_of is null
          and a.name % v_q
          and (setting_filter is null or a.setting = setting_filter)
          and (bundesland_filter is null or a.bundesland = bundesland_filter)
          and (not v_geo or (a.lat between v_min_lat and v_max_lat
                         and a.lng between v_min_lng and v_max_lng))
          and (tag_filter is null or a.tags && tag_filter)
      )
      select b.id, b.slug, b.name, b.description, b.description_short, b.tags,
             b.setting, b.lat, b.lng, b.town, b.gemeinde_slug, b.bundesland,
             b.images, b.price_hint, b.online_bookable,
             b.name_similarity, b.tag_hits, b.distance_km
      from base b
      where b.distance_km is null or b.distance_km <= v_radius
      order by b.name_similarity desc, b.tag_hits desc, b.name asc
      limit v_limit;
  end if;
end;
$$;

comment on function public.search_activities(
  text, text[], text, text, double precision, double precision, double precision, integer
) is
  'fn-18.6 — Retrieval fuer den Aktivitaets-Pfad der Smart-Suche. Liest die '
  'Basistabelle poi_activities (nicht die Public-View) und wendet die '
  'Anzeige-Bedingung visible AND NOT is_closed AND duplicate_of IS NULL '
  'selbst an; setting/bundesland/bbox/tags filtern VOR Ranking und Cap. '
  'q=NULL laeuft rein ueber Filter (Regen-/Ortsqueries ohne Suchterm).';

revoke all on function public.search_activities(
  text, text[], text, text, double precision, double precision, double precision, integer
) from public;

grant execute on function public.search_activities(
  text, text[], text, text, double precision, double precision, double precision, integer
) to anon, authenticated, service_role;
