-- fn-14.2 Migration C: extend bulk_update_event_enrichment for v2 schema.
--
-- Codex-Review-Finding (Critical): the RPC has a fixed allow-list of
-- SET clauses. Any new field added to the JSONB payload by callers
-- (enrich-claude.ts in fn-14.3) gets silently dropped if the RPC
-- doesn't know it. So adding columns alone (Migration A) is not
-- enough — we have to teach the RPC the new keys too.
--
-- New keys handled here (all sparse — only written when the key is
-- present in the payload):
--   enrichment_failed         BOOLEAN — 3-strikes poison-pill flag
--   enrichment_failure_count  INT     — counter, bumped per failure
--   is_dog_friendly           BOOLEAN — fn-14.3 facet
--   is_wheelchair_accessible  BOOLEAN — fn-14.3 facet
--   is_outdoor                BOOLEAN — fn-14.3 facet
--
-- price_min already came in via 20260501130000_bulk_update_enrichment_add_struct_fields.sql,
-- so it's restated here unchanged (CREATE OR REPLACE replaces the
-- entire body).
--
-- Cast-correctness fixes carried into this re-statement
--   The previous RPC body had two mismatches against the live events
--   table that produced runtime errors as soon as a payload triggered
--   their CASE branches:
--     * category_confidence / category_version were cast to
--       double precision / integer, but both columns are TEXT in the
--       live schema → "CASE types text and double precision cannot
--       be matched". Fixed to TEXT.
--     * audience / vibe / occasion_tags / setting / price_flags are
--       text[] in the live schema, but the THEN branches forwarded
--       raw jsonb (`src.payload->'k'`). Fixed to the same
--       jsonb_array_elements_text + array_agg(value)::text[] pattern
--       already used for `tags`. (Inline correlated subqueries via
--       `(SELECT array_agg(...))` keep the CASE-branch type uniform.)
--   These were latent — only this fn-14.2 round-trip RPC test
--   exercised them. Fixing them is in scope because the spec
--   acceptance gate ("Test-Call schreibt alle 6 Felder erfolgreich")
--   cannot pass otherwise.
--
-- Sparse-write contract preserved
--   For every key, the CASE WHEN payload ? 'k' check keeps "not in
--   payload" → "leave column alone". Per-event partial updates remain
--   safe (one event can update description, another can bump
--   enrichment_failure_count, no overwrite of unrelated fields).
--
-- Idempotency
--   CREATE OR REPLACE FUNCTION is itself idempotent. Re-applying this
--   migration just re-defines the same function body.

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
    -- Category-Komplex (all TEXT in the live schema, so no numeric casts)
    category = CASE WHEN src.payload ? 'category'
                    THEN src.payload->>'category'
                    ELSE ev.category END,
    category_candidates = CASE WHEN src.payload ? 'category_candidates'
                               THEN src.payload->'category_candidates'
                               ELSE ev.category_candidates END,
    category_confidence = CASE WHEN src.payload ? 'category_confidence'
                               THEN src.payload->>'category_confidence'
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
                            THEN src.payload->>'category_version'
                            ELSE ev.category_version END,
    -- Tags / Audience / Setting / Occasion / Price-Flags  (all text[] in live schema)
    tags = CASE WHEN src.payload ? 'tags'
                THEN (SELECT array_agg(value)::text[] FROM jsonb_array_elements_text(src.payload->'tags'))
                ELSE ev.tags END,
    audience = CASE WHEN src.payload ? 'audience'
                    THEN (SELECT array_agg(value)::text[] FROM jsonb_array_elements_text(src.payload->'audience'))
                    ELSE ev.audience END,
    vibe = CASE WHEN src.payload ? 'vibe'
                THEN (SELECT array_agg(value)::text[] FROM jsonb_array_elements_text(src.payload->'vibe'))
                ELSE ev.vibe END,
    occasion_tags = CASE WHEN src.payload ? 'occasion_tags'
                         THEN (SELECT array_agg(value)::text[] FROM jsonb_array_elements_text(src.payload->'occasion_tags'))
                         ELSE ev.occasion_tags END,
    setting = CASE WHEN src.payload ? 'setting'
                   THEN (SELECT array_agg(value)::text[] FROM jsonb_array_elements_text(src.payload->'setting'))
                   ELSE ev.setting END,
    -- Duration / Price (Enrichment)
    duration_type = CASE WHEN src.payload ? 'duration_type'
                         THEN src.payload->>'duration_type'
                         ELSE ev.duration_type END,
    price_tier = CASE WHEN src.payload ? 'price_tier'
                      THEN src.payload->>'price_tier'
                      ELSE ev.price_tier END,
    price_flags = CASE WHEN src.payload ? 'price_flags'
                       THEN (SELECT array_agg(value)::text[] FROM jsonb_array_elements_text(src.payload->'price_flags'))
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
    -- Strukturelle Stamm-Felder (aus 20260501130000)
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
                     ELSE ev.price_min END,
    -- v2 NEU (fn-14.2): poison-pill counter
    enrichment_failed = CASE WHEN src.payload ? 'enrichment_failed'
                             THEN (src.payload->>'enrichment_failed')::boolean
                             ELSE ev.enrichment_failed END,
    enrichment_failure_count = CASE WHEN src.payload ? 'enrichment_failure_count'
                                    THEN NULLIF(src.payload->>'enrichment_failure_count','')::integer
                                    ELSE ev.enrichment_failure_count END,
    -- v2 NEU (fn-14.3 Interview): 3 facet booleans
    is_dog_friendly = CASE WHEN src.payload ? 'is_dog_friendly'
                           THEN (src.payload->>'is_dog_friendly')::boolean
                           ELSE ev.is_dog_friendly END,
    is_wheelchair_accessible = CASE WHEN src.payload ? 'is_wheelchair_accessible'
                                    THEN (src.payload->>'is_wheelchair_accessible')::boolean
                                    ELSE ev.is_wheelchair_accessible END,
    is_outdoor = CASE WHEN src.payload ? 'is_outdoor'
                      THEN (src.payload->>'is_outdoor')::boolean
                      ELSE ev.is_outdoor END
  FROM src
  WHERE ev.id = src.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_update_event_enrichment(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_enrichment(jsonb) TO service_role;
