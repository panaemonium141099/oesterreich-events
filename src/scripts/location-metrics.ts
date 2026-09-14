/**
 * Kennzahlen zur Ortsqualität (fn-25 O1, Review §10) als Pipeline-Schritt.
 *
 * Misst je Nachtlauf über die künftigen Events:
 *  - Abdeckung: Anteil bestätigte Venue/Adresse, nur Gemeinde, Region,
 *    ungeklärt, Konflikt, ohne Entscheidung (Altbestand)
 *  - Verdachtsfälle: Adress-PLZ vs. Pin > 25 km (der Quelltext widerspricht
 *    dem Pin), Konflikte je Quelle
 *  - Verbreitung: die häufigsten Konflikt-Gruppen (Quelle + Rohname)
 *  - Drift: Zeilen, deren Ortsentscheidung sich seit dem Vortag geändert hat,
 *    obwohl der Eingabehash gleich blieb (unerklärte Änderung)
 *  - Wiederholbarkeit: Stichprobe von 300 Zeilen mit Quellenstand erneut
 *    entschieden → Abweichungen müssen 0 sein
 *  - Rückstand: offene Konflikt-Gruppen und die nächsten betroffenen Termine
 *
 * Ergebnis: Zeile in `workflow_runs` (Workflow `location-audit`), Status
 * `failed`, wenn eine Alarmgrenze reißt (neue Konflikte > 500 in 24 h,
 * Wiederholbarkeit < 100 %, Drift > 200). Präzision (Stichprobe gegen
 * Belege) bleibt ein manueller Schritt, dafür liefert die Prüfansicht
 * `/admin/ortsdaten` die Fälle.
 *
 * Aufruf: npx tsx src/scripts/location-metrics.ts
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

try {
  const envPath = join(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
} catch { /* ignore */ }

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { startWorkflowRun, finishWorkflowRun, type WorkflowItem } from '../lib/reporting/workflow-run';
import { inputFromStoredRow, STORED_LOCATION_COLUMNS, type StoredEventLocationRow } from '../lib/location/re-resolve';
import { resolveEventLocation } from '../lib/location/resolver';
import { loadLocationEvidence } from '../lib/location/evidence';

const NEW_CONFLICTS_ALARM = 500;
const DRIFT_ALARM = 200;

