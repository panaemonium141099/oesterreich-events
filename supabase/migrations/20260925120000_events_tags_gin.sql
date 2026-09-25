-- Saison-Karte der Landing + Tag-Filter (/entdecken?saison=…, /api/events?tags=…)
-- filtern mit `tags && ARRAY[…]`. Ohne Index las die Abfrage ~20.000 Heap-
-- Blöcke (134 ms im Leerlauf) und lief beim Build unter Last in das
-- statement_timeout der anon-Rolle (3 s): die Landing wurde mit leerer
-- Saison-Karte gebaut und gecacht (PostgREST-Log 2026-09-25 10:24:51).
-- Mit dem partiellen GIN-Index: 404 Blöcke, 6,5 ms. Größe ~1 MB.
--
-- Ausführen als supabase_admin (CONCURRENTLY nicht in einer Transaktion):
--   docker exec supabase-db psql -U supabase_admin -d postgres -f …
-- Auf Prod ausgeführt 2026-09-25 inkl. ANALYZE.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_tags_published_gin
  ON public.events USING gin (tags)
  WHERE publish_status = 'published';

ANALYZE public.events;
