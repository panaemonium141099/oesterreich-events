-- Schritt 1 von 2: Funktionen für Profile und entkoppelte Memory-Policies.
--
-- Diese Datei nimmt niemandem etwas weg. Sie kann vor dem Deploy laufen;
-- die Sperre selbst steht in 20261121120100_profiles_spaltenrechte.sql und
-- läuft NACH dem Deploy, weil der alte Website-Code das eigene Profil noch
-- mit `select('*')` liest.
--
-- Befund 1 (Prod, 2026-11-21): public.profiles hat die Policy
-- „Anyone can view profiles“ (SELECT, Rolle public, USING true) und keine
-- Spaltenrechte. Mit dem öffentlichen Anon-Key waren ohne Anmeldung 99
-- Profile lesbar, 99 mit email, 43 mit phone, 70 mit birth_date, 28 mit
-- address, 29 mit postal_code, 23 mit detected_lat.
--
-- Befund 2 (gleicher Tag): die SELECT-Policies von memories,
-- memory_participants und memory_photos fragten sich gegenseitig ab
-- („Users can view own memories“ las memory_participants, „View memory
-- participants“ las memories und wieder memory_participants). Postgres brach
-- jede Abfrage mit 42P17 (infinite recursion detected in policy for relation
-- "memory_participants") ab, für alle Rollen. Alle drei Tabellen sind leer.
--
-- Ausführen als supabase_admin (Eigentümer der Tabellen; postgres ist kein
-- Mitglied und könnte weder Policies noch Rechte ändern):
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < datei.sql
--
-- Funktionen in public sind seit 20261008130000 standardmäßig nicht
-- öffentlich; jede bekommt hier ihr ausdrückliches GRANT. Alle drei lesen
-- nur.

BEGIN;

-- ─── 1) Eigenes Profil, vollständig ────────────────────────────────────────
-- Nach Schritt 2 darf authenticated von profiles nur noch fünf Spalten
-- lesen; `select('*')` scheitert dann auch auf der eigenen Zeile (Spalten-
-- rechte kennen keine Zeilen). Das eigene Profil kommt deshalb aus dieser
-- Funktion. SETOF, damit ein gelöschtes Konto null Zeilen liefert (die
-- Website erkennt daran die Geister-Session) und PostgREST `select=` kennt.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_profile() IS
  'Eigenes Profil mit allen Spalten. Ersetzt from(profiles).select(*) auf der eigenen Zeile, seit authenticated nur noch id, first_name, last_name, avatar_url und role lesen darf (20261121120100).';

-- ─── 2) Personensuche ──────────────────────────────────────────────────────
-- Namen als Teilwort, E-Mail nur als exakter Treffer (ohne Groß/Klein).
-- Zurück kommen nur die vier Spalten, die die Oberfläche zeigt; eine
-- Adresse verlässt die Datenbank nie. Vorher suchte der Browser mit
-- `email.ilike.%…%` und bekam die Adressen aller Treffer geliefert.
-- Platzhalter im Suchtext (%, _) zählen als Zeichen.
CREATE OR REPLACE FUNCTION public.search_profiles(p_query text, p_limit integer DEFAULT 10)
RETURNS TABLE (id uuid, first_name text, last_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH q AS (
    SELECT btrim(coalesce(p_query, '')) AS raw,
           replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') AS pat
  )
  SELECT p.id, p.first_name, p.last_name, p.avatar_url
  FROM public.profiles p
  CROSS JOIN q
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND p.id <> (SELECT auth.uid())
    AND q.raw <> ''
    AND (
      p.first_name ILIKE '%' || q.pat || '%'
      OR p.last_name ILIKE '%' || q.pat || '%'
      OR lower(p.email) = lower(q.raw)
    )
  ORDER BY (lower(p.email) = lower(q.raw)) DESC, p.first_name, p.last_name, p.id
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 20);
$$;

REVOKE ALL ON FUNCTION public.search_profiles(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_profiles(text, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_profiles(text, integer) IS
  'Personensuche für Freundschaftsanfragen: Vor- oder Nachname als Teilwort, E-Mail nur exakt. Liefert id, first_name, last_name, avatar_url, nie die Adresse.';

-- ─── 3) Memories: Mitgliedschaft ohne RLS prüfen ───────────────────────────
-- Wie is_group_member für Gruppen, aber ohne Nutzer-Parameter: die Funktion
-- beantwortet nur die Frage für den Aufrufer selbst.
CREATE OR REPLACE FUNCTION public.is_memory_member(p_memory_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memories m
    WHERE m.id = p_memory_id AND m.created_by = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.memory_participants mp
    WHERE mp.memory_id = p_memory_id AND mp.user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_memory_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_memory_member(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_memory_member(uuid) IS
  'true, wenn der Aufrufer die Erinnerung angelegt hat oder Teilnehmer ist. Für die SELECT-Policies von memories, memory_participants und memory_photos; liest ohne RLS, damit die Policies sich nicht gegenseitig aufrufen (42P17).';

-- Die drei SELECT-Policies gelten nur noch für authenticated: Policies
-- prüfen EXECUTE beim Aufrufer, und anon hat das Recht nicht. Ohne passende
-- Policy bekommt anon null Zeilen statt eines Fehlers.
-- Die eigene Klausel (created_by / user_id) steht vor dem Funktionsaufruf:
-- `INSERT … RETURNING` prüft die neue Zeile gegen die SELECT-Policy, und die
-- Funktion sieht eine Zeile desselben Befehls noch nicht.
DROP POLICY IF EXISTS "Users can view own memories" ON public.memories;
CREATE POLICY "Users can view own memories" ON public.memories
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()) OR public.is_memory_member(id));

DROP POLICY IF EXISTS "View memory participants" ON public.memory_participants;
CREATE POLICY "View memory participants" ON public.memory_participants
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_memory_member(memory_id));

DROP POLICY IF EXISTS "View memory photos" ON public.memory_photos;
CREATE POLICY "View memory photos" ON public.memory_photos
  FOR SELECT TO authenticated
  USING (public.is_memory_member(memory_id));

-- Die INSERT-Policy „Users can insert memory participants“ bleibt, wie sie
-- ist. Sie liest memories; deren SELECT-Policy ruft jetzt die Funktion statt
-- memory_participants, der Kreis ist damit offen.

COMMIT;

NOTIFY pgrst, 'reload schema';
