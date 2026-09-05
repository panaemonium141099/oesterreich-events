-- Ein-Satz-Fazit je Lauf.
--
-- Die erste Fassung der Bericht-Mail trug als Ueberschrift den technischen
-- Slug ("blog-autowriter") und darunter sofort die Kennzahlen-Tabelle. Wer
-- die Mail morgens im Postfach hat, musste aus "Kandidaten 47 / Versuche 3
-- / Geschrieben 2" selbst erschliessen, ob das gut oder schlecht war.
--
-- Das Fazit schreibt der Workflow selbst, weil nur er weiss, worauf es bei
-- ihm ankommt: "2 von 2 Posts geschrieben" beim Autowriter,
-- "1.909 Events ohne Ticket-Link (8,6 %)" beim Eventim-Import.
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS summary text;

COMMENT ON COLUMN public.workflow_runs.summary IS
  'Ein Satz, der den Lauf zusammenfasst. Steht in der Mail direkt unter dem Status.';
