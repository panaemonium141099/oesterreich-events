-- Replace idx_events_map_publishable (start_date) with a (start_date, id)
-- variant so the default /api/events ORDER BY start_date, id LIMIT N can be
-- served straight from the index — no Incremental Sort.
--
-- The old single-column index forced Postgres to use Incremental Sort,
-- which has to consume every row sharing a given start_date before it can
-- emit the first LIMIT-N rows. With ~1000 events sharing the date-only
-- timestamp `<today> 00:00:00+00`, that meant 1061 heap lookups per
-- LIMIT 51 instead of 51. Under cross-cron CPU contention (warm-cache
-- pumping 183 parallel /api/events?limit=10000 calls every hour after
-- every deploy) this drove the query from <50 ms baseline to 10–35 s,
-- past Vercel's function timeout — symptoms: only ~9k of 101k events
-- loaded on the map, admin panel returned empty, /api/events timed out.
--
-- Post-fix: 51 heap lookups, 54 buffer touches, <1 ms warm cache,
-- <2 s under heavy concurrent load. Index size 5.7 MB (vs 2.6 MB old).
--
-- Also adds `visibility = 'public'` to the partial WHERE so the residual
-- visibility check on each tuple disappears. visibility has been NOT NULL
-- DEFAULT 'public' since migration 20260428220000 and 100 % of rows hold
-- that value, so the predicate is universal in practice and free here.

CREATE INDEX IF NOT EXISTS idx_events_map_publishable_v2
ON public.events (start_date, id)
WHERE publish_status IN ('published','published_low_confidence')
  AND visibility = 'public'
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

DROP INDEX IF EXISTS public.idx_events_map_publishable;
