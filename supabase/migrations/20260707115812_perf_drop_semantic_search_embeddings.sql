-- MASTERPLAN §6 + §10.1: Semantische Suche stillgelegt (Entscheidung 2026-07-07).
-- Embedding-Spalten (~1,6 GB TOAST) + RPC entfernen. Der ivfflat-Index
-- (1,22 GB, 50 Scans insgesamt) fiel in perf_drop_unused_indexes.
DROP FUNCTION IF EXISTS public.search_events_semantic;
ALTER TABLE public.events DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.events DROP COLUMN IF EXISTS embedding_hash;
