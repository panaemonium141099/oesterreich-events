-- Neue Tabellen und Views in public automatisch absichern (Befund 2026-10-08).
--
-- Die Default-Privileges in public (Supabase-Standard, fuer postgres und
-- supabase_admin gleich) geben anon und authenticated auf jede neue
-- Tabelle und View arwdDxtm. Geschuetzt ist eine Tabelle dann nur durch
-- RLS, und genau das fehlte bei zehn Tabellen
-- (20261008120000_api_rollen_rechte_zurueckschneiden.sql), vier davon
-- waren per Hand angelegte Sicherungen.
--
-- Die Default-Privileges bleiben, wie sie sind: Nutzer-Features
-- (saved_events, plans, ...) schreiben als authenticated ueber Policies
-- und verlassen sich darauf, dass der Grant da ist. Wuerde er
-- wegfallen, scheitern neue Features an "permission denied", und
-- ungepruefte supabase-js-Schreibaufrufe melden das nicht.
--
-- Stattdessen greift dieser Event-Trigger bei jedem CREATE in public,
-- egal ob per Migration, Skript oder Hand:
--   * Tabellen bekommen RLS. Ohne Policy sehen anon und authenticated
--     nichts; service_role (BYPASSRLS) und supabase_admin arbeiten weiter.
--     Wer eine Tabelle oeffentlich lesbar machen will, legt eine Policy an.
--   * Views laufen mit den Rechten ihres Owners, RLS greift dort nicht,
--     und einfache Views sind automatisch aktualisierbar. Sie verlieren
--     deshalb INSERT/UPDATE/DELETE/TRUNCATE fuer anon und authenticated;
--     SELECT bleibt.
-- Event-Trigger lassen sich nur als Superuser anlegen (supabase_admin).

CREATE OR REPLACE FUNCTION public.api_rollen_neue_objekte_absichern()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT object_type, object_identity
    FROM pg_event_trigger_ddl_commands()
    WHERE schema_name = 'public'
      AND object_type IN ('table', 'view')
  LOOP
    IF obj.object_type = 'table' THEN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
      RAISE NOTICE 'RLS aktiviert: % (oeffentlicher Zugriff braucht eine Policy)', obj.object_identity;
    ELSE
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON %s FROM PUBLIC, anon, authenticated',
        obj.object_identity
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.api_rollen_neue_objekte_absichern()
  FROM PUBLIC, anon, authenticated, service_role;

DROP EVENT TRIGGER IF EXISTS api_rollen_neue_objekte_absichern;
CREATE EVENT TRIGGER api_rollen_neue_objekte_absichern
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'CREATE VIEW')
  EXECUTE FUNCTION public.api_rollen_neue_objekte_absichern();
