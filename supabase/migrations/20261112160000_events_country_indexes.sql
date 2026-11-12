-- Indizes mit dem Land an erster Stelle: die Abfragen der AT-Seite sollen
-- keine DE-Zeilen mehr lesen.
--
-- Befund 2026-11-12 (Prod, EXPLAIN ANALYZE als Rolle anon):
--   * Dorffeste-Abfrage der Startseite (30 Tage, publish_status =
--     'published', country = 'AT', Titel-/Tag-Filter, ORDER BY event_score):
--     3,9 s, Index Scan über idx_events_score_desc, 97.673 Zeilen vom Filter
--     verworfen, 86.116 Seiten gelesen.
--   * Saison-Titelabfrage (60 Tage, ORDER BY quality_score): 7,4 s, Bitmap
--     über idx_events_start_date (208.524 Zeilen im Fenster), 131.129 Zeilen
--     vom Filter verworfen, 103.535 Seiten gelesen.
--   anon hat statement_timeout = 3 s, PostgREST einen Pool von 10
--   Verbindungen: laufen diese Abfragen in die Grenze, wiederholt die
--   Startseite sie, der Pool ist rund 20 s lang voll und jede andere Anfrage
--   bekommt 504 (PGRST003). Seit 09.11.2026 fünfmal, je gut 500 Fehler.
--
-- Ursache: kein Index auf events führt das Land. Kommende veröffentlichte
-- Zeilen am 12.11.2026: AT 79.102, DE 173.849. Unter RLS darf der Planer
-- Titel- und Tag-Filter (ilike, &&: nicht leakproof) nicht als
-- Index-Bedingung nutzen, der treibende Index kommt also immer aus Land,
-- Status und Datum.
--
-- CREATE INDEX CONCURRENTLY läuft nicht in einer Transaktion und nicht über
-- PostgREST: per psql ausführen, danach ANALYZE (CLAUDE.md, Bekannte Issues).
-- Rückweg: DROP INDEX CONCURRENTLY <name>.

-- Datumsfenster je Land (Startseite, Regale, Saison-Guides, /api/events).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_country_start_published
  ON public.events (country, start_date)
  WHERE publish_status IN ('published', 'published_low_confidence');

-- Bundesland-Zähler und -Listen ohne visibility-Filter: der bestehende
-- idx_events_bundesland_start_date verlangt visibility = 'public' und
-- Koordinaten im Prädikat und greift für diese Abfragen nicht (1,0 s,
-- BitmapAnd über vier Indizes, 21.794 Seiten).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_bundesland_start_published
  ON public.events (bundesland, start_date)
  WHERE publish_status IN ('published', 'published_low_confidence');

ANALYZE public.events;
