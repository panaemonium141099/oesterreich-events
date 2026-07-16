-- fn-16 Liste (Option A, User-Go 2026-07-16): Anzeige-Details fürs
-- sichtbare Listen-Fenster per 12-Hex-Short-IDs. LATERAL + LIMIT erzwingt
-- den reinen PK-Index-Scan pro ID (0,9 ms für 2 IDs); die v1-JOIN-Form
-- ließ den Planner publish_status-/enrichment-Indizes (je ~240k Zeilen)
-- per BitmapAnd dazumischen (821 ms). Publish-/Visibility-Filter bewusst
-- NACH dem Lookup (Subquery-Fence). SECURITY DEFINER + anon-GRANT:
-- liefert ausschließlich Publiziertes.
CREATE OR REPLACE FUNCTION public.get_event_details_by_short_ids(short_ids text[])
RETURNS TABLE (
  id uuid, slug text, title text, image_url text, location_name text,
  address text, postal_code text, start_date timestamptz, end_date timestamptz,
  price_text text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.id, e.slug, e.title, e.image_url, e.location_name,
         e.address, e.postal_code, e.start_date, e.end_date, e.price_text
  FROM unnest(short_ids) AS s
  CROSS JOIN LATERAL (
    SELECT * FROM events x
    WHERE x.id >= (substr(s,1,8)||'-'||substr(s,9,4)||'-0000-0000-000000000000')::uuid
      AND x.id <= (substr(s,1,8)||'-'||substr(s,9,4)||'-ffff-ffff-ffffffffffff')::uuid
    ORDER BY x.id
    LIMIT 2
  ) e
  WHERE array_length(short_ids, 1) <= 48
    AND s ~ '^[0-9a-f]{12}$'
    AND e.visibility = 'public'
    AND e.publish_status IN ('published','published_low_confidence');
$$;

GRANT EXECUTE ON FUNCTION public.get_event_details_by_short_ids(text[]) TO anon, authenticated;
