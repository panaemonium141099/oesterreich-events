-- notification_deliveries war fuer jeden mit dem Anon-Key beschreibbar
-- (Befund Rechte-Audit 2026-10-08, PR #296).
--
-- Die Policy "Service can insert deliveries" (FOR INSERT, Rolle PUBLIC,
-- WITH CHECK true) liess anon und authenticated per REST beliebige Zeilen
-- einfuegen. Dazu hielten beide aus den Default-Privileges alle
-- Tabellenrechte, auch TRUNCATE, das an RLS vorbeigeht.
--
-- Wer schreibt (Stand 2026-10-09): niemand. Die Tabelle stammt aus der
-- Funnel-Spec Phase 5 (docs/superpowers/specs/2026-04-08-funnel-phase5-
-- trigger-messaging.md), die Edge Functions send-digests und
-- process-new-events wurden nie gebaut. Kein .from('notification_deliveries')
-- im Code, keine Edge Function auf dem Server, keine Funktion, kein
-- Trigger, keine View und kein pg_cron-Job verweist auf sie, Prod hat
-- 0 Zeilen und n_tup_ins = 0. Ein spaeterer Versand-Job laeuft mit
-- SUPABASE_SERVICE_ROLE_KEY (BYPASSRLS) und braucht die Policy nicht.
--
-- Lesen bleibt wie bisher: SELECT fuer anon und authenticated, die Policy
-- "Users read own deliveries" zeigt nur eigene Zeilen (anon also keine).
--
-- Die Tabelle entstand per Hand, nicht per Migration, und fehlt in einer
-- frisch aufgebauten DB. Deshalb laeuft alles nur, wenn sie existiert.
DO $$
DECLARE
  offen text;
BEGIN
  IF to_regclass('public.notification_deliveries') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Service can insert deliveries" ON public.notification_deliveries;

  REVOKE ALL ON public.notification_deliveries FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.notification_deliveries TO anon, authenticated;
  ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

  -- Pruefung: keine Schreibrechte und keine Schreib-Policy mehr fuer die
  -- API-Rollen. Sonst bricht die Migration ab und rollt zurueck.
  SELECT string_agg(format('%s %s', r.rolname, p.priv), ', ')
    INTO offen
  FROM (VALUES ('anon'), ('authenticated')) AS r(rolname)
  CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
  WHERE has_table_privilege(r.rolname, 'public.notification_deliveries', p.priv);

  IF offen IS NOT NULL THEN
    RAISE EXCEPTION 'notification_deliveries weiterhin schreibbar: %', offen;
  END IF;

  SELECT string_agg(polname, ', ')
    INTO offen
  FROM pg_policy
  WHERE polrelid = 'public.notification_deliveries'::regclass
    AND polcmd <> 'r';

  IF offen IS NOT NULL THEN
    RAISE EXCEPTION 'notification_deliveries hat noch Schreib-Policies: %', offen;
  END IF;
END $$;
