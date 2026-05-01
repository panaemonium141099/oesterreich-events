-- Phase B-1 (2026-05-01): Erweitere bulk_update_event_enrichment um
-- end_date + address. Damit kann der enrich-openai.ts Worker auch
-- strukturelle Stamm-Daten füllen die der Scraper nicht erfasst hat.
--
-- Fix: GSC Rich-Result-Warnings systemweit (endDate fehlt in 1.396 events,
-- address in 1.061, description in 851).

CREATE OR REPLACE FUNCTION public.bulk_update_event_enrichment(p_updates jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected int;
BEGIN
  WITH src AS (
    SELECT (e->>'id')::uuid AS id, e AS payload
    FROM jsonb_array_elements(p_updates) AS e
  )
  UPDATE public.events ev
  SET
    category = CASE WHEN src.payload ? 'category'
                    THEN src.payload->>'category' ELSE ev.category END,
    category_candidates = CASE WHEN src.payload ? 'category_candidates'
                               THEN src.payload->'category_candidates' ELSE ev.category_candidates END,
    category_confidence = CASE WHEN src.payload ? 'category_confidence'
                               THEN src.payload->>'category_confidence' ELSE ev.category_confidence END,
    category_needs_review = CASE WHEN src.payload ? 'category_needs_review'
                                 THEN (src.payload->>'category_needs_review')::boolean
                                 ELSE ev.category_needs_review END,
    category_reason = CASE WHEN src.payload ? 'category_reason'
                           THEN src.payload->>'category_reason' ELSE ev.category_reason END,
    category_source = CASE WHEN src.payload ? 'category_source'
                           THEN src.payload->>'category_source' ELSE ev.category_source END,
    category_version = CASE WHEN src.payload ? 'category_version'
                            THEN src.payload->>'category_version' ELSE ev.category_version END,
    tags = CASE WHEN src.payload ? 'tags'
                THEN ARRAY(SELECT jsonb_array_elements_text(src.payload->'tags'))
                ELSE ev.tags END,
    audience = CASE WHEN src.payload ? 'audience'
                    THEN ARRAY(SELECT jsonb_array_elements_text(src.payload->'audience'))
                    ELSE ev.audience END,
    vibe = CASE WHEN src.payload ? 'vibe'
                THEN ARRAY(SELECT jsonb_array_elements_text(src.payload->'vibe'))
                ELSE ev.vibe END,
    occasion_tags = CASE WHEN src.payload ? 'occasion_tags'
                         THEN ARRAY(SELECT jsonb_array_elements_text(src.payload->'occasion_tags'))
                         ELSE ev.occasion_tags END,
    setting = CASE WHEN src.payload ? 'setting'
                   THEN ARRAY(SELECT jsonb_array_elements_text(src.payload->'setting'))
                   ELSE ev.setting END,
    price_flags = CASE WHEN src.payload ? 'price_flags'
                       THEN ARRAY(SELECT jsonb_array_elements_text(src.payload->'price_flags'))
                       ELSE ev.price_flags END,
    duration_type = CASE WHEN src.payload ? 'duration_type'
                         THEN src.payload->>'duration_type' ELSE ev.duration_type END,
    price_tier = CASE WHEN src.payload ? 'price_tier'
                      THEN src.payload->>'price_tier' ELSE ev.price_tier END,
    price_text = CASE WHEN src.payload ? 'price_text'
                      THEN src.payload->>'price_text' ELSE ev.price_text END,
    language = CASE WHEN src.payload ? 'language'
                    THEN src.payload->>'language' ELSE ev.language END,
    description = CASE WHEN src.payload ? 'description'
                       THEN src.payload->>'description' ELSE ev.description END,
    enrichment_version = CASE WHEN src.payload ? 'enrichment_version'
                              THEN src.payload->>'enrichment_version' ELSE ev.enrichment_version END,
    enrichment_at = CASE WHEN src.payload ? 'enrichment_at'
                         THEN NULLIF(src.payload->>'enrichment_at','')::timestamptz
                         ELSE ev.enrichment_at END,
    is_family_friendly = CASE WHEN src.payload ? 'is_family_friendly'
                              THEN (src.payload->>'is_family_friendly')::boolean
                              ELSE ev.is_family_friendly END,
    is_student_friendly = CASE WHEN src.payload ? 'is_student_friendly'
                               THEN (src.payload->>'is_student_friendly')::boolean
                               ELSE ev.is_student_friendly END,
    -- v3-structural (2026-05-01): structural fields the scraper often misses
    end_date = CASE WHEN src.payload ? 'end_date'
                    THEN NULLIF(src.payload->>'end_date','')::timestamptz
                    ELSE ev.end_date END,
    address = CASE WHEN src.payload ? 'address'
                   THEN src.payload->>'address' ELSE ev.address END
  FROM src WHERE ev.id = src.id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.bulk_update_event_enrichment(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_enrichment(jsonb) TO service_role;
