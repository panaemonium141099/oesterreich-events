-- Merkliste und Künstler-Benachrichtigungen auf den Primary umhängen,
-- auch wenn mehrere Duplikate desselben Events betroffen sind.
--
-- Befund 2026-10-07 (erster Lauf des neuen Dedups, 18k neue Duplikate):
-- Die alte Fassung löschte nur Zeilen, deren Nutzer den Primary schon hatte.
-- Hatten zwei Duplikate desselben Primary je eine Zeile für denselben Nutzer
-- (und Künstler), hängte das UPDATE beide auf den Primary um →
-- uq_artist_event_notification verletzt → die ganze Funktion rollte zurück,
-- auch die Merklisten. Jetzt bleibt je (Nutzer, Primary[, Künstler]) genau
-- eine Zeile: die älteste, oder keine, wenn der Primary schon da ist.

CREATE OR REPLACE FUNCTION public.rewire_saved_events_to_primaries()
 RETURNS TABLE(rewired_saved_events integer, rewired_artist_notifications integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  saved_deleted int;
  saved_updated int;
  notif_deleted int;
  notif_updated int;
BEGIN
  WITH mapped AS (
    SELECT se.id,
           EXISTS (
             SELECT 1 FROM saved_events s2
             WHERE s2.user_id = se.user_id AND s2.event_id = e.duplicate_of
           ) AS has_primary,
           row_number() OVER (
             PARTITION BY se.user_id, e.duplicate_of
             ORDER BY se.created_at, se.id
           ) AS rn
    FROM saved_events se
    JOIN events e ON e.id = se.event_id
    WHERE e.publish_status = 'duplicate'
      AND e.duplicate_of IS NOT NULL
  )
  DELETE FROM saved_events se
  USING mapped m
  WHERE se.id = m.id
    AND (m.has_primary OR m.rn > 1);
  GET DIAGNOSTICS saved_deleted = ROW_COUNT;

  UPDATE saved_events se
  SET event_id = e.duplicate_of
  FROM events e
  WHERE se.event_id = e.id
    AND e.publish_status = 'duplicate'
    AND e.duplicate_of IS NOT NULL;
  GET DIAGNOSTICS saved_updated = ROW_COUNT;

  WITH mapped AS (
    SELECT n.id,
           EXISTS (
             SELECT 1 FROM artist_event_notifications n2
             WHERE n2.user_id = n.user_id
               AND n2.event_id = e.duplicate_of
               AND n2.artist_name = n.artist_name
           ) AS has_primary,
           row_number() OVER (
             PARTITION BY n.user_id, e.duplicate_of, n.artist_name
             ORDER BY n.created_at, n.id
           ) AS rn
    FROM artist_event_notifications n
    JOIN events e ON e.id = n.event_id
    WHERE e.publish_status = 'duplicate'
      AND e.duplicate_of IS NOT NULL
  )
  DELETE FROM artist_event_notifications n
  USING mapped m
  WHERE n.id = m.id
    AND (m.has_primary OR m.rn > 1);
  GET DIAGNOSTICS notif_deleted = ROW_COUNT;

  UPDATE artist_event_notifications n
  SET event_id = e.duplicate_of
  FROM events e
  WHERE n.event_id = e.id
    AND e.publish_status = 'duplicate'
    AND e.duplicate_of IS NOT NULL;
  GET DIAGNOSTICS notif_updated = ROW_COUNT;

  rewired_saved_events := saved_deleted + saved_updated;
  rewired_artist_notifications := notif_deleted + notif_updated;
  RETURN NEXT;
END;
$function$;
