-- fn-31.6: Regionsschlüssel für beide Länder.
--
-- `events.bundesland` (CHECK auf die neun österreichischen IDs) und
-- `events.district` (FK auf district_canonical) führen nur österreichische
-- Werte; für deutsche Zeilen sind sie leer. lasstreffen.de braucht Land,
-- Kreis und Gemeinde als filterbare Spalten.
--
--   region_id     AT: Bundesland-ID          DE: Land-ID (bayern, …)
--   kreis_key     AT: politischer Bezirk (3) DE: Kreisschlüssel (5)
--   gemeinde_key  AT: Gemeindekennziffer (5) DE: AGS (8)
--
-- Bewusst ohne CHECK und ohne FK: ein Wert, den eine Tabelle nicht kennt,
-- darf nie wieder einen ganzen Schreib-Batch abweisen (07.09.2026: 4.801
-- Events an events.district verloren). Gültigkeit sichert der Schreibweg
-- (src/lib/location/region-keys.ts) gegen die Stammdateien.
--
-- Abwärtskompatibel: nullable, kein Standardwert, kein Umschreiben der
-- Tabelle. Indizes folgen in einer eigenen Datei nach dem Backfill.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>

SET lock_timeout = '5s';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS region_id text,
  ADD COLUMN IF NOT EXISTS kreis_key text,
  ADD COLUMN IF NOT EXISTS gemeinde_key text;

COMMENT ON COLUMN public.events.region_id IS 'Land der Gemeinde: AT Bundesland-ID, DE Land-ID (fn-31)';
COMMENT ON COLUMN public.events.kreis_key IS 'AT politischer Bezirk (3 Stellen), DE Kreisschlüssel (5 Stellen) (fn-31)';
COMMENT ON COLUMN public.events.gemeinde_key IS 'AT Gemeindekennziffer (5 Stellen), DE AGS (8 Stellen) (fn-31)';

NOTIFY pgrst, 'reload schema';
