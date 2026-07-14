-- MASTERPLAN P3: Event-Archivierung. Vergangene Events (>90 Tage) wandern
-- nightly nach events_archive und werden aus events gelöscht — nur Zeilen
-- OHNE Referenzen aus User-/Feature-Tabellen (saved_events, plan_items,
-- reminders, invites, groups, memories, DMs, notifications, activities,
-- festivals, festival_artists) und ohne lebende duplicate_of-/parent-Verweise.
-- Duplikate werden zuerst frei → deren Kanonische folgen im nächsten Lauf.
-- Technische CASCADE-Tabellen (dedup_log, quality_scores/flags,
-- spotify_artist_matches, enrichment_proposals, artist_event_notifications)
-- dürfen mitkaskadieren. Re-Import eines archivierten Alt-Events durch einen
-- Scraper ist möglich (kein Tombstone) — harmlos, wird erneut archiviert.
-- pg_cron-Job wurde separat angelegt:
--   SELECT cron.schedule('archive-old-events', '50 2 * * *',
--     $$SET statement_timeout = '15min'; SELECT public.archive_old_events(5000, 1000);$$);

CREATE TABLE public.events_archive (LIKE public.events);
ALTER TABLE public.events_archive
  ADD COLUMN archived_at timestamptz NOT NULL DEFAULT now(),
  ADD PRIMARY KEY (id);
ALTER TABLE public.events_archive ENABLE ROW LEVEL SECURITY; -- keine Policies: nur service_role

CREATE OR REPLACE FUNCTION public.archive_old_events(max_rows int DEFAULT 5000, batch_size int DEFAULT 1000)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  cols_plain text;
  cols_qualified text;
  moved int;
  total int := 0;
  r record;
BEGIN
  -- Schema-Drift-Selbstheilung: neue events-Spalten in events_archive nachziehen
  FOR r IN
    SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS coltype
    FROM pg_attribute a
    WHERE a.attrelid = 'public.events'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND NOT EXISTS (
        SELECT 1 FROM pg_attribute b
        WHERE b.attrelid = 'public.events_archive'::regclass
          AND b.attnum > 0 AND NOT b.attisdropped AND b.attname = a.attname)
  LOOP
    EXECUTE format('ALTER TABLE public.events_archive ADD COLUMN %I %s', r.attname, r.coltype);
  END LOOP;

  SELECT string_agg(quote_ident(attname), ',' ORDER BY attnum),
         string_agg('e.' || quote_ident(attname), ',' ORDER BY attnum)
    INTO cols_plain, cols_qualified
  FROM pg_attribute
  WHERE attrelid = 'public.events'::regclass AND attnum > 0 AND NOT attisdropped;

  LOOP
    EXIT WHEN total >= max_rows;
    EXECUTE format($q$
      WITH cand AS (
        SELECT e.id FROM public.events e
        WHERE e.start_date < now() - interval '90 days'
          AND (e.end_date IS NULL OR e.end_date < now() - interval '90 days')
          AND NOT EXISTS (SELECT 1 FROM public.events d WHERE d.duplicate_of = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.events c WHERE c.parent_event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.plan_items x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.saved_events x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.event_reminders x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.event_invites x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.group_events x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.notifications x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.activities x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.memories x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.direct_messages x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.group_messages x WHERE x.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.groups x WHERE x.linked_event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.festivals x WHERE x.parent_event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.festival_artists x WHERE x.derived_event_id = e.id)
        ORDER BY e.start_date
        LIMIT %s
      ), ins AS (
        INSERT INTO public.events_archive (%s, archived_at)
        SELECT %s, now() FROM public.events e WHERE e.id IN (SELECT id FROM cand)
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      )
      DELETE FROM public.events WHERE id IN (SELECT id FROM cand)
    $q$, least(batch_size, max_rows - total), cols_plain, cols_qualified);
    GET DIAGNOSTICS moved = ROW_COUNT;
    EXIT WHEN moved = 0;
    total := total + moved;
  END LOOP;

  RETURN total;
END $$;
