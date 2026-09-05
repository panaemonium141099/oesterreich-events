import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendGenericEmail } from '@/lib/email';
import {
  renderWorkflowReport,
  workflowReportSubject,
  type WorkflowReportData,
} from '@/lib/reporting/workflow-report-email';

/**
 * Verschickt die Berichte aus `workflow_runs`.
 *
 * Die Workflows selbst mailen nicht: die GitHub-Actions-Jobs haben keinen
 * Mail-Key in ihren Secrets, und ein Job, den ein Timeout killt, käme gar
 * nicht mehr dazu (siehe Migration 20260905180000_workflow_runs.sql). Sie
 * schreiben nur ihre Zeile; dieser Cron liest sie hier ab, wo der
 * Brevo-Key liegt.
 *
 * Zwei Aufgaben:
 *   1. Abgeschlossene, noch nicht gemeldete Läufe → Bericht-Mail.
 *   2. Läufe, die seit STALE_AFTER_MIN auf 'running' stehen → als
 *      hängengeblieben melden. Das ist der einzige Weg, von einem
 *      abgestürzten Job überhaupt zu erfahren.
 *
 * Auth: CRON_SECRET als Bearer-Token (wie die übrigen Cron-Routen).
 */
export const dynamic = 'force-dynamic';

/**
 * Ab wann ein offener Lauf als hängengeblieben gilt. Grosszügig, weil der
 * Scrape-Lauf mit seinen Gemeinde-Aggregatoren regulär bis zu vier Stunden
 * braucht (SCRAPER_SOFT_BUDGET_MIN = 240).
 */
const STALE_AFTER_MIN = 360;

/** Obergrenze pro Aufruf, damit ein Rückstau nicht das Postfach flutet. */
const MAX_MAILS_PER_RUN = 12;

interface RunRow {
  id: string;
  workflow: string;
  started_at: string;
  finished_at: string | null;
  status: WorkflowReportData['status'];
  metrics: Record<string, string | number>;
  items: WorkflowReportData['items'];
  errors: string[];
  run_url: string | null;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const alertEmail = process.env.ALERT_EMAIL;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase-Zugang fehlt' }, { status: 500 });
  }
  if (!alertEmail) {
    return NextResponse.json({ error: 'ALERT_EMAIL fehlt' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const staleBefore = new Date(Date.now() - STALE_AFTER_MIN * 60_000).toISOString();

  // Fertige Läufe und Hänger in EINER Abfrage: beide sind "noch nicht
  // gemeldet", der Unterschied ist nur, ob finished_at gesetzt ist.
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('id, workflow, started_at, finished_at, status, metrics, items, errors, run_url')
    .is('reported_at', null)
    .or(`finished_at.not.is.null,started_at.lt.${staleBefore}`)
    .order('started_at', { ascending: true })
    .limit(MAX_MAILS_PER_RUN);

  if (error) {
    return NextResponse.json({ error: 'Abfrage fehlgeschlagen', detail: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as RunRow[];
  let sent = 0;
  const failures: string[] = [];

  for (const row of rows) {
    const stalled = row.finished_at === null;
    const report: WorkflowReportData = {
      workflow: row.workflow,
      status: stalled ? 'running' : row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      metrics: row.metrics ?? {},
      items: Array.isArray(row.items) ? row.items : [],
      errors: Array.isArray(row.errors) ? row.errors : [],
      runUrl: row.run_url,
      stalled,
    };

    const result = await sendGenericEmail(
      alertEmail,
      workflowReportSubject(report),
      renderWorkflowReport(report),
    );

    if (!result.success) {
      // NICHT als gemeldet markieren — der nächste Lauf versucht es erneut.
      failures.push(`${row.workflow}: ${result.error}`);
      continue;
    }

    const patch: Record<string, unknown> = { reported_at: new Date().toISOString() };
    // Einen Hänger auch im Status festhalten, sonst steht er für immer auf
    // 'running' und taucht in jeder Auswertung als laufend auf.
    if (stalled) {
      patch.status = 'failed';
      patch.errors = [
        ...report.errors,
        `Kein Abschluss innerhalb von ${STALE_AFTER_MIN} Minuten — als hängengeblieben gewertet.`,
      ];
    }
    const { error: updateError } = await supabase.from('workflow_runs').update(patch).eq('id', row.id);
    if (updateError) {
      // Mail ist raus, Markierung nicht — beim nächsten Lauf gäbe es ein
      // Duplikat. Laut melden statt still doppelt zu senden.
      failures.push(`${row.workflow}: Mail verschickt, aber nicht markiert (${updateError.message})`);
      continue;
    }
    sent++;
  }

  if (failures.length > 0) {
    return NextResponse.json({ sent, pending: rows.length - sent, failures }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent, checked: rows.length });
}
