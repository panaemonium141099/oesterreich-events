-- bulk_update_event_enrichment: erweitere um die 4 strukturellen Felder
-- die fix-gsc-event-issues.ts schreiben muss.
--
-- Hintergrund: Die ursprüngliche RPC war auf Enrichment-Felder beschränkt
-- (category*, tags, audience, vibe, occasion_tags, setting, duration_type,
-- price_tier, price_flags, language, description, enrichment_version,
-- is_family_friendly, is_student_friendly). Felder wie end_date / address /
-- price_text / price_min landeten zwar im jsonb-Payload, wurden aber vom
-- CASE-WHEN nicht erfasst und still verworfen.
--
-- Diese Migration ergänzt:
--   end_date   (timestamptz) — z. B. "2026-05-22T22:00:00+02:00"
--   address    (text)        — z. B. "Eisenstädter Straße 27"
--   price_text (text)        — z. B. "Eintritt frei", "Erwachsene 15 €"
--   price_min  (numeric)     — z. B. 15.00 (optional, Script schreibt aktuell nur price_text)
--
-- Sparse-Pattern bleibt: nur Felder die im Payload als Schlüssel vorhanden sind
-- werden geschrieben. Alle übrigen Felder bleiben unangetastet.

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
    -- Duration / Price (Enrichment)
    duration_type = CASE WHEN src.payload ? 'duration_type'
                         THEN src.payload->>'duration_type'
                         ELSE ev.duration_type END,
    price_tier = CASE WHEN src.payload ? 'price_tier'
                      THEN src.payload->>'price_tier'
                      ELSE ev.price_tier END,
    price_flags = CASE WHEN src.payload ? 'price_flags'
                       THEN src.payload->'price_flags'
                       ELSE ev.price_flags END,
    -- Misc Enrichment
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
                               ELSE ev.is_student_friendly END,
    -- Strukturelle Stamm-Felder (NEU für GSC-Fixer)
    end_date = CASE WHEN src.payload ? 'end_date'
                    THEN NULLIF(src.payload->>'end_date','')::timestamptz
                    ELSE ev.end_date END,
    address = CASE WHEN src.payload ? 'address'
                   THEN src.payload->>'address'
                   ELSE ev.address END,
    price_text = CASE WHEN src.payload ? 'price_text'
                      THEN src.payload->>'price_text'
                      ELSE ev.price_text END,
    price_min = CASE WHEN src.payload ? 'price_min'
                     THEN NULLIF(src.payload->>'price_min','')::numeric
                     ELSE ev.price_min END
  FROM src
  WHERE ev.id = src.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_update_event_enrichment(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_enrichment(jsonb) TO service_role;
