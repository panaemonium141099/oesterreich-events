-- Auswertung je Seite (fn-31.15): lasstreffen.de schreibt in dieselbe Tabelle
-- analytics_events wie lasstreffen.at. Ohne Kennzeichen wären Pageviews und
-- Klicks beider Seiten nicht zu trennen.
--
-- `site` ist das Land der Seite, die das Ereignis gemeldet hat (AT, DE),
-- gesetzt von /api/analytics aus SITE_COUNTRY. Der Bestand (219.051 Zeilen,
-- Prod 16.11.2026) stammt von lasstreffen.at: Vorgabe 'AT', die Spalte kommt
-- ohne Umschreiben der Tabelle dazu (konstante Vorgabe).
--
-- Die Tagesverdichtung analytics_daily bleibt die von lasstreffen.at: die
-- Funktion ist die Prod-Definition (pg_get_functiondef, 16.11.2026) mit der
-- einen zusätzlichen Bedingung `site = 'AT'`. Eigentümer und Rechte bleiben
-- bei CREATE OR REPLACE erhalten.
--
-- Als supabase_admin anwenden:
--   docker compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < <datei>

BEGIN;

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'AT';

COMMENT ON COLUMN public.analytics_events.site IS
  'Land der Seite, die das Ereignis gemeldet hat (AT = lasstreffen.at, DE = lasstreffen.de).';

CREATE OR REPLACE FUNCTION public.rollup_analytics_day(target_day date)
 RETURNS void
 LANGUAGE sql
AS $function$
  INSERT INTO analytics_daily (day, event_type, page_group, events, sessions)
  SELECT
    target_day,
    event_type,
    COALESCE('/' || split_part(trim(leading '/' from COALESCE(page, '')), '/', 1), ''),
    count(*),
    count(DISTINCT session_id)
  FROM analytics_events
  WHERE created_at >= target_day::timestamptz
    AND created_at < (target_day + 1)::timestamptz
    AND site = 'AT'
  GROUP BY 2, 3
  ON CONFLICT (day, event_type, page_group)
  DO UPDATE SET events = EXCLUDED.events, sessions = EXCLUDED.sessions;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
