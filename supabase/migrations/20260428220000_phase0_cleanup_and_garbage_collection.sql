-- Phase 0: Cleanup + Garbage Collection (Mach D, 2026-04-28)
-- Verfasst nach docs/db-audit-2026-04-28.md + docs/db-fix-session-plan-2026-04-28.md.
-- Idempotent (DROP IF EXISTS, ALTER overwrite). Sicher mehrfach ausführbar.
--
-- Inhalt:
--   1. Migration-Tracker-Sync (gestrige 5 Migrations nachtragen)
--   2. visibility NOT NULL DEFAULT 'public' + idx_events_visibility droppen
--   3. 18 zero-scan Indexes auf events droppen (~50 MB)
--   4. 16 Subset-Duplikat-Indexes droppen (~30 MB)
--   5. 4 venue_aliases Indexes droppen (Tabelle leer, Schema bleibt)
--   6. 1 quality_flags 0-scan Index droppen
--   7. work_mem Bump für anon/authenticated/service_role
--   8. REVOKE EXECUTE auf gefährliche SECURITY-DEFINER Functions
--   9. search_path Fix für 9 Functions
--  10. Multiple permissive Policies konsolidieren (group_pinboard_notes, groups)
--  11. Cosmetic-Duplikat-Policies droppen (event_series, venues)
--
-- Erwartung: kein Code-Bruch (alle gedroppten Indexes hatten 0 oder Subset-
-- Coverage; alle gedroppten Tables/Funktions-Privileges sind nicht in
-- Front-End/Server-Code aufgerufen).

BEGIN;

-- ============================================================
-- 1. MIGRATION-TRACKER-SYNC
-- Die 5 Migrations von gestern wurden via MCP apply_migration eingespielt
-- aber nicht in den Tracker geschrieben. Nachtragen damit `db push` nicht
-- versucht, sie erneut anzuwenden.
-- ============================================================
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260428190000', 'optimize_rls_auth_uid'),
  ('20260428190100', 'index_cleanup'),
  ('20260428190200', 'bulk_update_event_scores_rpc'),
  ('20260428193000', 'set_statement_timeouts'),
  ('20260428193100', 'student_index_rpc')
ON CONFLICT (version) DO NOTHING;


-- ============================================================
-- 2. visibility NOT NULL DEFAULT 'public'
-- Verifiziert: 172.901 von 172.901 events haben visibility='public', 0 NULL.
-- Damit kann der `OR visibility IS NULL`-Filter aus allen Hub-Page-Queries
-- raus (im Code) und der idx_events_visibility (3.5 MB, 22 scans) ist
-- sinnlos auf einer Spalte mit nur einem distinct value.
-- ============================================================
UPDATE events SET visibility = 'public' WHERE visibility IS NULL;
ALTER TABLE events ALTER COLUMN visibility SET NOT NULL;
ALTER TABLE events ALTER COLUMN visibility SET DEFAULT 'public';

DROP INDEX IF EXISTS public.idx_events_visibility;


