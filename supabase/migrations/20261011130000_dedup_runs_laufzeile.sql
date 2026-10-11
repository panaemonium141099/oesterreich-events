-- dedup_runs: Lauf wird zu Beginn als 'running' angelegt, mit Beginn nach
-- Datenbank-Uhr (created_at der Events kommt ebenfalls von dort; eine
-- vorgehende Runner-Uhr würde den Anker in die Zukunft setzen). Ein
-- abgebrochener Lauf bleibt 'running' und verschiebt den Anker nicht;
-- 'write_failed' (größerer Teil des Plans nicht geschrieben) ebenso nicht.
-- Dazu die Aufteilung der neuen Duplikate nach Ventil-Klasse.

ALTER TABLE public.dedup_runs ALTER COLUMN started_at SET DEFAULT now();
ALTER TABLE public.dedup_runs ADD COLUMN IF NOT EXISTS inflow_duplicates integer NOT NULL DEFAULT 0;
ALTER TABLE public.dedup_runs ADD COLUMN IF NOT EXISTS series_duplicates integer NOT NULL DEFAULT 0;

ALTER TABLE public.dedup_runs DROP CONSTRAINT IF EXISTS dedup_runs_outcome_check;
ALTER TABLE public.dedup_runs ADD CONSTRAINT dedup_runs_outcome_check
  CHECK (outcome IN ('running', 'written', 'valve_stopped', 'write_failed'));

-- Seed korrigiert: der Nachholplan endete um 12:46 (Paar-Protokoll).
UPDATE public.dedup_runs SET finished_at = '2026-10-09 12:46:00+00'
WHERE started_at = '2026-10-09 12:32:00+00' AND finished_at = '2026-10-09 12:40:00+00';
