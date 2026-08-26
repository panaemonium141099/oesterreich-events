-- Index fuer die Event-Sitemap-SHARDS (2026-08-26, Nachfolger des
-- Keyset-Fixes vom selben Tag).
--
-- Befund: Der 15.000-URL-Cap aus 55bd3b0 war eine Notloesung — die Micro-
-- Instanz schafft nicht mehr Zeilen in EINEM Request (Random-Heap-I/O
-- linear: 15k ~6 s, 45k ~21,5 s). Damit fehlten ~68.000 von ~82.600
-- sitemap-faehigen Events in der Sitemap.
--
-- Loesung: 8 Shard-Dateien, gesharded ueber den uuid-Raum der Event-id
-- (random uuids: gemessen 10.195-10.611 Zeilen pro Achtel). Jeder Shard
-- ist ein eigener Request mit eigenem CDN-Cache und liest sein Fenster
-- per Keyset ueber id ASC — dafuer dieser Teilindex:
--
--   EXPLAIN ANALYZE Prod 2026-08-26, 1000er-Seite im Fenster [0x40,0x60):
--   Index Scan using idx_events_sitemap_shard, 426 ms (1.403 Buffer)
--   -> ~11 Seiten * ~0,4 s = deutlich unter dem alten 6-s-Single-Shot.
--
-- WARTUNG: Der start_date-Floor ist bewusst statisch (CURRENT_DATE ist
-- nicht immutable; die Route schickt ein Datums-LITERAL, damit der
-- Planner die Implikation beweisen kann). Etwa jaehrlich mit hoeherem
-- Floor neu anlegen, wenn die Shard-Laufzeit wieder steigt.
--
-- CONCURRENTLY, damit der Aufbau auf der Micro-Instanz keine
-- Schreibsperre auf events (~280k Zeilen) haelt. Auf Prod bereits aktiv.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_sitemap_shard
  ON public.events (id)
  WHERE publish_status = 'published'
    AND quality_score >= 40
    AND start_date >= '2026-08-01';

-- Der Keyset-Index der 15k-Cap-Fassung (quality_score DESC, id) wird von
-- den Shards nicht mehr benutzt — die quality-Sortierung diente nur der
-- AUSWAHL unter dem Cap. ERST droppen, nachdem der Shard-Code deployed
-- ist: der alte Code faellt sonst in den langsamen Pfad zurueck (500er).
DROP INDEX CONCURRENTLY IF EXISTS idx_events_sitemap_keyset_v2;
