-- Bericht-Postfach fuer alle automatisierten Workflows.
--
-- Warum ueber die DB und nicht direkt per Mail aus dem Workflow:
--
--  1. Die GitHub-Actions-Workflows (Scrape, Blog-Autowriter, Eventim,
--     Aktivitaeten, Viator, Saison-Guide) haben KEINEN Mail-Key in ihren
--     Secrets — nur SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY. Den
--     Brevo-Key dorthin zu kopieren hiesse, ihn an einer zweiten Stelle zu
--     pflegen und zu rotieren.
--  2. Ein Workflow, den ein Timeout oder OOM killt, kann keine Fehlermail
--     mehr schicken. Eine Zeile, die auf 'running' stehen bleibt, verraet
--     ihn trotzdem — der Versender meldet sie als haengengeblieben.
--  3. Der Verlauf bleibt abfragbar: "lief der Blog-Autowriter letzte Woche
--     jeden Tag?" ist eine SQL-Zeile statt Log-Archaeologie.
--
-- Vorgeschichte: `sendAlertIfNeeded` in src/lib/scrape-reporter.ts wollte
-- per Resend an alerts@osterreich.events melden. RESEND_API_KEY war nie
-- gesetzt (weder auf dem Server noch in den GH-Secrets) und die Domain ist
-- seit dem Umzug auf lasstreffen.at tot — die Funktion loggte
-- "skipping email" und kehrte zurueck. Es ist nie eine Alarmmail
-- angekommen.

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stabiler Kennname, z. B. 'blog-autowriter', 'scrape-pipeline'.
  workflow      text        NOT NULL,
  -- 'cron' | 'manual' | 'github_dispatch'
  trigger       text        NOT NULL DEFAULT 'cron',
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  -- 'running' | 'success' | 'partial' | 'failed'
  status        text        NOT NULL DEFAULT 'running',
  -- Zahlen fuer die Tabelle im Bericht: { "neue Events": 1834, ... }
  metrics       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Einzelposten mit Titel/Auszug/URL (z. B. die geschriebenen Blogposts).
  items         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Fehlertexte, auch wenn der Lauf insgesamt 'success' war.
  errors        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Link zum GitHub-Run, falls von dort ausgeloest.
  run_url       text,
  -- Gesetzt, sobald die Bericht-Mail raus ist. NULL = noch zu verschicken.
  reported_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Der Versender sucht "fertig, aber noch nicht gemeldet". Partieller Index,
-- weil die gemeldeten Zeilen nach kurzer Zeit die grosse Mehrheit sind und
-- nie wieder gelesen werden muessen.
CREATE INDEX IF NOT EXISTS workflow_runs_unreported_idx
  ON public.workflow_runs (finished_at)
  WHERE reported_at IS NULL;

-- Fuer "lief Workflow X zuletzt wann?" und die Haenger-Erkennung.
CREATE INDEX IF NOT EXISTS workflow_runs_workflow_started_idx
  ON public.workflow_runs (workflow, started_at DESC);

COMMENT ON TABLE public.workflow_runs IS
  'Ein Eintrag je Lauf eines automatisierten Workflows. /api/cron/workflow-reports verschickt daraus die Bericht-Mails.';
