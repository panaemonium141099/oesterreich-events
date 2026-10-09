# Funktionsrechte in public, Prod-Stand 2026-10-08

Erhoben auf Prod (Hetzner) aus `pg_proc.proacl` und `has_function_privilege`,
Aufrufer per `grep rpc(` in `src/` und `supabase/functions/`, plus
`pg_policies`, `cron.job` und `pg_depend`. Eigentümer aller Funktionen:
`supabase_admin`. Keine Funktion in public ruft eine andere public-Funktion
auf, keine View und keine Spalten-Default hängt an einer. Grundlage für die
Migration `supabase/migrations/20261008130000_funktionen_execute_rechte.sql`.

„Vorher“ ist der Stand bei Beginn der Prüfung. Zu diesem Zeitpunkt war jede
der 46 Funktionen für anon ausführbar (über PUBLIC oder ein Einzelrecht).
Die Spalte „Soll“ nennt, wer nach der Migration EXECUTE hat (postgres und
service_role haben es immer).

## Öffentlich (anon + authenticated), bleibt unverändert

| Funktion | Typ | vorher | Aufrufer (Client) |
|---|---|---|---|
| search_event_ids | INVOKER | PUBLIC, postgres, anon, authenticated, service_role | lib/search/smart-search.ts (Service-Key, Fallback Anon-Key); admin/boost/page.tsx (Browser, authenticated) |
| get_event_map_points | INVOKER | anon, authenticated, service_role | api/events/map-points, wo-ist-was-los (Anon-Key) |
| get_event_details_by_short_ids | DEFINER | PUBLIC, anon, authenticated, service_role | api/events/details (Anon-Key) |
| event_counts_for_stats | DEFINER | anon, authenticated, service_role | api/stats/counts (Service-Key). Laut Migrationen bewusst öffentlich, liest nur Zähler aus der MV |
| student_event_counts_by_bundesland | DEFINER | PUBLIC, anon, authenticated, service_role | lib/student-data.ts (Anon-Key) |
| nearby_stays | INVOKER | PUBLIC, postgres, anon, authenticated, service_role | lib/booking/nearby-stays-loader.ts (Anon-Key); blog-autowriter (Service-Key) |
| search_activities | DEFINER | anon, authenticated, service_role | lib/search/smart-search.ts (Service-Key, Fallback Anon-Key) |
| is_god | DEFINER | PUBLIC, anon, authenticated, service_role | RLS-Policies auf events (UPDATE/DELETE), Rolle public |
| is_group_member | DEFINER | PUBLIC, anon, authenticated, service_role | RLS-Policies auf group_members, group_messages, group_contributions |
| is_group_creator | DEFINER | PUBLIC, anon, authenticated, service_role | RLS-Policies wie oben |
| user_group_ids | DEFINER | PUBLIC, anon, authenticated, service_role | RLS-Policy „Members can view their groups“ (SELECT auf groups) |

RLS-Policies prüfen EXECUTE beim aufrufenden Nutzer. Ein Entzug bei den vier
Helfern bräche jedes SELECT auf groups und group_members, auch für anon.

## Nur angemeldete Nutzer (authenticated, ohne anon)

| Funktion | Typ | vorher | Aufrufer (Client) |
|---|---|---|---|
| match_exact_artist_title | DEFINER | PUBLIC, anon, authenticated, service_role | api/artists/follow, auth/spotify/callback (Nutzer-Client); scripts/match-artists, Edge-Function match-artists (Service-Key) |
| match_fuzzy_artist_titles | DEFINER | wie oben | wie oben |
| match_artist_descriptions | DEFINER | wie oben | wie oben |
| match_lineup_artists | DEFINER | wie oben | api/artists/follow (Nutzer-Client); scripts/match-artists (Service-Key) |

Die Sperre aus `20260428220000` (REVOKE von anon/authenticated) war wegen des
PUBLIC-Rechts wirkungslos; hätte sie gegriffen, wäre das sofortige Matching
nach Follow und Spotify-Import still leer geblieben.

## Nur service_role

