-- API-Rollen konnten interne Tabellen schreiben (Befund 2026-10-08).
--
-- Supabase vergibt per pg_default_acl jede neue Tabelle und View in
-- public mit arwdDxtm an anon und authenticated und verlaesst sich auf
-- RLS. Zehn Tabellen hatten RLS aus. Mit dem oeffentlichen Anon-Key
-- liessen sie sich per REST lesen, ueberschreiben und leeren, darunter
-- event_map_points_payload (get_event_map_points liefert diese Zeile an
-- jeden Kartenbesucher) und sources. Dazu zwei Views, die mit den Rechten
-- ihres Owners supabase_admin laufen, also ohne RLS:
-- poi_activities_public ist automatisch aktualisierbar, ueber sie konnte
-- anon Zeilen in poi_activities einfuegen, aendern und loeschen;
-- source_metrics legte source_runs offen.
--
-- Wer liest und schreibt (Code-Stand 2026-10-08):
--   source_runs, workflow_runs: Scraper, Pipeline und Crons mit
--     SUPABASE_SERVICE_ROLE_KEY (scrapers/index.ts, scrape-reporter.ts,
--     reporting/workflow-run.ts, api/cron/workflow-reports,
--     withdraw-stale-events.ts, location-backfill.ts).
--   analytics_daily: pg_cron-Job rollup_analytics_day als supabase_admin.
--   district_canonical: nur FK-Ziel von events.district. FK-Pruefungen
--     laufen als Owner der Zieltabelle und umgehen RLS.
--   sources, source_metrics, snap_20260914_*: kein Leser im Code.
--   event_map_points_payload: geschrieben von
--     rebuild_event_map_points_payload (pg_cron, supabase_admin), gelesen
--     von get_event_map_points. Die RPC ist SECURITY INVOKER und laeuft
--     fuer /api/events/map-points und /wo-ist-was-los als anon, deshalb
--     behalten anon und authenticated SELECT.
--   poi_activities_public: Lesepfad fuer Client-Reads, SELECT bleibt.
--
-- service_role hat BYPASSRLS, supabase_admin ist Superuser: RLS ohne
-- Policy aendert fuer Pipeline, Crons und Service-Key-Routen nichts. Es
-- ist die zweite Sperre, falls jemand die Rechte wieder vergibt.
-- Neue Tabellen und Views sichert 20261008120100_api_rollen_neue_objekte.sql ab.

-- 1) Interne Tabellen: API-Rollen ganz raus, service_role bleibt.
REVOKE ALL ON public.analytics_daily, public.district_canonical,
  public.source_runs, public.sources, public.workflow_runs
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_canonical ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- 2) Sicherungen vom 14.09.: nur noch fuer DB-Admins (postgres,
--    supabase_admin). Sie entstanden per Hand, nicht per Migration, und
--    fehlen in einer frisch aufgebauten DB.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'snap_20260914_bundesland_fix',
    'snap_20260914_conflict_publish',
    'snap_20260914_legacy_ctx_region',
    'snap_20260914_shared_addresses'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 3) Karten-Payload: nur lesen.
REVOKE ALL ON public.event_map_points_payload FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_map_points_payload TO anon, authenticated;
ALTER TABLE public.event_map_points_payload ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_map_points_payload_read ON public.event_map_points_payload;
CREATE POLICY event_map_points_payload_read ON public.event_map_points_payload
  FOR SELECT TO anon, authenticated USING (true);

-- 4) Views mit Owner-Rechten: poi_activities_public nur lesen,
--    source_metrics gar nicht.
REVOKE ALL ON public.poi_activities_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.poi_activities_public TO anon, authenticated;
REVOKE ALL ON public.source_metrics FROM PUBLIC, anon, authenticated;

-- 5) Pruefung: keine Tabelle ohne RLS und keine View in public darf fuer
--    anon oder authenticated noch schreibbar sein. Sonst bricht die
--    Migration ab und rollt zurueck.
DO $$
DECLARE
  offen text;
BEGIN
  SELECT string_agg(format('%s (%s)', c.relname, r.rolname), ', ' ORDER BY c.relname, r.rolname)
    INTO offen
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
  WHERE n.nspname = 'public'
    AND ((c.relkind IN ('r', 'p') AND NOT c.relrowsecurity) OR c.relkind = 'v')
    AND (has_table_privilege(r.rolname, c.oid, 'INSERT')
      OR has_table_privilege(r.rolname, c.oid, 'UPDATE')
      OR has_table_privilege(r.rolname, c.oid, 'DELETE')
      OR has_table_privilege(r.rolname, c.oid, 'TRUNCATE'));

  IF offen IS NOT NULL THEN
    RAISE EXCEPTION 'API-Rollen koennen weiterhin schreiben: %', offen;
  END IF;
END $$;
