-- dedup_runs je Land (fn-29.18, Nachtlauf der deutschen Gemeinde-Adapter).
--
-- Das Sicherheitsventil des Dedup rechnet seitdem je Land: der erste
-- DE-Nachtlauf bringt zehntausende neue Zeilen auf einmal, ein Stopp dafür
-- darf den Plan für Österreich nicht aufhalten. Jeder Lauf schreibt eine
-- Zeile je Land; der Anker eines Landes ist der letzte geschriebene Lauf
-- dieses Landes. Ältere Zeilen ohne Land galten allen Ländern und bleiben
-- Anker für alle (src/scripts/dedup.ts, loadAnchor).

ALTER TABLE public.dedup_runs ADD COLUMN IF NOT EXISTS country text;

CREATE INDEX IF NOT EXISTS idx_dedup_runs_written_country
  ON public.dedup_runs (country, started_at DESC) WHERE outcome = 'written';

NOTIFY pgrst, 'reload schema';
