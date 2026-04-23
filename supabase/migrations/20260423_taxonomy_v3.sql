-- ============================================================================
-- Migration: Taxonomy v3 — 11 Hauptkategorien + occasion_tags + price_flags
--
-- Source-of-truth: docs/TAXONOMY.md
-- Replaces the old 14-cat taxonomy. Adds two new enrichment axes
-- (occasion_tags, price_flags) as array columns.
--
-- Order of operations:
--   1. Add new columns (additive, non-breaking)
--   2. Map old category values → new ones (mass UPDATE)
--   3. Optionally reset enrichment_version so the next enrichment run
--      picks up all rows with the new v3 prompt.
-- ============================================================================

-- ────────────────── 1. New array columns ──────────────────

alter table events
  add column if not exists occasion_tags text[] not null default '{}'::text[];

alter table events
  add column if not exists price_flags text[] not null default '{}'::text[];

-- Optional GIN indexes to make tag-array filters fast on the API layer
create index if not exists idx_events_occasion_tags
  on events using gin (occasion_tags);

create index if not exists idx_events_price_flags
  on events using gin (price_flags);

-- ────────────────── 2. Old → New category mapping ──────────────────

-- Mass UPDATE: rename categories to the v3 scheme. Idempotent — a second
-- run is a no-op because the WHERE filters on the OLD value only.

update events set category = 'Kultur & Bühne'             where category = 'Kultur';
update events set category = 'Sport & Bewegung'           where category = 'Sport';
update events set category = 'Märkte & Feste'             where category in ('Märkte', 'Feste & Brauchtum');
update events set category = 'Essen & Trinken'            where category = 'Wein & Kulinarik';
update events set category = 'Familie & Kinder'           where category = 'Familie';
update events set category = 'Natur & Abenteuer'          where category = 'Natur';
update events set category = 'Nightlife & Party'          where category = 'Nightlife';
update events set category = 'Wissen & Karriere'          where category in ('Bildung', 'Wirtschaft');
update events set category = 'Wellness & Spiritualität'   where category in ('Gesundheit', 'Religion');
-- Sonstiges stays Sonstiges.
-- Musik stays Musik.

-- Also normalize tags arrays — remove category-style values that shouldn't
-- be in the activity tags anymore (Nightlife was both a category AND in
-- some rows' tags, confusing the display).
update events
  set tags = array_remove(tags, 'Nightlife')
  where 'Nightlife' = any(tags);

-- ────────────────── 3. Force re-enrichment with v3 prompt ──────────────────

-- Blank out enrichment_version on rows classified before the v3 rework
-- so `npm run enrich-openai` picks them up and writes primary_category
-- + occasion_tags + price_flags from the new prompt. Preserves the
-- enrichment_at timestamp as a history marker.
--
-- Comment this out if you don't want to rerun enrichment; the mapping
-- above is sufficient to fix the category name, but without the rerun
-- the new fields (occasion_tags, price_flags, refined tags) stay empty.

update events
  set enrichment_version = null
  where enrichment_version = 'enrich-v1-prompt1';

-- ────────────────── 4. Sanity check output ──────────────────

-- Print the new category distribution — should match the 11 v3 cats + Sonstiges
do $$
declare
  r record;
begin
  raise notice 'Category distribution after migration:';
  for r in
    select category, count(*) as n
    from events
    group by category
    order by n desc
  loop
    raise notice '  % : %', r.category, r.n;
  end loop;
end $$;