| Funktion | Typ | vorher | Aufrufer |
|---|---|---|---|
| bulk_update_event_publish | DEFINER | anon, authenticated, service_role | backfill-quality (Service-Key). Seit 20261008120000 gesperrt |
| bulk_update_event_scores | DEFINER | anon, authenticated, service_role | calculate-scores (Service-Key). Seit 20261008120000 gesperrt |
| bulk_update_event_enrichment | DEFINER | anon, authenticated, service_role | fix-gsc-event-issues (Service-Key). Seit 20261008120000 gesperrt |
| bulk_update_event_geocoding | DEFINER | anon, authenticated, service_role | kein Aufrufer mehr (nur als Typ in lib/db/bulk-update.ts). Seit 20261008120000 gesperrt |
| bulk_update_event_slugs | DEFINER | anon, authenticated, service_role | backfill-slugs (Service-Key). Seit 20261008120000 gesperrt |
| bulk_replace_event_quality_flags | DEFINER | anon, authenticated, service_role | backfill-quality (Service-Key). Seit 20261008120000 gesperrt |
| bulk_upsert_event_quality_scores | DEFINER | anon, authenticated, service_role | backfill-quality (Service-Key). Seit 20261008120000 gesperrt |
| delete_derived_event | DEFINER | anon, authenticated, service_role | lib/lineup/orchestrator.ts (Service-Key). Seit 20261008120000 gesperrt |
| reset_enrichment_chunk | DEFINER | anon, authenticated, service_role | kein Aufrufer. Seit 20261008120000 gesperrt |
| rewire_saved_events_to_primaries | INVOKER | PUBLIC, anon, authenticated, service_role | scripts/dedup.ts (Service-Key). Seit 20261008120000 gesperrt |
| get_artist_appearances | DEFINER | PUBLIC, anon, authenticated, service_role | lib/artists/appearances.ts, nur mit Service-Client (api/artists/events, api/me/landing) |
| match_exact_artist_titles_batch | DEFINER | PUBLIC, anon, authenticated, service_role | Edge-Function match-artists (Service-Key) |
| match_exact_artist_titles_music_only | DEFINER | PUBLIC, anon, authenticated, service_role | Edge-Function match-artists (Service-Key) |
| seo_count_indexable_gemeinde_hubs | DEFINER | PUBLIC, anon, authenticated, service_role | kein Aufrufer mehr (früher SEO-Snapshot); GROUP BY über events |
| archive_old_events | INVOKER | PUBLIC, anon, authenticated, service_role | pg_cron Job 4 (supabase_admin) |
| dedup_eventim_wins | INVOKER | PUBLIC, anon, authenticated, service_role | kein Aufrufer im Code |
| rollup_analytics_day | INVOKER | PUBLIC, anon, authenticated, service_role | pg_cron Job 2; schreibt analytics_daily (ohne RLS) |
| rebuild_event_map_points_payload | INVOKER | PUBLIC, anon, authenticated, service_role | pg_cron Job 6; schreibt event_map_points_payload (ohne RLS) |
| recompute_activity_quality_scores | INVOKER | PUBLIC, anon, authenticated, service_role | pg_cron Job 5; import-barrierefrei (Service-Key) |
| normalize_location_name | INVOKER | PUBLIC, anon, authenticated, service_role | kein Aufrufer mehr (Master-Coords-Trigger existiert nicht mehr) |
| cleanup_event_reminders | DEFINER, Trigger | PUBLIC, anon, authenticated, service_role | Trigger auf events |
| create_default_notification_preferences | DEFINER, Trigger | PUBLIC, anon, authenticated, service_role | Trigger auf profiles |
| handle_new_group | DEFINER, Trigger | PUBLIC, anon, authenticated, service_role | Trigger auf groups |
| handle_new_user | DEFINER, Trigger | PUBLIC, service_role | Trigger auf auth.users |
| protect_role_changes | DEFINER, Trigger | PUBLIC, anon, authenticated, service_role | Trigger auf profiles |
| plans_set_updated_at | INVOKER, Trigger | PUBLIC, anon, authenticated, service_role | Trigger auf plans |
| set_updated_at_timestamp | INVOKER, Trigger | PUBLIC, anon, authenticated, service_role | Trigger auf group_pinboard_notes |
| update_updated_at | INVOKER, Trigger | PUBLIC, anon, authenticated, service_role | Trigger auf events, profiles, groups, friendships, business_profiles |
| update_venues_updated_at | INVOKER, Trigger | PUBLIC, anon, authenticated, service_role | Trigger auf venues |
| reset_image_probe_on_change | INVOKER, Trigger | PUBLIC, postgres, anon, authenticated, service_role | Trigger auf events |
| touch_event_submissions_updated_at | INVOKER, Trigger | PUBLIC, postgres, anon, authenticated, service_role | Trigger auf event_submissions |
| audit_public_write_rpcs | INVOKER | postgres, service_role | security-audit.ts (Service-Key); angelegt mit 20261008120000 |

Triggerfunktionen brauchen kein EXECUTE beim Feuern. Auf Prod in einer
zurückgerollten Transaktion belegt: anon ohne EXECUTE auf die
Triggerfunktion, INSERT als anon lief, der Trigger setzte den Wert.

## Default-Privilegien

Vorher (`pg_default_acl`): für supabase_admin und postgres in public
`EXECUTE` an postgres, anon, authenticated, service_role; dazu das eingebaute
EXECUTE für PUBLIC. Jede neue Funktion war damit sofort öffentlich, und ein
`REVOKE ... FROM PUBLIC` allein hob das Einzelrecht für anon nicht auf.

Nachher: das PUBLIC-Recht ist für beide Rollen global entzogen, in public
zusätzlich anon/authenticated. In allen anderen Schemas ist PUBLIC als
Schema-Default wieder gesetzt, dort ändert sich nichts. Neue Funktionen in
public: EXECUTE nur für Eigentümer, postgres, service_role.

## Angewandt

2026-10-08 gegen 11:50 UTC in Prod, in einer Transaktion mit Prüfung vor dem
COMMIT (Rechte aller Funktionen gegen den Sollzustand, Probe-Funktion in
public und extensions). Danach als anon über PostgREST: die sieben
öffentlichen RPCs liefern 200, normalize_location_name,
get_artist_appearances und match_exact_artist_title liefern 42501.

## Nebenbefund (nicht Teil dieser Migration)

Zehn Tabellen in public haben kein RLS, anon hat dort INSERT, UPDATE und
DELETE: analytics_daily, district_canonical, event_map_points_payload,
source_runs, sources, workflow_runs und vier snap_20260914_*-Tabellen.
