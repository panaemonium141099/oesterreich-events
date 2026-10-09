-- EXECUTE-Rechte aller Funktionen in public auf den Bedarf zurückschneiden
-- und neue Funktionen standardmäßig nicht mehr öffentlich anlegen.
--
-- Befund 2026-10-07/08 (Prod, pg_proc.proacl): alle 46 Funktionen waren für
-- anon ausführbar (30 davon SECURITY DEFINER), darunter get_artist_appearances(uuid) (gefolgte Künstler
-- beliebiger Nutzer), Cron-Funktionen wie rollup_analytics_day (schreibt in
-- analytics_daily, Tabelle ohne RLS) und die schweren match_*-Scans.
-- Ursache der Abweichung von den Migrationen: pg_default_acl vergibt in
-- public EXECUTE ausdrücklich an anon und authenticated, dazu kommt das
-- eingebaute EXECUTE für PUBLIC. `REVOKE ... FROM PUBLIC` lässt die
-- Einzelrechte stehen, `REVOKE ... FROM anon, authenticated` das PUBLIC-Recht
-- (so blieb die Sperre in 20260428220000 wirkungslos).
--
-- Bedarf laut Code (rpc()-Aufrufe in src/ und supabase/functions/, Stand
-- 2026-10-08) und Prod (pg_policies, cron.job, pg_depend):
--
--   anon + authenticated (unverändert, hier nicht angefasst):
--     search_event_ids, get_event_map_points, get_event_details_by_short_ids,
--     event_counts_for_stats, student_event_counts_by_bundesland,
--     nearby_stays, search_activities
--     is_god, is_group_member, is_group_creator, user_group_ids
--       (stehen in RLS-Policies für die Rolle public; Policies prüfen
--        EXECUTE beim Aufrufer, ein Entzug bräche jedes SELECT auf groups)
--   nur authenticated (+ service_role):
--     match_exact_artist_title, match_fuzzy_artist_titles,
--     match_artist_descriptions, match_lineup_artists
--       (api/artists/follow und auth/spotify/callback rufen sie mit dem
--        Nutzer-Client auf)
--   nur service_role: alles Übrige (Skripte mit Service-Key, Edge-Functions
--     mit Service-Key, pg_cron läuft als supabase_admin).
--
-- Triggerfunktionen werden mitgesperrt: Postgres prüft EXECUTE nur beim
-- Anlegen des Triggers, nicht beim Feuern (auf Prod in einer
-- zurückgerollten Transaktion belegt: anon ohne EXECUTE, Trigger lief).
--
-- postgres behält EXECUTE überall (Studio/pg-meta verbindet als postgres und
-- hatte das Recht bisher über PUBLIC).
--
-- Die ersten zehn Sperren stehen schon in 20261008120000 und sind in Prod
-- aktiv; sie stehen hier noch einmal (idempotent), damit diese Datei den
-- Sollzustand aller Funktionen vollständig beschreibt.

-- ---------------------------------------------------------------------------
-- 1. Nur service_role
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER, schreibend (bereits 20261008120000)
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_publish(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_scores(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_enrichment(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_geocoding(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_slugs(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_replace_event_quality_flags(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_upsert_event_quality_scores(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_derived_event(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_enrichment_chunk(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rewire_saved_events_to_primaries() FROM PUBLIC, anon, authenticated;

-- SECURITY DEFINER, lesend
REVOKE EXECUTE ON FUNCTION public.get_artist_appearances(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_exact_artist_titles_batch(text[], timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_exact_artist_titles_music_only(text[], timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seo_count_indexable_gemeinde_hubs() FROM PUBLIC, anon, authenticated;

-- SECURITY INVOKER, Cron und Skripte
REVOKE EXECUTE ON FUNCTION public.archive_old_events(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dedup_eventim_wins() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rollup_analytics_day(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rebuild_event_map_points_payload() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_activity_quality_scores() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_location_name(text) FROM PUBLIC, anon, authenticated;

-- Triggerfunktionen
REVOKE EXECUTE ON FUNCTION public.cleanup_event_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_group() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_role_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.plans_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_venues_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_image_probe_on_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_event_submissions_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.bulk_update_event_publish(jsonb),
  public.bulk_update_event_scores(jsonb),
  public.bulk_update_event_enrichment(jsonb),
  public.bulk_update_event_geocoding(jsonb),
  public.bulk_update_event_slugs(jsonb),
  public.bulk_replace_event_quality_flags(jsonb),
  public.bulk_upsert_event_quality_scores(jsonb),
  public.delete_derived_event(uuid),
  public.reset_enrichment_chunk(integer),
  public.rewire_saved_events_to_primaries(),
  public.get_artist_appearances(uuid),
  public.match_exact_artist_titles_batch(text[], timestamptz),
  public.match_exact_artist_titles_music_only(text[], timestamptz),
  public.seo_count_indexable_gemeinde_hubs(),
  public.archive_old_events(integer, integer),
  public.dedup_eventim_wins(),
  public.rollup_analytics_day(date),
  public.rebuild_event_map_points_payload(),
  public.recompute_activity_quality_scores(),
  public.normalize_location_name(text),
  public.cleanup_event_reminders(),
  public.create_default_notification_preferences(),
  public.handle_new_group(),
  public.handle_new_user(),
  public.protect_role_changes(),
  public.plans_set_updated_at(),
  public.set_updated_at_timestamp(),
  public.update_updated_at(),
  public.update_venues_updated_at(),
  public.reset_image_probe_on_change(),
  public.touch_event_submissions_updated_at()
TO service_role, postgres;

-- ---------------------------------------------------------------------------
-- 2. Nur angemeldete Nutzer (+ service_role)
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.match_exact_artist_title(text, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_fuzzy_artist_titles(text[], real, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_artist_descriptions(text[], timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_lineup_artists(text[], timestamptz) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.match_exact_artist_title(text, timestamptz),
  public.match_fuzzy_artist_titles(text[], real, timestamptz),
  public.match_artist_descriptions(text[], timestamptz),
  public.match_lineup_artists(text[], timestamptz)
TO authenticated, service_role, postgres;

-- ---------------------------------------------------------------------------
-- 3. Default-Privilegien: neue Funktionen in public sind nicht öffentlich
-- ---------------------------------------------------------------------------
-- Funktionen legen supabase_admin (psql, Migrationen) und postgres (Studio)
-- an. Das PUBLIC-Recht lässt sich nur global je Rolle entziehen, nicht je
-- Schema. Deshalb: global entziehen, in public zusätzlich anon/authenticated
-- streichen, und in allen anderen Schemas PUBLIC wieder als Default setzen.
-- Dort bleibt damit alles wie bisher (Extensions, realtime, cron, vault ...
-- legen ihre Funktionen bei Updates weiter mit PUBLIC an).
--
-- Folge für künftige Migrationen: eine neue (oder per DROP neu angelegte)
-- Funktion in public bekommt EXECUTE nur für Eigentümer, postgres und
-- service_role. Öffentliche RPCs brauchen ein ausdrückliches
-- GRANT EXECUTE ... TO anon, authenticated; fehlt es, scheitert der Aufruf
-- laut mit "permission denied" statt still offen zu sein.

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname <> 'public'
      AND nspname <> 'information_schema'
      AND nspname NOT LIKE 'pg\_%'
  LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO PUBLIC', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO PUBLIC', s);
  END LOOP;
END $$;
