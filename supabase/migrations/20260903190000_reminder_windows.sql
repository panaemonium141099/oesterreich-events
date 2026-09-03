-- Waehlbare Erinnerungs-Zeitpunkte fuer E-Mail-Erinnerungen ohne Konto.
--
-- Bisher waren die Fenster fest verdrahtet: zwei Tage vorher und am Tag des
-- Events (reminded_2d_at / reminded_day_at). Eingeloggte Nutzer konnten in
-- ihren Profil-Praeferenzen zwischen 7 Tagen und 1 Tag waehlen — anonyme
-- Besucher hatten diese Wahl nicht. Diese Migration gleicht das an.
--
-- windows haelt die gewaehlten Zeitpunkte. Der Default entspricht exakt dem
-- bisherigen Verhalten, damit bestehende Abos unveraendert weiterlaufen.

ALTER TABLE public.event_email_reminders
  ADD COLUMN IF NOT EXISTS windows text[] NOT NULL DEFAULT ARRAY['2d', 'day']::text[],
  ADD COLUMN IF NOT EXISTS reminded_7d_at timestamptz;

-- Nur bekannte Fenster zulassen und mindestens eines verlangen: ein leeres
-- Array waere ein Abo, das nie eine Mail ausloest — also ein stiller
-- Fehlschlag genau der Sorte, die wir gerade ueberall herausraeumen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_email_reminders'::regclass
      AND conname = 'event_email_reminders_windows_valid'
  ) THEN
    ALTER TABLE public.event_email_reminders
      ADD CONSTRAINT event_email_reminders_windows_valid
      CHECK (
        array_length(windows, 1) >= 1
        AND windows <@ ARRAY['7d', '2d', 'day']::text[]
      );
  END IF;
END $$;

COMMENT ON COLUMN public.event_email_reminders.windows IS
  'Gewaehlte Erinnerungs-Zeitpunkte: 7d = eine Woche vorher, 2d = zwei Tage vorher, day = am Tag des Events.';
COMMENT ON COLUMN public.event_email_reminders.reminded_7d_at IS
  'Zeitpunkt, zu dem die 7-Tage-Erinnerung versendet wurde (NULL = noch offen).';
