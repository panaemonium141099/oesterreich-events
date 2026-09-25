-- search_event_ids: nur zeigbare Events, feste Reihenfolge (2026-09-25).
--
-- Befund: /api/events?search=bier lieferte bei identischen Aufrufen 76, dann
-- 102 Events. Die alte RPC hatte kein ORDER BY und kappte bei max_ids (API:
-- 250) über ALLE veröffentlichten Events inkl. vergangener. "bier" traf 564
-- Events, davon nur 223 künftige; welche 250 der Seq-Scan zuerst fand, war
-- Zufall, der anschließende Zukunfts-/Koordinaten-/Länder-Filter der API
-- behielt jedes Mal eine andere Teilmenge (gemessen: 102, 90, 117).
--
-- Neu:
--   * Filter der Liste wandern in die RPC (from_date, countries,
--     require_coords), damit der Cap nur zeigbare Events zählt.
--   * ORDER BY start_date, id — dieselbe Reihenfolge wie die Liste, der Cap
--     schneidet immer dieselben (frühesten) Treffer ab.
--   * Zwei Indexpfade statt Seq-Scan (vorher ~950 ms für "bier"):
--     - längster Begriff >= 3 Zeichen: ILIKE-Vorfilter auf exakt dem Ausdruck
--       von idx_events_search_concat_trgm. Notwendige Bedingung für den
--       normalisierten Wortabgleich, weil jeder Begriff nur aus erlaubten
--       Zeichen besteht und die Normalisierung solche Zeichen unverändert
--       lässt. Gemessen: "bier" 6 ms, "konzert wien" 108 ms.
--     - nur 1-2-Zeichen-Begriffe (Trigramme greifen nicht, Vorfilter wäre ein
--       voller Indexscan, gemessen 1,9 s): in Listenreihenfolge über
--       idx_events_map_publishable_v2 (start_date, id) laufen und nach max_ids
--       Treffern aufhören.
--
-- Alle neuen Parameter haben Defaults, Aufrufe mit (q, max_ids) laufen weiter.
-- from_date steht per Default auf CURRENT_DATE: mit NULL lieferte ein alter
-- Aufruf die 250 ÄLTESTEN Treffer (ORDER BY start_date), alle vergangen.
-- DDL als supabase_admin ausführen (Owner der Funktion).

DROP FUNCTION IF EXISTS public.search_event_ids(text, integer);
DROP FUNCTION IF EXISTS public.search_event_ids(text, integer, date, text[], boolean);

CREATE FUNCTION public.search_event_ids(
  q text,
  max_ids integer DEFAULT 50000,
  from_date date DEFAULT CURRENT_DATE,  -- NULL = auch Vergangenheit
  countries text[] DEFAULT NULL,
  require_coords boolean DEFAULT false
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
STABLE PARALLEL SAFE
AS $function$
DECLARE
  ws text[];
  longest text;
BEGIN
  -- "und" / normalisierte "&","+" sind Rauschen; Begriffe < 2 Zeichen zählen nicht
  SELECT array_agg(w ORDER BY length(w) DESC, w)
    INTO ws
    FROM unnest(regexp_split_to_array(
           btrim(regexp_replace(lower(q), '[^a-z0-9äöüß]+', ' ', 'g')), '\s+')) w
   WHERE w <> 'und' AND length(w) >= 2;

  IF ws IS NULL THEN
    RETURN;
  END IF;
  longest := ws[1];

  IF length(longest) >= 3 THEN
    RETURN QUERY
    SELECT e.id
    FROM events e
    WHERE e.visibility = 'public'
      AND e.publish_status IN ('published', 'published_low_confidence')
      -- Indexierbarer Vorfilter (exakt der Ausdruck von idx_events_search_concat_trgm)
      AND (COALESCE(e.title, '')         || ' ' ||
           COALESCE(e.location_name, '') || ' ' ||
           COALESCE(e.address, '')       || ' ' ||
           COALESCE(e.category, '')) ILIKE '%' || longest || '%'
      AND (from_date IS NULL OR e.start_date >= from_date)
      AND (countries IS NULL OR e.country = ANY (countries))
      AND (NOT require_coords OR (e.latitude IS NOT NULL AND e.longitude IS NOT NULL))
      AND NOT EXISTS (
        SELECT 1 FROM unnest(ws) w
        WHERE regexp_replace(lower(
                COALESCE(e.title, '')         || ' ' ||
                COALESCE(e.location_name, '') || ' ' ||
                COALESCE(e.address, '')       || ' ' ||
                COALESCE(e.category, '')
              ), '[^a-z0-9äöüß]+', ' ', 'g') NOT LIKE '%' || w || '%'
      )
    ORDER BY e.start_date, e.id
    LIMIT max_ids;
  ELSE
    RETURN QUERY
    SELECT e.id
    FROM events e
    WHERE e.visibility = 'public'
      AND e.publish_status IN ('published', 'published_low_confidence')
      AND (from_date IS NULL OR e.start_date >= from_date)
      AND (countries IS NULL OR e.country = ANY (countries))
      AND (NOT require_coords OR (e.latitude IS NOT NULL AND e.longitude IS NOT NULL))
      AND NOT EXISTS (
        SELECT 1 FROM unnest(ws) w
        WHERE regexp_replace(lower(
                COALESCE(e.title, '')         || ' ' ||
                COALESCE(e.location_name, '') || ' ' ||
                COALESCE(e.address, '')       || ' ' ||
                COALESCE(e.category, '')
              ), '[^a-z0-9äöüß]+', ' ', 'g') NOT LIKE '%' || w || '%'
      )
    ORDER BY e.start_date, e.id
    LIMIT max_ids;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_event_ids(text, integer, date, text[], boolean)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
