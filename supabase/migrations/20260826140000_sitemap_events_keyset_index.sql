-- Index fuer /sitemap-events.xml (Keyset-Pagination).
--
-- Befund 2026-08-26: Die Route lief seit dem Sitemap-Split (25.07.2026)
-- durchgehend auf HTTP 500. Sie blaetterte per OFFSET durch bis zu 45.000
-- Zeilen, sortiert nach quality_score DESC, id. Ohne passenden Index
-- sortierte Postgres pro Seite die gefilterte Menge neu:
--
--   EXPLAIN ANALYZE, Prod, OFFSET 40000 LIMIT 1000
--   -> Incremental Sort ueber Index Scan Backward auf idx_events_quality_score
--   -> 29.138 ms fuer EINE von 45 Seiten
--
-- Folge: keine einzige Event-Detailseite stand in der Sitemap. Google kannte
-- nur core (2.469) + activities (7.605) URLs.
--
-- Die Route liest jetzt per Keyset-Cursor (quality_score, id) weiter. Dieser
-- Teilindex bedient Sortierung und beide statischen Praedikate direkt:
--
--   nachher: 108 ms pro Seite (Faktor 270), ~5 s fuer die ganze Datei
--
-- start_date bleibt bewusst draussen: CURRENT_DATE ist nicht immutable und
-- taugt daher nicht fuer ein Index-Praedikat. Der Datumsfilter laeuft als
-- Recheck auf den ohnehin geholten Heap-Zeilen.
--
-- CONCURRENTLY, damit der Aufbau auf der Micro-Instanz keine Schreibsperre
-- auf events (~280k Zeilen) haelt.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_sitemap_keyset
  ON public.events (quality_score DESC, id)
  WHERE publish_status = 'published' AND quality_score >= 40;
