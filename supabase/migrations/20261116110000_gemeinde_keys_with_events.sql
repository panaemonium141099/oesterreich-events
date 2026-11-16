-- Gemeinden mit kommenden Events für die Sitemap von lasstreffen.de (fn-31.11).
--
-- lasstreffen.de hat rund 10.700 Gemeinde-Seiten; unter drei Events im Umkreis
-- ist eine Seite noindex. In die Sitemap gehören deshalb nur Gemeinden mit
-- genug eigenen kommenden Events. PostgREST kennt kein GROUP BY und kappt jede
-- Antwort bei 1000 Zeilen: die Funktion liefert EIN Array.
--
-- Gelesen wird nur der Index idx_events_gemeinde_start_published
-- (gemeinde_key, start_date; veröffentlichte Zeilen). Der führt kein Land,
-- das Land steckt in der Länge des Schlüssels: AGS hat 8 Stellen (Deutschland),
-- die österreichische Gemeindekennziffer 5 (src/lib/location/region-keys.ts).
-- Gemessen in Prod am 16.11.2026: 1,9 s kalt, 0,2 s warm, 2.917 Gemeinden ab
-- fünf Events. Dieselbe Zählung über die Tabelle mit `country = 'DE'` brauchte
-- 16,7 s (105.258 Blöcke).
--
-- Nur service_role (die Sitemap-Route liest mit dem Service-Key).

BEGIN;

CREATE OR REPLACE FUNCTION public.gemeinde_keys_with_events(p_key_length integer, p_min integer DEFAULT 5)
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT coalesce(array_agg(k ORDER BY k), '{}')
  FROM (
    SELECT gemeinde_key AS k
    FROM events
    WHERE gemeinde_key IS NOT NULL
      AND publish_status IN ('published', 'published_low_confidence')
      AND start_date >= now()
      AND length(gemeinde_key) = p_key_length
    GROUP BY 1
    HAVING count(*) >= p_min
  ) t;
$function$;

REVOKE ALL ON FUNCTION public.gemeinde_keys_with_events(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gemeinde_keys_with_events(integer, integer) TO service_role, postgres;

NOTIFY pgrst, 'reload schema';

COMMIT;
