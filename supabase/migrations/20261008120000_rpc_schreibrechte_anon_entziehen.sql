-- Schreibende SECURITY-DEFINER-Funktionen für anon/authenticated sperren.
--
-- Befund 2026-10-08 (Abschlussprüfung Dedup, auf Prod belegt): u. a.
-- bulk_update_event_publish lief als supabase_admin (umgeht RLS) und war für
-- anon ausführbar. Mit dem öffentlichen Anon-Key ließ sich jedes Event
-- verstecken oder freischalten. Ursache: pg_default_acl in public vergibt
-- EXECUTE ausdrücklich an anon und authenticated; `REVOKE ... FROM PUBLIC`
-- entfernt diese Einzelrechte nicht, und Neuanlagen (Umzug, CREATE OR REPLACE
-- nach DROP) bekommen sie wieder.
--
-- Diese Funktionen rufen nur Server-Skripte mit Service-Key auf
-- (src/lib/db/bulk-update.ts, backfill-quality, calculate-scores,
-- lineup/orchestrator, dedup.ts). Gesperrt werden alle Überladungen.

-- Signaturen laut Prod (pg_proc, 2026-10-08); je Funktion genau eine.
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_publish(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_publish(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_scores(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_scores(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_enrichment(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_enrichment(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_geocoding(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_geocoding(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.bulk_update_event_slugs(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_slugs(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.bulk_replace_event_quality_flags(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_replace_event_quality_flags(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.bulk_upsert_event_quality_scores(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_upsert_event_quality_scores(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.delete_derived_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_derived_event(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reset_enrichment_chunk(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_enrichment_chunk(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rewire_saved_events_to_primaries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rewire_saved_events_to_primaries() TO service_role;

-- Live-Wächter für die Nacht-Pipeline: öffentliche (anon-ausführbare)
-- SECURITY-DEFINER-Funktionen in public, die schreiben und kein Trigger sind.
-- Leere Ergebnismenge = in Ordnung. Nur für service_role.
CREATE OR REPLACE FUNCTION public.audit_public_write_rpcs()
RETURNS TABLE (function_signature text)
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT p.oid::regprocedure::text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.prorettype <> 'trigger'::regtype
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.prosrc ~* '\m(update|insert\s+into|delete\s+from|truncate)\M'
  ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_public_write_rpcs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_public_write_rpcs() TO service_role;
