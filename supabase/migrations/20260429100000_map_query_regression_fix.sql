-- Map-Query Regression-Fix (2026-04-29)
--
-- Symptom: User berichtet "Map dauert 10x länger nach Mach D".
-- Root cause: in /api/events/route.ts gab's noch `OR visibility IS NULL` und
-- `OR publish_status IS NULL` Filter. Beide Spalten sind seit Mach D NOT NULL,
-- aber der Filter blieb stehen. PostgreSQL kann bei `(col = X OR col IS NULL)`
-- keinen index-only-scan oder bitmap-AND nutzen → SeqScan auf 175k Events.
--
-- pg_stat_statements zeigte mean 6.6s pro Map-Request (vorher 1.0s).
--
-- Fix in 3 Teilen:
--   1. (DB hier) publish_status NOT NULL DEFAULT 'published'
--      → Planner versteht dass IS NULL impossible ist
--   2. (DB hier) Partial Index für Map-Query Pattern
--   3. (Code in src/app/api/events/route.ts) WHERE-Klausel ohne OR IS NULL
--
-- Nach den Fixes: IndexScan auf idx_events_publish_status, Plan-Cost 41k → 2.7k.

-- 1. publish_status NOT NULL (verifiziert: 0/175k haben IS NULL)
ALTER TABLE public.events ALTER COLUMN publish_status SET DEFAULT 'published';
ALTER TABLE public.events ALTER COLUMN publish_status SET NOT NULL;

-- 2. Partial Index — kovert Map-Query Pattern (publishable + geocoded events)
CREATE INDEX IF NOT EXISTS idx_events_map_publishable
  ON public.events (start_date)
  WHERE publish_status IN ('published', 'published_low_confidence')
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL;

ANALYZE public.events;
