/**
 * Lauf-Protokoll fuer automatisierte Workflows.
 *
 * Jeder Cron/Job oeffnet am Anfang eine Zeile in `workflow_runs` und
 * schliesst sie am Ende mit Zahlen, Einzelposten und Fehlern ab.
 * Verschickt wird nichts von hier — das macht
 * `/api/cron/workflow-reports` auf dem Server, wo der Brevo-Key liegt
 * (Begruendung in der Migration 20260905180000_workflow_runs.sql).
 *
 * Fehler-Politik: Das Protokoll darf einen Workflow NIE zum Absturz
 * bringen. Ein fehlgeschlagener Insert wird geloggt und verschluckt —
 * lieber ein Lauf ohne Bericht als ein Scrape-Lauf, der wegen der
 * Berichterstattung stirbt. Sichtbar wird das trotzdem: bleibt die Zeile
 * aus, meldet der Versender den Workflow irgendwann als ueberfaellig.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type WorkflowStatus = 'running' | 'success' | 'partial' | 'failed';
export type WorkflowTrigger = 'cron' | 'manual' | 'github_dispatch';

/** Ein Einzelposten im Bericht — etwa ein geschriebener Blogpost. */
export interface WorkflowItem {
  /** Überschrift der Karte, z. B. der Post-Titel. */
  title: string;
  /** Ein bis drei Sätze: worum geht es. */
  excerpt?: string;
  /** Voll qualifizierte URL, im Bericht verlinkt. */
  url?: string;
  /** Freie Zusatzangaben, werden als "Schlüssel: Wert" gelistet. */
  meta?: Record<string, string | number>;
}

export interface FinishWorkflowInput {
  status: WorkflowStatus;
  /**
   * Ein Satz, der den Lauf zusammenfasst — steht in der Mail direkt unter
   * dem Status. Nur der Workflow weiss, worauf es bei ihm ankommt:
   * "2 von 2 Posts geschrieben" heisst etwas, "Geschrieben: 2" nicht.
   */
  summary?: string;
  /** Zahlen fuer die Tabelle, Reihenfolge bleibt erhalten. */
  metrics?: Record<string, string | number>;
  items?: WorkflowItem[];
  errors?: string[];
  runUrl?: string | null;
}

function client(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[workflow-run] Supabase-Zugang fehlt — kein Lauf-Protokoll.');
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Der GitHub-Run-Link, falls der Workflow dort laeuft. Steht im Bericht,
 * damit man bei einem Fehler direkt im Log landet statt ihn zu suchen.
 */
function githubRunUrl(): string | null {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  return repo && runId ? `https://github.com/${repo}/actions/runs/${runId}` : null;
}

function detectTrigger(): WorkflowTrigger {
  const ev = process.env.GITHUB_EVENT_NAME;
  if (ev === 'schedule') return 'cron';
  if (ev === 'workflow_dispatch' || ev === 'repository_dispatch') return 'github_dispatch';
  return process.env.GITHUB_ACTIONS ? 'github_dispatch' : 'cron';
}

/**
 * Oeffnet die Lauf-Zeile. Rueckgabe ist die id fuer `finishWorkflowRun`
 * oder null, wenn das Protokoll nicht geschrieben werden konnte.
 */
export async function startWorkflowRun(
  workflow: string,
  trigger: WorkflowTrigger = detectTrigger(),
): Promise<string | null> {
  const supabase = client();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('workflow_runs')
      .insert({ workflow, trigger, run_url: githubRunUrl() })
      .select('id')
      .single();
    if (error) {
      console.warn(`[workflow-run] Start von "${workflow}" nicht protokolliert: ${error.message}`);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn('[workflow-run] Start nicht protokolliert:', err);
    return null;
  }
}

/**
 * Schliesst die Zeile ab. `runId === null` (kein Protokoll offen) ist kein
 * Fehler — dann passiert schlicht nichts.
 */
export async function finishWorkflowRun(
  runId: string | null,
  input: FinishWorkflowInput,
): Promise<void> {
  if (!runId) return;
  const supabase = client();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('workflow_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: input.status,
        summary: input.summary ?? null,
        metrics: input.metrics ?? {},
        items: input.items ?? [],
        errors: input.errors ?? [],
        run_url: input.runUrl ?? githubRunUrl(),
      })
      .eq('id', runId);
    if (error) console.warn(`[workflow-run] Abschluss nicht protokolliert: ${error.message}`);
  } catch (err) {
    console.warn('[workflow-run] Abschluss nicht protokolliert:', err);
  }
}

/**
 * Bequemer Rahmen fuer Skripte: oeffnet die Zeile, fuehrt `fn` aus und
 * schliesst ab — auch wenn `fn` wirft. Ein geworfener Fehler wird
 * protokolliert und erneut geworfen, damit der Exit-Code des Jobs stimmt.
 */
export async function withWorkflowRun<T>(
  workflow: string,
  fn: () => Promise<{ result: T } & FinishWorkflowInput>,
): Promise<T> {
  const runId = await startWorkflowRun(workflow);
  try {
    const { result, ...report } = await fn();
    await finishWorkflowRun(runId, report);
    return result;
  } catch (err) {
    await finishWorkflowRun(runId, {
      status: 'failed',
      errors: [err instanceof Error ? `${err.message}\n${err.stack ?? ''}`.trim() : String(err)],
    });
    throw err;
  }
}
