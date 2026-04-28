-- Phase 1a: Bulk-Update RPCs für die 4 Pipeline-Scripts
-- (Folge zu 20260428190200_bulk_update_event_scores_rpc.sql)
--
-- Pattern wie bestehender bulk_update_event_scores:
--   - jsonb-Payload, ein UPDATE-Statement pro Batch
--   - SECURITY DEFINER mit search_path=public
--   - REVOKE FROM PUBLIC, GRANT TO service_role only
--
-- Zwei Varianten:
--   STRICT  (jsonb_to_recordset, alle Spalten Pflicht):
--     bulk_update_event_slugs, bulk_update_event_publish
--   SPARSE  (CASE WHEN payload ? 'key', Felder optional, NULL erlaubt):
--     bulk_update_event_geocoding, bulk_update_event_enrichment
--
-- Sparse-Pattern erlaubt:
--   - Key fehlt im JSON  →  Spalte unverändert
--   - Key vorhanden mit Wert →  Spalte = Wert
--   - Key vorhanden mit null  →  Spalte = NULL (für fix-geocoding clear-branch)


-- ============================================================
-- 1. bulk_update_event_geocoding (sparse)
-- Aufrufer: openai-geocode.ts, fix-geocoding.ts (beide branches),
--           normalize-locations.ts (location_name + optional lat/lng)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_update_event_geocoding(
  p_updates jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  WITH src AS (
    SELECT (e->>'id')::uuid AS id, e AS payload
    FROM jsonb_array_elements(p_updates) AS e
  )
  UPDATE public.events ev
  SET
    location_name = CASE WHEN src.payload ? 'location_name'
                         THEN src.payload->>'location_name'
                         ELSE ev.location_name END,
    latitude = CASE WHEN src.payload ? 'latitude'
                    THEN NULLIF(src.payload->>'latitude','')::double precision
                    ELSE ev.latitude END,
    longitude = CASE WHEN src.payload ? 'longitude'
                     THEN NULLIF(src.payload->>'longitude','')::double precision
                     ELSE ev.longitude END,
    geocoding_confidence = CASE WHEN src.payload ? 'geocoding_confidence'
                                THEN NULLIF(src.payload->>'geocoding_confidence','')::double precision
                                ELSE ev.geocoding_confidence END,
    geocoding_source = CASE WHEN src.payload ? 'geocoding_source'
                            THEN src.payload->>'geocoding_source'
                            ELSE ev.geocoding_source END
  FROM src
  WHERE ev.id = src.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_update_event_geocoding(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_geocoding(jsonb) TO service_role;


-- ============================================================
-- 2. bulk_update_event_enrichment (sparse, viele optionale Felder)
-- Aufrufer: enrich-openai.ts (worker), enrich-claude-cli.ts
-- Cols (alle optional): category, category_candidates, category_confidence,
--   category_needs_review, category_reason, category_source, category_version,
--   audience, vibe, occasion_tags, setting, duration_type, price_tier,
--   price_flags, language, description, enrichment_version,
--   is_family_friendly, is_student_friendly
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_update_event_enrichment(
  p_updates jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  WITH src AS (
    SELECT (e->>'id')::uuid AS id, e AS payload
    FROM jsonb_array_elements(p_updates) AS e
  )
  UPDATE public.events ev
  SET
    -- Category-Komplex
    category = CASE WHEN src.payload ? 'category'
                    THEN src.payload->>'category'
                    ELSE ev.category END,
    category_candidates = CASE WHEN src.payload ? 'category_candidates'
                               THEN src.payload->'category_candidates'
                               ELSE ev.category_candidates END,
    category_confidence = CASE WHEN src.payload ? 'category_confidence'
                               THEN NULLIF(src.payload->>'category_confidence','')::double precision
                               ELSE ev.category_confidence END,
    category_needs_review = CASE WHEN src.payload ? 'category_needs_review'
                                 THEN (src.payload->>'category_needs_review')::boolean
                                 ELSE ev.category_needs_review END,
    category_reason = CASE WHEN src.payload ? 'category_reason'
                           THEN src.payload->>'category_reason'
                           ELSE ev.category_reason END,
    category_source = CASE WHEN src.payload ? 'category_source'
                           THEN src.payload->>'category_source'
                           ELSE ev.category_source END,
    category_version = CASE WHEN src.payload ? 'category_version'
                            THEN NULLIF(src.payload->>'category_version','')::integer
                            ELSE ev.category_version END,
    -- Tags / Audience / Setting / Occasion (jsonb arrays)
    tags = CASE WHEN src.payload ? 'tags'
                THEN (SELECT array_agg(value)::text[] FROM jsonb_array_elements_text(src.payload->'tags'))
                ELSE ev.tags END,
    audience = CASE WHEN src.payload ? 'audience'
                    THEN src.payload->'audience'
                    ELSE ev.audience END,
    vibe = CASE WHEN src.payload ? 'vibe'
                THEN src.payload->'vibe'
                ELSE ev.vibe END,
    occasion_tags = CASE WHEN src.payload ? 'occasion_tags'
                         THEN src.payload->'occasion_tags'
                         ELSE ev.occasion_tags END,
    setting = CASE WHEN src.payload ? 'setting'
                   THEN src.payload->'setting'
                   ELSE ev.setting END,
    -- Duration / Price
    duration_type = CASE WHEN src.payload ? 'duration_type'
                         THEN src.payload->>'duration_type'
                         ELSE ev.duration_type END,
    price_tier = CASE WHEN src.payload ? 'price_tier'
                      THEN src.payload->>'price_tier'
                      ELSE ev.price_tier END,
    price_flags = CASE WHEN src.payload ? 'price_flags'
                       THEN src.payload->'price_flags'
                       ELSE ev.price_flags END,
    -- Misc
    language = CASE WHEN src.payload ? 'language'
                    THEN src.payload->>'language'
                    ELSE ev.language END,
    description = CASE WHEN src.payload ? 'description'
                       THEN src.payload->>'description'
                       ELSE ev.description END,
    enrichment_version = CASE WHEN src.payload ? 'enrichment_version'
                              THEN src.payload->>'enrichment_version'
                              ELSE ev.enrichment_version END,
    is_family_friendly = CASE WHEN src.payload ? 'is_family_friendly'
                              THEN (src.payload->>'is_family_friendly')::boolean
                              ELSE ev.is_family_friendly END,
    is_student_friendly = CASE WHEN src.payload ? 'is_student_friendly'
                               THEN (src.payload->>'is_student_friendly')::boolean
                               ELSE ev.is_student_friendly END
  FROM src
  WHERE ev.id = src.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_update_event_enrichment(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_enrichment(jsonb) TO service_role;


-- ============================================================
-- 3. bulk_update_event_slugs (strict, 2 Spalten)
-- Aufrufer: backfill-slugs.ts
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_update_event_slugs(
  p_updates jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  WITH src AS (
    SELECT id, slug
    FROM jsonb_to_recordset(p_updates) AS x(id uuid, slug text)
  )
  UPDATE public.events e
  SET slug = src.slug
  FROM src
  WHERE e.id = src.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_update_event_slugs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_slugs(jsonb) TO service_role;


-- ============================================================
-- 4. bulk_update_event_publish (strict, 3 Spalten)
-- Aufrufer: backfill-quality.ts (publish_status + quality_score Phase)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_update_event_publish(
  p_updates jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  WITH src AS (
    SELECT id, publish_status, quality_score
    FROM jsonb_to_recordset(p_updates) AS x(
      id uuid,
      publish_status text,
      quality_score double precision
    )
  )
  UPDATE public.events e
  SET publish_status = src.publish_status,
      quality_score  = src.quality_score
  FROM src
  -- Schutz: 'duplicate' und 'archived' Status NIE überschreiben
  -- (gleiche Logic wie supabase-sync.ts COMPUTED_PUBLISH_STATUSES guard)
  WHERE e.id = src.id
    AND (e.publish_status IS NULL
         OR e.publish_status NOT IN ('duplicate', 'archived'));

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_update_event_publish(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_publish(jsonb) TO service_role;
