-- ============================================================================
-- COMBINED MIGRATION — Taxonomy v3 + pgvector + semantic search
--
-- Idempotent. Safe to paste into Supabase SQL-Editor multiple times.
-- Replaces the previous split 20260423_taxonomy_v3.sql and
-- 20260423_semantic_search_embeddings.sql — use this ONE.
--
-- Covers:
--   1. Column adds on events (occasion_tags, price_flags, embedding, embedding_hash)
--   2. GIN + ivfflat indexes
--   3. Old → New category value mapping (14-cat → 11-cat)
--   4. enrichment_version reset so the enrich-openai rerun picks up all rows
--   5. pgvector extension + semantic-search RPC
--   6. Schema cache reload notification
--   7. Verification queries at the end — if any fail, the migration is incomplete
-- ============================================================================

-- Raise timeout from the SQL-Editor default 60s → 10 min for the mass UPDATEs.
set statement_timeout = '10min';

-- ─────────────────── 1. Extensions ───────────────────
create extension if not exists vector;

-- ─────────────────── 2. Columns ───────────────────
alter table events add column if not exists occasion_tags text[] not null default '{}'::text[];
alter table events add column if not exists price_flags   text[] not null default '{}'::text[];
alter table events add column if not exists embedding      vector(1536);
alter table events add column if not exists embedding_hash text;

-- ─────────────────── 3. Indexes ───────────────────
create index if not exists idx_events_occasion_tags     on events using gin (occasion_tags);
create index if not exists idx_events_price_flags       on events using gin (price_flags);
create index if not exists idx_events_embedding_cosine  on events using ivfflat (embedding vector_cosine_ops) with (lists = 50);

-- ─────────────────── 4. Old → New category mapping ───────────────────
-- WHERE filters on the OLD values only → running twice is a no-op.
update events set category = 'Kultur & Bühne'           where category = 'Kultur';
update events set category = 'Sport & Bewegung'         where category = 'Sport';
update events set category = 'Märkte & Feste'           where category in ('Märkte', 'Feste & Brauchtum');
update events set category = 'Essen & Trinken'          where category = 'Wein & Kulinarik';
update events set category = 'Familie & Kinder'         where category = 'Familie';
update events set category = 'Natur & Abenteuer'        where category = 'Natur';
update events set category = 'Nightlife & Party'        where category = 'Nightlife';
update events set category = 'Wissen & Karriere'        where category in ('Bildung', 'Wirtschaft');
update events set category = 'Wellness & Spiritualität' where category in ('Gesundheit', 'Religion');
-- Sonstiges and Musik unchanged.

-- Clean old "Nightlife" token from tags arrays (it was both a category and a tag).
update events set tags = array_remove(tags, 'Nightlife') where 'Nightlife' = any(tags);

-- ─────────────────── 5. Reset enrichment so the v3 rerun processes every row ───────────────────
update events set enrichment_version = null where enrichment_version = 'enrich-v1-prompt1';

-- ─────────────────── 6. Semantic-search RPC ───────────────────
create or replace function search_events_semantic(
  query_embedding vector(1536),
  match_limit int default 20,
  min_similarity real default 0.0,
  filter_after_date timestamptz default null,
  filter_max_price_tier text default null
)
returns table (
  id uuid,
  title text,
  similarity real
)
language sql
stable
as $$
  select
    e.id,
    e.title,
    (1 - (e.embedding <=> query_embedding))::real as similarity
  from events e
  where e.embedding is not null
    and (filter_after_date is null or e.start_date >= filter_after_date)
    and (
      filter_max_price_tier is null
      or (filter_max_price_tier = 'gratis'  and e.price_tier in ('gratis'))
      or (filter_max_price_tier = 'günstig' and e.price_tier in ('gratis','günstig'))
      or (filter_max_price_tier = 'mittel'  and e.price_tier in ('gratis','günstig','mittel'))
    )
    and (1 - (e.embedding <=> query_embedding)) >= min_similarity
  order by e.embedding <=> query_embedding
  limit match_limit;
$$;

-- ─────────────────── 7. Force PostgREST schema-cache reload ───────────────────
-- Double-notify with a pause — PostgREST sometimes debounces consecutive
-- notifies within a few ms of each other.
notify pgrst, 'reload schema';
select pg_sleep(1);
notify pgrst, 'reload schema';

-- ─────────────────── 8. VERIFICATION ───────────────────
-- If any of these raise, the migration is incomplete — re-run this file.

do $$
declare
  col_count int;
  missing text;
  category_count int;
begin
  -- Check all required columns exist
  select count(*) into col_count
  from information_schema.columns
  where table_name = 'events'
    and column_name in ('occasion_tags', 'price_flags', 'embedding', 'embedding_hash');
  if col_count <> 4 then
    select string_agg(name, ', ') into missing
    from (
      select unnest(array['occasion_tags','price_flags','embedding','embedding_hash']) as name
    ) required
    where name not in (
      select column_name from information_schema.columns where table_name = 'events'
    );
    raise exception 'Missing columns on events: %', missing;
  end if;

  -- Check no legacy category values remain
  select count(*) into category_count
  from events
  where category in ('Kultur','Sport','Märkte','Feste & Brauchtum','Wein & Kulinarik',
                     'Familie','Natur','Nightlife','Bildung','Wirtschaft',
                     'Gesundheit','Religion');
  if category_count > 0 then
    raise exception 'Legacy category values still present in % rows. Re-run the UPDATEs.', category_count;
  end if;

  -- Check RPC exists
  if not exists (
    select 1 from pg_proc where proname = 'search_events_semantic'
  ) then
    raise exception 'search_events_semantic RPC missing. Re-run migration.';
  end if;

  raise notice '────────────────────────────────────────────';
  raise notice '✓ All 4 columns present (occasion_tags, price_flags, embedding, embedding_hash)';
  raise notice '✓ No legacy category values remain in events.category';
  raise notice '✓ search_events_semantic RPC is installed';
  raise notice '✓ PostgREST schema cache reload signal sent';
  raise notice '';
  raise notice 'Ready to run enrichment:';
  raise notice '  npm run enrich-openai -- --model gpt-5-mini --log-file data/enrich-v3.jsonl';
  raise notice '────────────────────────────────────────────';
end $$;

-- Final sanity: print the category distribution
select category, count(*) as n
from events
group by category
order by n desc;
