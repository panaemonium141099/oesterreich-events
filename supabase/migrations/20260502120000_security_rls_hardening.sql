-- Security hardening — schließt 4 RLS-Lücken aus dem Pentest am 02.05.26.
--
-- C1 (Critical): profiles.UPDATE → Self-Promotion zu admin/god war möglich
--                weil WITH CHECK fehlte und role-Änderung nicht explizit blockiert war.
-- C2 (Critical): events.UPDATE "OR source_type='scraped'" Klausel ließ
--                jeden authentifizierten User ALLE 180k scraped events ändern
--                (Mass-Vandalism, Phishing-Vector via ticket_url).
-- H1 (High):     notifications.INSERT mit `WITH CHECK true` erlaubte Spam +
--                Impersonation (beliebiger from_user_id, beliebiger type).
-- H2 (High):     events.INSERT prüfte source_type='user_created', aber NICHT
--                created_by=auth.uid() — User konnte Events fremder User erstellen.

-- ─── C1: profiles.UPDATE strict + role-protection trigger ──────────────────

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.protect_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $func$
DECLARE
  caller_role TEXT;
BEGIN
  -- Nur wenn role tatsächlich geändert wird
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

    -- Wenn kein Profil (z.B. service_role) → erlauben
    IF caller_role IS NULL THEN
      RETURN NEW;
    END IF;

    -- Self-Promotion: nur erlaubt wenn caller bereits god ist
    -- (god kann sich selbst zu admin/user demoten, blockieren wir nicht)
    IF NEW.id = auth.uid() AND caller_role != 'god' THEN
      RAISE EXCEPTION 'Self role-change requires god role (caller: %, target role: %)', caller_role, NEW.role;
    END IF;

    -- Role 'god' kann nur von god vergeben werden
    IF NEW.role = 'god' AND caller_role != 'god' THEN
      RAISE EXCEPTION 'Only god can grant god role';
    END IF;

    -- Generell: role-Änderungen brauchen admin/god
    IF caller_role NOT IN ('admin', 'god') THEN
      RAISE EXCEPTION 'Role changes require admin or god role';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_protect_role_changes ON public.profiles;
CREATE TRIGGER trg_protect_role_changes
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_role_changes();

-- ─── C2: events.UPDATE strict — scraped events nur via service_role ─────────

DROP POLICY IF EXISTS "Users can update own events or scraped" ON public.events;
CREATE POLICY "Users can update own events" ON public.events
  FOR UPDATE
  USING (created_by = (SELECT auth.uid()) OR is_god())
  WITH CHECK (created_by = (SELECT auth.uid()) OR is_god());

-- Scraped events werden NICHT mehr von authenticated users editierbar.
-- Pipeline (service_role) umgeht RLS und macht weiter wie gewohnt.

-- ─── H1: notifications.INSERT strict ───────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Anti-Impersonation: from_user_id muss caller sein
    from_user_id = (SELECT auth.uid())
    -- Anti-fake-system-types: nur whitelisted types erlaubt
    AND type IN (
      'comment','like','event_invite','event_invite_response','event_invite_accepted',
      'rsvp','group_message','dm','plan_update','event_reminder','memory_invite',
      'friend_request','friend_request_accepted','group_invite','group_invite_accepted',
      'event_save','event_share','artist_alert','calendar_share','co_owner_invite',
      'pinboard_note','contribution'
    )
  );

-- ─── H2: events.INSERT strict — created_by muss caller sein ────────────────

DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.events;
CREATE POLICY "Authenticated users can insert events" ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    source_type = 'user_created'
    AND created_by = (SELECT auth.uid())
  );

-- ─── Doku ──────────────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.protect_role_changes() IS
  'Trigger function: blockiert role-Änderungen auf profiles außer durch god/admin. Verhindert Self-Promotion (Pentest C1).';