-- ============================================================
-- 3. 18 zero-scan Indexes auf events droppen
-- Alle hatten 0 idx_scan in der Lifetime der Stats. Features die sie
-- brauchen würden sind nicht implementiert oder anderswo abgedeckt.
-- ============================================================
DROP INDEX IF EXISTS public.idx_events_geocoding_confidence;     -- 5.0 MB — kein Filter darauf im Code
DROP INDEX IF EXISTS public.events_vibe_gin;                     -- 5.0 MB — Tag-Filter "vibe" nicht implementiert
DROP INDEX IF EXISTS public.events_audience_gin;                 -- 5.0 MB — "audience" Filter nicht implementiert
DROP INDEX IF EXISTS public.events_setting_gin;                  -- 4.8 MB — "setting" Filter nicht implementiert
DROP INDEX IF EXISTS public.idx_events_category_confidence;      -- 3.3 MB — kein Filter darauf
DROP INDEX IF EXISTS public.idx_events_raw_event;                -- 3.2 MB — raw_event_id wird nicht gefiltert
DROP INDEX IF EXISTS public.idx_events_category_needs_review;    -- 1.7 MB — Review-UI nicht in Verwendung
DROP INDEX IF EXISTS public.idx_events_occasion_tags;            -- 1.6 MB — Occasion-Filter nicht implementiert
DROP INDEX IF EXISTS public.events_family_friendly;              -- 1.5 MB — Family-Filter nicht im UI
DROP INDEX IF EXISTS public.idx_events_price_flags;              -- 1.4 MB — Price-Flag-Filter nicht im UI
DROP INDEX IF EXISTS public.idx_events_events_business_id_fkey_fk; -- 1.2 MB — Business-Profile-Onboarding nicht fertig (CLAUDE.md)
DROP INDEX IF EXISTS public.events_duration_type;                -- 1.1 MB — Duration-Filter nicht im UI
DROP INDEX IF EXISTS public.events_price_tier;                   -- 1.1 MB — Price-Tier-Filter nicht im UI
DROP INDEX IF EXISTS public.events_language;                     -- 1.1 MB — Language-Filter nicht im UI
DROP INDEX IF EXISTS public.idx_events_embedding_cosine;         -- 808 kB — Semantic-Search nicht im App-Code aktiv
DROP INDEX IF EXISTS public.events_student_friendly;             -- 72 kB — /studenten/* nutzt RPC (gestrige Migration)
DROP INDEX IF EXISTS public.idx_events_derived_fingerprint;      -- 72 kB — Subset von idx_events_content_fingerprint
DROP INDEX IF EXISTS public.idx_events_series_id;                -- 8 kB — event_series ist 0-row Tabelle
-- behalten:
--   idx_events_content_fingerprint (14 MB, 3 scans, dedup-engine relevant)
--   idx_events_quality_score (13 MB, 215k scans)
--   idx_events_slug (11 MB, 9k scans, hub-pages)
--   idx_events_score_desc (16 MB, 1236 scans, sort=score)
--   idx_events_bundesland, _category, _publish_status, _start_date, _location
--   idx_events_created_by, _category_version, _enrichment_version, _dedup_cluster
--   idx_events_duplicate_of, _venue_id, _parent_event_id, _title_trgm


-- ============================================================
-- 4. 16 Subset-Duplikat-Indexes droppen
-- Jeder dieser Indexes wird vom genannten "Hält"-Index abgedeckt.
-- Postgres Btree benutzt Index-Prefix für Single-Column-Lookups.
-- ============================================================
DROP INDEX IF EXISTS public.idx_events_source;                   -- 19 MB — ⊂ events_source_name_source_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_dedup_log_event_a;               -- 3 MB  — ⊂ event_dedup_log_event_a_id_event_b_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_quality_scores_event;            -- 3.1 MB — ⊂ event_quality_scores_event_id_scoring_version_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_saved_events_user;               -- 16 kB — ⊂ saved_events_user_id_event_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_followed_cities_user;            -- 8 kB  — ⊂ followed_cities_user_id_city_normalized_bundesland_key
DROP INDEX IF EXISTS public.idx_followed_venues_user;            -- 8 kB  — ⊂ followed_venues_user_id_venue_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_group_members_group;             -- 16 kB — ⊂ group_members_group_id_user_id_key (UNIQUE)
DROP INDEX IF EXISTS public.push_subscriptions_user_id_idx;      -- 16 kB — ⊂ push_subscriptions_user_endpoint_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_notifications_reminder_1d_dedup; -- 8 kB — ⊂ idx_notifications_artist_dedup
DROP INDEX IF EXISTS public.idx_notifications_reminder_7d_dedup; -- 8 kB — ⊂ idx_notifications_artist_dedup
DROP INDEX IF EXISTS public.idx_activity_likes_user;             -- 16 kB — ⊂ activity_likes_user_id_activity_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_activity_comments_activity;      -- 16 kB — ⊂ idx_activity_comments_created
DROP INDEX IF EXISTS public.idx_event_reminders_user;            -- 16 kB — ⊂ event_reminders_user_event_type_uq (UNIQUE)
DROP INDEX IF EXISTS public.idx_direct_messages_receiver;        -- 16 kB — ⊂ idx_dm_unread


-- ============================================================
-- 5. venue_aliases — Tabelle ist leer (0 rows lifetime)
-- Indexes droppen, Schema bleibt. seed-venue-aliases.ts kann später
-- auf die UNIQUE constraint zurück (re-CREATE bei Bedarf).
-- ============================================================
DROP INDEX IF EXISTS public.idx_venue_aliases_venue;             -- 288 kB
DROP INDEX IF EXISTS public.idx_venue_aliases_normalized;        -- 248 kB
-- Diese letzte ist ein UNIQUE CONSTRAINT (nicht nur Index) → DROP CONSTRAINT
ALTER TABLE public.venue_aliases
  DROP CONSTRAINT IF EXISTS venue_aliases_venue_id_alias_normalized_key;


-- ============================================================
-- 6. quality_flags — 0-scan Severity Index
-- ============================================================
DROP INDEX IF EXISTS public.idx_quality_flags_severity;          -- 952 kB


-- ============================================================
-- 7. work_mem Bump — DEAKTIVIERT
-- ============================================================
-- ⚠️ Lehre aus dem 2026-04-28 Run: work_mem über `ALTER ROLE` setzen
-- bricht die PostgREST/Supavisor Connection. Der Pool-Code lowercased
-- den Wert ('16MB' → '16mb') und Postgres rejected lowercase Units
-- ("invalid value for parameter work_mem: '16mb'"). Selbst nach
-- ALTER ROLE … RESET work_mem bleibt der Pool-Cache bis zum nächsten
-- `NOTIFY pgrst, 'reload config'`.
--
-- Falls work_mem wirklich pro-Role hochgesetzt werden soll, dann via
-- raw kB-Integer (ohne Unit) UND danach `NOTIFY pgrst, 'reload config'`:
--
--   ALTER ROLE service_role SET work_mem TO '32768';  -- 32 MB in kB
--   NOTIFY pgrst, 'reload config';
--
-- Für jetzt: kein per-role Override. Wenn 20 GB temp_files wieder
-- problematisch werden, eher pro-Query SET LOCAL setzen statt rolconfig.
-- (Der Default 3500 kB ist safe; die temp-files kamen größtenteils
-- aus alten Backfill-Scripts die jetzt durch Bulk-RPCs ersetzt sind.)

-- Idempotent: existierende work_mem rolconfig entfernen falls da.
ALTER ROLE anon          RESET work_mem;
ALTER ROLE authenticated RESET work_mem;
ALTER ROLE service_role  RESET work_mem;


-- ============================================================
-- 8. REVOKE EXECUTE auf gefährliche SECURITY-DEFINER Functions
-- user_group_ids ist Information-Disclosure (jede UUID erlaubt).
-- bulk_update_event_scores muss NUR über service_role laufen.
-- match_*-Funktionen werden nur server-side benutzt → kein anon-Bedarf.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.user_group_ids(uuid)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_creator(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_god()                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_group()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_scores(jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_event_reminders()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_artist_descriptions(text[], timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_exact_artist_title(text, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_exact_artist_titles_batch(text[], timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_exact_artist_titles_music_only(text[], timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_fuzzy_artist_titles(text[], real, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_lineup_artists(text[], timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_derived_event(uuid)   FROM anon;

-- behalten erreichbar:
--   student_event_counts_by_bundesland  (anon, authenticated, service_role)
--   seo_count_indexable_gemeinde_hubs    (DEFINER, von Cron benutzt)
--   search_events_semantic               (INVOKER, future use)


-- ============================================================
-- 9. search_path für 9 Funktionen festsetzen (Advisor warn)
-- ============================================================
ALTER FUNCTION public.search_events_semantic(vector, integer, real, timestamptz, text)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_event_reminders()
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.match_exact_artist_titles_batch(text[], timestamptz)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.match_exact_artist_title(text, timestamptz)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.match_exact_artist_titles_music_only(text[], timestamptz)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.rewire_saved_events_to_primaries()
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_updated_at_timestamp()
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.match_fuzzy_artist_titles(text[], real, timestamptz)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.match_artist_descriptions(text[], timestamptz)
  SET search_path = public, pg_catalog;


-- ============================================================
-- 10. Multiple permissive policies konsolidieren
-- ============================================================

-- group_pinboard_notes: zwei DELETE-Policies → eine OR-Policy
-- own: user_id = auth.uid()  (per pinboard_notes_delete_own)
-- owner: group.created_by = auth.uid()  (per pinboard_notes_delete_owner)
DROP POLICY IF EXISTS pinboard_notes_delete_own   ON public.group_pinboard_notes;
DROP POLICY IF EXISTS pinboard_notes_delete_owner ON public.group_pinboard_notes;
CREATE POLICY pinboard_notes_delete ON public.group_pinboard_notes
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_pinboard_notes.group_id
        AND g.created_by = (SELECT auth.uid())
    )
  );

-- groups UPDATE: zwei Policies mit unterschiedlicher Membership-Logik.
-- "Group admins can update" benutzte `is_group_member()` (alle Members) —
-- ZU PERMISSIV. groups_update_owner_or_admin prüft role='admin' — das ist
-- die intended Logic. Ersteres droppen, letzteres als alleinige UPDATE-
-- Policy belassen.
DROP POLICY IF EXISTS "Group admins can update" ON public.groups;
-- groups_update_owner_or_admin bleibt unverändert (richtige Policy)


-- ============================================================
-- 11. Cosmetic-Duplikat-Policies konsolidieren
-- Zwei identische "venues_public_read" / "event_series_public_read"
-- existieren je einmal für anon + einmal für authenticated. Postgres
-- führt sie pro Role separat aus, was zu double-evaluation führt.
-- Konsolidiere zu einer Policy für beide Roles.
-- ============================================================
DROP POLICY IF EXISTS event_series_public_read ON public.event_series;
CREATE POLICY event_series_public_read ON public.event_series
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS venues_public_read ON public.venues;
CREATE POLICY venues_public_read ON public.venues
  FOR SELECT TO anon, authenticated USING (true);


-- ============================================================
-- POST-CHECK: ANALYZE auf den Tabellen die Indexes verloren haben
-- (Planner aktualisiert Statistik damit die nächsten Queries die richtigen
-- Indexes wählen.)
-- ============================================================
ANALYZE public.events;
ANALYZE public.event_dedup_log;
ANALYZE public.event_quality_scores;
ANALYZE public.quality_flags;
ANALYZE public.venue_aliases;

COMMIT;