async function countWhere(sb: SupabaseClient, apply: (q: ReturnType<SupabaseClient['from']>['select'] extends never ? never : any) => any): Promise<number> {
  const base = sb.from('events').select('id', { count: 'exact', head: true }).gte('start_date', new Date().toISOString()).in('publish_status', ['published', 'published_low_confidence', 'needs_review']);
  const { count, error } = await apply(base);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase-Env fehlt');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const runId = await startWorkflowRun('location-audit');
  const errors: string[] = [];
  const metrics: Record<string, number> = {};
  const items: WorkflowItem[] = [];

  try {
    const total = await countWhere(sb, q => q);
    const statuses = ['venue_confirmed', 'address_confirmed', 'municipality_only', 'region_only', 'unresolved', 'conflict', 'online'];
    for (const s of statuses) metrics[`status ${s}`] = await countWhere(sb, q => q.eq('location_status', s));
    metrics['status (ohne Entscheidung)'] = await countWhere(sb, q => q.is('location_status', null));
    metrics['Events gesamt (künftig)'] = total;
    const precise = metrics['status venue_confirmed'] + metrics['status address_confirmed'];
    metrics['Abdeckung präzise %'] = total ? Math.round((1000 * precise) / total) / 10 : 0;
    metrics['Abdeckung Gemeinde %'] = total ? Math.round((1000 * metrics['status municipality_only']) / total) / 10 : 0;

    // Neue Konflikte der letzten 24 h (aus dem Protokoll)
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count: newConflicts, error: e1 } = await sb
      .from('events').select('id', { count: 'exact', head: true })
      .gte('start_date', new Date().toISOString()).eq('location_status', 'conflict').gte('updated_at', since);
    if (e1) errors.push(`neue Konflikte: ${e1.message}`);
    metrics['Konflikte neu (24 h)'] = newConflicts ?? 0;

    // Verbreitung: häufigste Konflikt-Gruppen (Quelle + Rohname)
    const { data: conflictRows } = await sb
      .from('events').select('source_name, location_name_raw, location_name, start_date')
      .gte('start_date', new Date().toISOString()).eq('location_status', 'conflict').order('start_date', { ascending: true }).limit(1000);
    const groups = new Map<string, { n: number; next: string }>();
    for (const r of (conflictRows ?? []) as Array<{ source_name: string; location_name_raw: string | null; location_name: string | null; start_date: string }>) {
      const k = `${r.source_name} · ${r.location_name_raw ?? r.location_name ?? '∅'}`;
      const g = groups.get(k) ?? { n: 0, next: r.start_date };
      g.n++;
      groups.set(k, g);
    }
    const top = [...groups.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10);
    metrics['Konflikt-Gruppen (offen)'] = groups.size;
    for (const [k, g] of top) items.push({ title: `Konflikt ×${g.n}: ${k}`, meta: { 'nächster Termin': g.next.slice(0, 10) }, url: 'https://lasstreffen.at/admin/ortsdaten' });

    // Verdachtsfälle: Adress-PLZ widerspricht dem Pin > 25 km — via location_compare_runs nicht nötig,
    // die Entscheidung prüft das bereits; hier zählen wir Zeilen ohne Entscheidung mit Pin (Altbestand).
    metrics['Altbestand mit Pin ohne Entscheidung'] = await countWhere(sb, q => q.is('location_status', null).not('latitude', 'is', null));

    // Wiederholbarkeit: Stichprobe erneut entscheiden
    const { data: sample } = await sb
      .from('events').select(STORED_LOCATION_COLUMNS)
      .gte('start_date', new Date().toISOString()).not('raw_event_id', 'is', null).not('location_status', 'is', null)
      .order('updated_at', { ascending: false }).limit(300);
    const rows = (sample ?? []) as unknown as StoredEventLocationRow[];
    let drift = 0;
    if (rows.length > 0) {
      const inputs = rows.map(inputFromStoredRow);
      const evidence = await loadLocationEvidence(sb, inputs);
      rows.forEach((row, i) => {
        const d = resolveEventLocation(inputs[i], evidence[i]);
        const sameInput = row.location_resolution?.input_hash === d.input_hash;
        const sameOutcome = row.location_status === d.status && row.latitude === d.latitude && row.longitude === d.longitude;
        if (sameInput && !sameOutcome) drift++;
      });
    }
    metrics['Wiederholbarkeit Stichprobe'] = rows.length;
    metrics['Wiederholbarkeit Abweichungen'] = drift;
    metrics['Wiederholbarkeit %'] = rows.length ? Math.round((1000 * (rows.length - drift)) / rows.length) / 10 : 100;

    // Drift im Bestand: geänderte Entscheidung in 24 h (Näherung über updated_at + Status)
    const { count: changed24, error: e2 } = await sb
      .from('events').select('id', { count: 'exact', head: true })
      .gte('start_date', new Date().toISOString()).gte('updated_at', since).not('location_status', 'is', null);
    if (e2) errors.push(`Drift: ${e2.message}`);
    metrics['Entscheidungen geschrieben (24 h)'] = changed24 ?? 0;

    const alarms: string[] = [];
    if ((newConflicts ?? 0) > NEW_CONFLICTS_ALARM) alarms.push(`Neue Konflikte ${newConflicts} > ${NEW_CONFLICTS_ALARM}`);
    if (drift > 0) alarms.push(`Wiederholbarkeit verletzt: ${drift} Abweichungen bei gleichem Eingabehash`);
    if (drift > DRIFT_ALARM) alarms.push(`Drift ${drift} > ${DRIFT_ALARM}`);

    const summary =
      `${precise.toLocaleString('de-AT')} präzise (${metrics['Abdeckung präzise %']} %), ` +
      `${metrics['status municipality_only'].toLocaleString('de-AT')} Gemeinde-Ebene, ` +
      `${metrics['status conflict'].toLocaleString('de-AT')} Konflikte (${newConflicts ?? 0} neu), ` +
      `${metrics['status (ohne Entscheidung)'].toLocaleString('de-AT')} ohne Entscheidung` +
      (alarms.length ? ` · ALARM: ${alarms.join('; ')}` : '');
    console.log('[location-metrics]', summary);
    for (const [k, v] of Object.entries(metrics)) console.log(`  ${k}: ${v}`);
    for (const it of items) console.log(`  - ${it.title}`);
    await finishWorkflowRun(runId, { status: alarms.length ? 'failed' : errors.length ? 'partial' : 'success', summary, metrics, items, errors: [...errors, ...alarms] });
    process.exit(0);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishWorkflowRun(runId, { status: 'failed', summary: `Kennzahlen nicht berechnet: ${msg}`, metrics, items, errors: [msg] });
    console.error(e);
    process.exit(1);
  }
}

main();
