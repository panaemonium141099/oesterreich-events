-- Aktivitaeten-Ranking (2026-08-26): quality_score statt Alphabet.
--
-- /aktivitaeten und /api/activities sortierten stumpf nach name ASC —
-- oben stand, was zufaellig mit A beginnt. Jetzt: vorberechneter Score
-- aus Content-Qualitaet + Saison-Signal + taeglichem Rotations-Jitter.
--
-- Datenlage (10.546 sichtbare Deskline-POIs): 98 % mit Bild, 58 % mit
-- echter Beschreibung (>=200 Zeichen), 44 % mit Oeffnungszeiten,
-- 127 online buchbar.
--
-- Score-Komponenten (max ~75 Basis + 10 Saison + 7 Jitter):
--   Beschreibung  >=600: 25 | >=200: 18 | >0: 8
--   Bilder        >=3: 20 | >=1: 12
--   Oeffnungszeiten gepflegt: +10
--   online_bookable: +8   description_short: +4
--   Saison: aktuell in einer from/to-Periode: +10;
--           Perioden vorhanden, aber keine aktuell: -15 (Saisonbetrieb zu)
--   Jitter: hashtext(id || current_date) & 7 -> 0-7, taeglich neu —
--           mischt innerhalb der Score-Baender, damit die Liste rotiert,
--           ohne die Cursor-Pagination innerhalb eines Tages zu brechen.
--
-- Der Recompute laeuft taeglich 04:40 via pg_cron (nach dem Scrape-Lauf;
-- 10,5k-Zeilen-UPDATE ist auch auf der Micro-Instanz billig) und einmal
-- initial in dieser Migration.

ALTER TABLE public.poi_activities
  ADD COLUMN IF NOT EXISTS quality_score integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recompute_activity_quality_scores()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.poi_activities SET quality_score =
      CASE WHEN length(coalesce(description, '')) >= 600 THEN 25
           WHEN length(coalesce(description, '')) >= 200 THEN 18
           WHEN length(coalesce(description, '')) > 0 THEN 8
           ELSE 0 END
    + CASE WHEN jsonb_typeof(images) = 'array' AND jsonb_array_length(images) >= 3 THEN 20
           WHEN jsonb_typeof(images) = 'array' AND jsonb_array_length(images) >= 1 THEN 12
           ELSE 0 END
    + CASE WHEN jsonb_typeof(opening_times) = 'array' AND jsonb_array_length(opening_times) > 0 THEN 10 ELSE 0 END
    + CASE WHEN online_bookable THEN 8 ELSE 0 END
    + CASE WHEN description_short IS NOT NULL AND length(description_short) > 0 THEN 4 ELSE 0 END
    + CASE
        WHEN jsonb_typeof(opening_times) <> 'array' OR jsonb_array_length(opening_times) = 0 THEN 0
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(opening_times) AS p
          WHERE (p->>'from' IS NULL OR p->>'from' <= to_char(CURRENT_DATE, 'YYYY-MM-DD'))
            AND (p->>'to' IS NULL OR p->>'to' >= to_char(CURRENT_DATE, 'YYYY-MM-DD'))
        ) THEN 10
        ELSE -15
      END
    + (hashtext(id::text || CURRENT_DATE::text) & 7);
$$;

-- Bedient die Anzeige-Sortierung (quality_score DESC, id ASC) samt
-- Anzeige-Bedingung als Teilindex.
CREATE INDEX IF NOT EXISTS idx_poi_activities_quality
  ON public.poi_activities (quality_score DESC, id)
  WHERE visible AND NOT is_closed;

SELECT public.recompute_activity_quality_scores();

-- Taeglicher Recompute (Saison + Rotations-Jitter haengen am Datum).
SELECT cron.schedule(
  'recompute-activity-scores',
  '40 4 * * *',
  $$SELECT public.recompute_activity_quality_scores()$$
);
