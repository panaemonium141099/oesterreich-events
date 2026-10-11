-- Läufe des Event-Dedup (src/scripts/dedup.ts).
--
-- Der Beginn des letzten geschriebenen Laufs ist der Anker des
-- Sicherheitsventils: Zeilen, die danach angelegt wurden, sind Zulauf und
-- zählen nicht als Massenänderung am Bestand (countsForValve). Ohne Anker
-- zählte das Ventil den normalen Zulauf (rund 940 neue Duplikate je Nacht)
-- mit und blockierte sich nach einem Stopp selbst (Nachtläufe 10. und
-- 11.10.2026). Dazu der Verlauf der Plangrößen, um die Grenzen zu prüfen.

CREATE TABLE IF NOT EXISTS public.dedup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('written', 'valve_stopped')),
  new_duplicates integer NOT NULL DEFAULT 0,
  counted_new_duplicates integer NOT NULL DEFAULT 0,
  repoints integer NOT NULL DEFAULT 0,
  releases integer NOT NULL DEFAULT 0,
  visible_releases integer NOT NULL DEFAULT 0,
  garbage integer NOT NULL DEFAULT 0,
  write_errors integer NOT NULL DEFAULT 0,
  github_run_id bigint,
  note text
);

CREATE INDEX IF NOT EXISTS idx_dedup_runs_written ON public.dedup_runs (started_at DESC) WHERE outcome = 'written';

-- Nur der Service-Key (Pipeline) liest und schreibt.
ALTER TABLE public.dedup_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dedup_runs FROM PUBLIC, anon, authenticated;

-- Anker: der betreute Nachholplan vom 2026-10-09 (Beginn 12:32 UTC,
-- 8.269 neue Duplikate, 2.172 umgehängt, 1.890 Freigaben, 696 Müll).
INSERT INTO public.dedup_runs (started_at, finished_at, outcome, new_duplicates, counted_new_duplicates, repoints, releases, garbage, write_errors, note)
SELECT '2026-10-09 12:32:00+00', '2026-10-09 12:40:00+00', 'written', 8269, 8269, 2172, 1890, 696, 46, 'betreuter Nachholplan (lokal), Fehler nur im Paar-Protokoll'
WHERE NOT EXISTS (SELECT 1 FROM public.dedup_runs);
