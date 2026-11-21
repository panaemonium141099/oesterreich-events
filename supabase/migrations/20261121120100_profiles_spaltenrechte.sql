-- Schritt 2 von 2: profiles für Besucher schließen, fremde Profile auf die
-- Spalten der Oberfläche beschränken.
--
-- Erst ausführen, wenn der Website-Code aus demselben PR live ist. Der alte
-- Code liest das eigene Profil mit `select('*')` und die Freundesliste mit
-- `email`; beides beantwortet Postgres nach dieser Datei mit 42501.
-- Voraussetzung: 20261121120000_profile_funktionen_memory_policies.sql
-- (get_my_profile, search_profiles).
--
-- Befund (Prod, 2026-11-21): Policy „Anyone can view profiles“ (SELECT,
-- Rolle public, USING true), Tabellenrecht SELECT für anon und
-- authenticated. Ohne Anmeldung lesbar: 99 Profile mit email, 43 mit phone,
-- 70 mit birth_date, 28 mit address.
--
-- Danach:
--   anon           keine Zeile (keine Policy für die Rolle).
--   authenticated  jede Zeile, aber nur id, first_name, last_name,
--                  avatar_url und role. Alles andere, auch email, phone,
--                  birth_date, address, postal_code, detected_lat/lng und
--                  spotify_refresh_token, ist für fremde UND eigene Zeilen
--                  gesperrt; das eigene Profil liefert get_my_profile().
--   service_role   unverändert alles (Crons, Admin-Routen).
--   Schreiben      unverändert: UPDATE nur auf der eigenen Zeile
--                  („Users can update own profile“), Rolle per Trigger
--                  geschützt.
--
-- Warum Spaltenrechte und keine View: rund 30 Abfragen in Website und App
-- betten profiles über die Fremdschlüssel ein
-- (`profiles!friendships_requester_id_fkey(id, first_name, …)`). Sie nennen
-- alle nur erlaubte Spalten und laufen unverändert weiter. Eine View hätte
-- jede dieser Abfragen umbenannt.
--
-- Warum role lesbar bleibt, auch für anon: 14 Policies auf anderen Tabellen
-- (analytics_events, business_leads, event_submissions, event_series, venues,
-- seo_experiments, event_enrichment_proposals) prüfen
-- `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (…))`.
-- Policies laufen mit den Rechten des Aufrufers; ohne Leserecht auf id und
-- role bräche jede Abfrage auf diese Tabellen mit 42501 ab, auch für anon
-- (acht der Policies gelten für die Rolle public). Mit Leserecht und ohne
-- Zeile ist das EXISTS für anon schlicht falsch. Die Namensspalten bekommt
-- anon ebenfalls, damit eine Einbettung von profiles in einer Abfrage ohne
-- Anmeldung leer statt mit Fehler antwortet.
--
-- Neue Spalten sind danach von selbst gesperrt: das Tabellenrecht ist weg,
-- lesbar ist nur, was hier ausdrücklich steht.
--
-- Ausführen als supabase_admin, siehe Schritt 1.
--
-- Rückweg (der neue Code läuft auch mit den alten Rechten):
--   BEGIN;
--   GRANT SELECT ON public.profiles TO anon, authenticated;
--   DROP POLICY IF EXISTS profiles_authenticated_read ON public.profiles;
--   CREATE POLICY "Anyone can view profiles" ON public.profiles
--     FOR SELECT USING (true);
--   COMMIT;

BEGIN;

-- 1) Zeilen: nur noch für angemeldete Nutzer.
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_authenticated_read ON public.profiles;
CREATE POLICY profiles_authenticated_read ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- 2) Spalten: Tabellenrecht weg, dann nur die fünf erlaubten Spalten.
--    Das REVOKE auf Tabellenebene nimmt frühere Spaltenrechte mit.
REVOKE SELECT ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, first_name, last_name, avatar_url, role)
  ON public.profiles TO anon, authenticated;

-- 3) Prüfung: bleibt eine andere Spalte lesbar oder gilt eine Lese-Policy
--    für Besucher, bricht die Migration ab und rollt zurück.
DO $$
DECLARE
  offen text;
BEGIN
  SELECT string_agg(format('%s (%s)', a.attname, r.rolname), ', ' ORDER BY a.attnum, r.rolname)
    INTO offen
  FROM pg_attribute a
  CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
  WHERE a.attrelid = 'public.profiles'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname NOT IN ('id', 'first_name', 'last_name', 'avatar_url', 'role')
    AND has_column_privilege(r.rolname, a.attrelid, a.attnum, 'SELECT');

  IF offen IS NOT NULL THEN
    RAISE EXCEPTION 'profiles: Spalten weiterhin lesbar: %', offen;
  END IF;

  SELECT string_agg(policyname, ', ' ORDER BY policyname)
    INTO offen
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND cmd IN ('SELECT', 'ALL')
    AND (roles && ARRAY['public', 'anon']::name[]);

  IF offen IS NOT NULL THEN
    RAISE EXCEPTION 'profiles: Lese-Policy gilt weiterhin für Besucher: %', offen;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
