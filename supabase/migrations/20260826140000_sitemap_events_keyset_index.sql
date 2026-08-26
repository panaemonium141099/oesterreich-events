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
-- Teilindex bedient Sortierung und alle drei Praedikate direkt.
--
-- Warum das statische start_date-Praedikat:
-- Rund 57.000 laengst vergangene Events liegen zwischen den kommenden im
-- Index und wurden bei jedem Lauf sinnlos vom Heap geholt. CURRENT_DATE
-- taugt nicht als Praedikat (nicht immutable) UND nicht als Query-Bedingung,
-- weil der Planner die Implikation dann nicht beweisen kann und den Index
-- verwirft. Die Route schickt deshalb ein Datums-LITERAL
-- (`new Date().toISOString().split('T')[0]`), womit der Beweis gelingt:
--
--   45.000 Zeilen ohne Floor: 30.451 ms, 57.030 Zeilen verworfen
--   45.000 Zeilen mit Floor:  21.517 ms, 16.675 Zeilen verworfen
--   15.000 Zeilen mit Floor:   5.973 ms  <- gewaehlter MAX_URLS
--
-- WARTUNG: Der Floor ist bewusst statisch. Er verrottet nicht gefaehrlich,
-- der Index wird ueber die Jahre nur wieder breiter und damit langsamer.
-- Etwa jaehrlich neu anlegen (hoeherer Floor, altes Index droppen), wenn
-- die Sitemap-Laufzeit wieder steigt.
--
-- CONCURRENTLY, damit der Aufbau auf der Micro-Instanz keine Schreibsperre
-- auf events (~280k Zeilen) haelt.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_sitemap_keyset_v2
  ON public.events (quality_score DESC, id)
  WHERE publish_status = 'published'
    AND quality_score >= 40
    AND start_date >= '2026-08-01';

-- Erste Fassung ohne start_date-Floor — vom v2-Index vollstaendig abgeloest.
DROP INDEX CONCURRENTLY IF EXISTS idx_events_sitemap_keyset;
