-- Fortsetzungspunkt der Gemeinde-Aggregatoren (src/lib/scrapers/rotation-cursor.ts).
--
-- Ein Lauf, der am Soft-Budget abbricht, schreibt den Schlüssel der zuletzt
-- bearbeiteten Gemeinde (Kennziffer und Listenname, nie den Index); der
-- nächste Lauf liest den jüngsten Eintrag dieser Quelle und beginnt danach.
-- Vorher rückte der Startpunkt nur eine Gemeinde pro Tag weiter
-- (rotateDaily): gemeinde-registry erreichte jede Nacht fast dieselben
-- ~800 von 1.881 Gemeinden, Salzburg und Steiermark seit Mai nicht mehr.
--
-- NULL bei allen Scrapern ohne Fortsetzung und bei Läufen, die kein
-- Ergebnis abgeliefert haben (Timeout, Absturz). Gelesen über den
-- bestehenden Index source_runs_source_time_idx (source_name, run_at DESC).

ALTER TABLE public.source_runs ADD COLUMN IF NOT EXISTS rotation_cursor text;

COMMENT ON COLUMN public.source_runs.rotation_cursor IS
  'Schlüssel des zuletzt bearbeiteten Listeneintrags; der nächste Lauf setzt danach fort (rotation-cursor.ts).';

NOTIFY pgrst, 'reload schema';
