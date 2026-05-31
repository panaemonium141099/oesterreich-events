-- Extend search_events_semantic with district + bundesland filters.
--
-- The application code (src/app/api/search/semantic/route.ts) had been
-- passing filter_district + filter_bundesland for weeks, with a comment
-- referencing migration "20260520_*_extend_search_events_semantic_with_location_filters".
-- That migration never existed in this repo and was never applied to the
-- database. PostgREST silently failed every RPC call that included the
-- extra args (no matching function signature) → every smart-search query
-- that mentioned a city returned 0 results, even for events with valid
-- embeddings and matching district like "Eisenstadt in Weiß".
--
-- DROP + CREATE because PostgreSQL CREATE OR REPLACE FUNCTION cannot
-- change the signature in place. Applied via Supabase MCP on 2026-05-31.

DROP FUNCTION IF EXISTS public.search_events_semantic(vector, integer, real, timestamp with time zone, text);

CREATE OR REPLACE FUNCTION public.search_events_semantic(
  query_embedding vector,
  match_limit integer DEFAULT 20,
  min_similarity real DEFAULT 0.0,
  filter_after_date timestamp with time zone DEFAULT NULL,
  filter_max_price_tier text DEFAULT NULL,
  filter_bundesland text DEFAULT NULL,
  filter_district text DEFAULT NULL
)
RETURNS TABLE(id uuid, title text, similarity real)
LANGUAGE plpgsql
SET statement_timeout TO '15s'
AS $function$
begin
  set local hnsw.iterative_scan = 'relaxed_order';
  set local hnsw.max_scan_tuples = 20000;

  return query
  select
    e.id,
    e.title,
    (1 - (e.embedding <=> query_embedding))::real as similarity
  from events e
  where e.embedding is not null
    and (filter_after_date is null or e.start_date >= filter_after_date)
    and (
      filter_max_price_tier is null
      or (filter_max_price_tier = 'gratis' and e.price_tier in ('gratis'))
      or (filter_max_price_tier = 'günstig' and e.price_tier in ('gratis','günstig'))
      or (filter_max_price_tier = 'mittel' and e.price_tier in ('gratis','günstig','mittel'))
    )
    -- District filter (most specific). Case-insensitive equality so
    -- 'Eisenstadt' from a UI dropdown matches 'eisenstadt' stored from
    -- the gemeinden registry.
    and (filter_district is null or lower(e.district) = lower(filter_district))
    -- Bundesland filter (broader). The route handler only passes this
    -- when district is null; defensive guard here keeps the contract.
    and (filter_bundesland is null or lower(e.bundesland) = lower(filter_bundesland))
    and (1 - (e.embedding <=> query_embedding)) >= min_similarity
  order by e.embedding <=> query_embedding
  limit match_limit;
end;
$function$;