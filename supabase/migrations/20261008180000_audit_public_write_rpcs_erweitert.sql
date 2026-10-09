-- Live-Wächter für öffentliche Schreib-RPCs erweitert (Abschlussprüfung
-- 2026-10-08, Gegenprüfung der Sicherheitsmigration 20261008120000):
--  * authenticated zählt wie anon: registrieren kann sich jeder.
--  * MERGE zählt als Schreibbefehl.
--  * SECURITY-DEFINER-Hüllen, die eine schreibende Definer-Funktion aufrufen,
--    werden ebenfalls gemeldet (sie laufen als Eigentümer und dürfen sie rufen).
-- Bewusst für Nutzer aufrufbare Schreib-RPCs gehören in allowed (und in
-- ALLOWED_PUBLIC_WRITERS in src/__tests__/db/security-definer-grants.test.ts).

CREATE OR REPLACE FUNCTION public.audit_public_write_rpcs()
RETURNS TABLE (function_signature text)
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  WITH definer AS (
    SELECT p.oid, p.proname, p.prosrc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype
  ),
  writers AS (
    SELECT oid, proname FROM definer
    WHERE prosrc ~* '\m(update|insert\s+into|delete\s+from|truncate|merge\s+into)\M'
  ),
  wrappers AS (
    SELECT DISTINCT d.oid FROM definer d
    JOIN writers w ON w.oid <> d.oid AND d.prosrc ~* ('\m' || w.proname || '\s*\(')
  ),
  allowed (proname) AS (VALUES (NULL::name))
  SELECT x.oid::regprocedure::text
  FROM (SELECT oid FROM writers UNION SELECT oid FROM wrappers) x
  JOIN pg_proc p ON p.oid = x.oid
  WHERE (has_function_privilege('anon', x.oid, 'EXECUTE') OR has_function_privilege('authenticated', x.oid, 'EXECUTE'))
    AND p.proname NOT IN (SELECT proname FROM allowed WHERE proname IS NOT NULL)
  ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_public_write_rpcs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_public_write_rpcs() TO service_role;
