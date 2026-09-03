-- Das Admin-Panel zeigte seit dem 28.08.2026 keine neuen Benutzer mehr.
--
-- Ursache: auth.users hatte KEINEN Trigger mehr, der public.profiles
-- befuellt. Die Funktion public.handle_new_user() war vorhanden, der
-- Trigger on_auth_user_created dagegen nicht — er war nie in einer
-- Migration versioniert, sondern nur direkt in der Supabase-Cloud-Instanz
-- angelegt worden. Bei der Migration auf Hetzner (31.08.2026) wanderte das
-- public-Schema mit, das auth-Schema legte Supabase aber neu an: der
-- Trigger blieb zurueck.
--
-- Messbar war das an:
--   auth.users      60 Zeilen, neueste 2026-09-03 14:18
--   public.profiles 58 Zeilen, neueste 2026-08-28 15:00
-- Zwei Registrierungen von heute (eine per E-Mail, eine per Google)
-- landeten in auth.users, bekamen aber kein Profil — und das Admin-Panel
-- liest ausschliesslich profiles.
--
-- Diese Migration stellt den Trigger her, haertet die Funktion gegen
-- Doppel-Inserts und zieht fehlende Profile nach. Sie ist idempotent und
-- wurde am 03.09.2026 bereits manuell auf Prod angewendet (erst als
-- Transaktion mit ROLLBACK getestet, dann committet).


-- 1) Funktion gegen Doppel-Inserts haerten. Ohne ON CONFLICT laesst ein
--    bereits vorhandenes Profil (Backfill-Race, Re-Signup nach Loeschung)
--    den INSERT werfen — und weil der Trigger auf auth.users haengt,
--    schlaegt damit die komplette Registrierung fehl. DO NOTHING macht den
--    Trigger idempotent, ohne echte Fehler zu verschlucken.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  full_name TEXT;
  first TEXT;
  last TEXT;
BEGIN
  full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  first := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    split_part(full_name, ' ', 1),
    ''
  );
  last := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    CASE WHEN position(' ' in full_name) > 0
         THEN substring(full_name from position(' ' in full_name) + 1)
         ELSE '' END,
    ''
  );

  INSERT INTO public.profiles (
    id, email, first_name, last_name, birth_date, phone, avatar_url,
    address, postal_code, city, country, agb_accepted_at, newsletter_opt_in
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(first, ''),
    NULLIF(last, ''),
    (NEW.raw_user_meta_data->>'birth_date')::DATE,
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', ''), ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
    NULLIF(NEW.raw_user_meta_data->>'address', ''),
    NULLIF(NEW.raw_user_meta_data->>'postal_code', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country', ''), 'AT'),
    CASE WHEN NEW.raw_user_meta_data->>'agb_accepted_at' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>'agb_accepted_at')::timestamptz
         ELSE NULL END,
    COALESCE((NEW.raw_user_meta_data->>'newsletter_opt_in')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- 2) Der eigentliche Fix: der Trigger auf auth.users.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Backfill: Profile fuer alle bestehenden auth.users ohne Profil.
INSERT INTO public.profiles (
  id, email, first_name, last_name, birth_date, phone, avatar_url,
  address, postal_code, city, country, agb_accepted_at, newsletter_opt_in, created_at
)
SELECT
  u.id,
  COALESCE(u.email, ''),
  NULLIF(COALESCE(u.raw_user_meta_data->>'first_name',
    split_part(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), ' ', 1)), ''),
  NULLIF(COALESCE(u.raw_user_meta_data->>'last_name',
    CASE WHEN position(' ' in COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')) > 0
         THEN substring(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')
                        from position(' ' in COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')) + 1)
         ELSE '' END), ''),
  (u.raw_user_meta_data->>'birth_date')::DATE,
  NULLIF(COALESCE(u.raw_user_meta_data->>'phone', ''), ''),
  COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture', NULL),
  NULLIF(u.raw_user_meta_data->>'address', ''),
  NULLIF(u.raw_user_meta_data->>'postal_code', ''),
  NULLIF(u.raw_user_meta_data->>'city', ''),
  COALESCE(NULLIF(u.raw_user_meta_data->>'country', ''), 'AT'),
  CASE WHEN u.raw_user_meta_data->>'agb_accepted_at' IS NOT NULL
       THEN (u.raw_user_meta_data->>'agb_accepted_at')::timestamptz ELSE NULL END,
  COALESCE((u.raw_user_meta_data->>'newsletter_opt_in')::boolean, false),
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

