/**
 * Nächtliche Nachprüfung des Freigabevertrags im Bestand: Titel- und
 * Zeitregeln (Gemeinde-Dienst, Horizont) auf gespeicherte Zeilen anwenden,
 * auch auf solche, die keine Quelle mehr liefert. Regeln und Begründung:
 * src/lib/quality/admission-recheck.ts.
 *
 * Läuft im Post-Processing nach `withdrawal` und vor dem Dedup, damit der
 * Dedup die neuen Status im selben Lauf sieht. Sicherheitsventil: zu viele
 * Haltungen oder Freigaben → nichts schreiben, Schritt rot; Freigabe per
 * workflow_dispatch (scrape-events.yml) mit höheren Grenzen.
 *
 *   npm run admission:recheck -- --dry-run --report r.json
 *   npm run admission:recheck -- --max-holds 2000 --max-releases 500
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { forEachPage } from '../lib/db/fetch-all';
import { planAdmissionRecheck, protocolWith, type RecheckChange, type RecheckRow } from '../lib/quality/admission-recheck';
import { viennaDayBoundsUtc } from '../lib/pipeline/dedup-evidence';
import { viennaToday } from '../lib/utils/event-time';
import { reportStepReason } from '../lib/pipeline/step-reason';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
/** Argument, sonst Umgebungsvariable (Freigabe per workflow_dispatch), sonst Standard. */
function numArg(name: string, fallback: number, envName: string): number {
  const i = args.indexOf(name);
  const v = i >= 0 ? Number(args[i + 1]) : NaN;
  if (Number.isFinite(v)) return v;
  const e = process.env[envName] ? Number(process.env[envName]) : NaN;
  return Number.isFinite(e) && e > 0 ? e : fallback;
}
const reportIdx = args.indexOf('--report');
const REPORT_PATH = (reportIdx >= 0 ? args[reportIdx + 1] : null) ?? process.env.ADMISSION_RECHECK_REPORT_PATH ?? null;
// Eine normale Nacht hält kaum etwas (gelieferte Zeilen hält schon der
// Sync). Erster Lauf 2026-10-17: siehe MASTERPLAN §3.11. Eine neue oder
// zurückgenommene Regel trifft schnell tausend Zeilen: dann soll ein
// Mensch auf den Bericht schauen.
const LIMITS = {
  maxHolds: numArg('--max-holds', 500, 'ADMISSION_RECHECK_MAX_HOLDS'),
  maxReleases: numArg('--max-releases', 300, 'ADMISSION_RECHECK_MAX_RELEASES'),
};
// PostgREST trägt .in()-Listen im Query-String: höchstens 200 Ids je Aufruf.
const CHUNK = 200;
const CONCURRENCY = 8;

type ScanRow = RecheckRow & { source_name: string | null; last_seen_at: string | null };

async function main() {
  const now = new Date();
  const fromIso = viennaDayBoundsUtc(viennaToday(now))[0];
  const rows: ScanRow[] = [];
  await forEachPage<ScanRow>(
    (from, to) =>
      supabase
        .from('events')
        .select('id,title,start_date,publish_status,quality_score,location_status,source_name,last_seen_at,reasons:location_resolution->reasons')
        .gte('start_date', fromIso)
        .in('publish_status', ['published', 'published_low_confidence', 'needs_review'])
        .order('id')
        .range(from, to) as unknown as PromiseLike<{ data: ScanRow[] | null; error: { message: string } | null }>,
    (page) => { rows.push(...page); },
    { label: 'admission-recheck' },
  );

  const changes = planAdmissionRecheck(rows, now);
  const byId = new Map(rows.map(r => [r.id, r]));
  const count = (a: RecheckChange['action']) => changes.filter(c => c.action === a).length;
  const holds = count('hold');
  const releases = count('release');
  const protocols = count('protocol');

  const tally = new Map<string, number>();
  for (const c of changes) {
    const r = byId.get(c.id)!;
    const key = `${c.action} ${[...c.added, ...c.removed.map(x => `-${x}`)].join(',') || '(Protokoll gleich)'} ${r.source_name}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  console.log(`[admission-recheck] ${rows.length} Zeilen geprüft (ab ${fromIso})`);
  console.log(`  Grenzen: ${LIMITS.maxHolds} Haltungen, ${LIMITS.maxReleases} Freigaben`);
  console.log(`  Halten: ${holds} | Freigeben: ${releases} | nur Protokoll: ${protocols}`);
  for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`    ${String(n).padStart(5)}  ${k}`);
  for (const c of changes.slice(0, 15)) {
    const r = byId.get(c.id)!;
    console.log(`    ${c.action.padEnd(8)} ${r.start_date?.slice(0, 10)} [${r.source_name}] ${r.title?.slice(0, 60)} (zuletzt ${r.last_seen_at?.slice(0, 10) ?? '?'})`);
  }

  if (REPORT_PATH) {
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, JSON.stringify({
      at: now.toISOString(),
      limits: LIMITS,
      counts: { scanned: rows.length, holds, releases, protocols },
      changes: changes.map(c => {
        const r = byId.get(c.id)!;
        return { ...c, from: r.publish_status, title: r.title, source: r.source_name, start_date: r.start_date, last_seen_at: r.last_seen_at };
      }),
    }, null, 2));
    console.log(`  Bericht: ${REPORT_PATH}`);
  }

  const over: string[] = [];
  if (holds > LIMITS.maxHolds) over.push(`${holds} Haltungen > ${LIMITS.maxHolds}`);
  if (releases > LIMITS.maxReleases) over.push(`${releases} Freigaben > ${LIMITS.maxReleases}`);
  if (over.length > 0) {
    const why = over.join(', ');
    console.error(`[admission-recheck] Sicherheitsventil, nichts geschrieben: ${why}`);
    reportStepReason(`Sicherheitsventil, nichts geschrieben: ${why}`);
    process.exit(1);
  }
  if (DRY_RUN || changes.length === 0) {
    console.log(DRY_RUN ? '[admission-recheck] Dry-Run, nichts geschrieben.' : '[admission-recheck] Nichts zu tun.');
    return;
  }

  // Volles Protokoll erst für die Zeilen, die sich ändern: der Scan liest
  // nur die Gründe. updated_at sichert gegen einen parallelen Schreiber.
  const full = new Map<string, { location_resolution: Record<string, unknown> | null; updated_at: string | null; publish_status: string | null }>();
  const ids = changes.map(c => c.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('events')
      .select('id,location_resolution,updated_at,publish_status')
      .in('id', ids.slice(i, i + CHUNK));
    if (error) throw new Error(`Protokolle lesen ab ${i}: ${error.message}`);
    for (const r of (data ?? []) as Array<{ id: string; location_resolution: Record<string, unknown> | null; updated_at: string | null; publish_status: string | null }>) {
      full.set(r.id, r);
    }
  }

  const nowIso = now.toISOString();
  let written = 0;
  let skipped = 0;
  const errors: string[] = [];
  const queue = [...changes];
  async function worker() {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const row = full.get(c.id);
      // Seit dem Scan anders geschrieben (Sync, Dedup): die nächste Nacht prüft neu.
      if (!row || row.publish_status !== byId.get(c.id)!.publish_status) { skipped++; continue; }
      const payload: Record<string, unknown> = { location_resolution: protocolWith(row.location_resolution, c, nowIso) };
      if (c.publish_status) payload.publish_status = c.publish_status;
      let q = supabase.from('events').update(payload).eq('id', c.id);
      q = row.updated_at ? q.eq('updated_at', row.updated_at) : q.is('updated_at', null);
      const { data, error } = await q.select('id');
      if (error) errors.push(`${c.id}: ${error.message}`);
      else if (!data || data.length === 0) skipped++;
      else written++;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[admission-recheck] geschrieben ${written}, übersprungen ${skipped} (parallel geändert), Fehler ${errors.length}`);
  if (errors.length > 0) {
    console.error(errors.slice(0, 10).join('\n'));
    reportStepReason(`${errors.length} Schreibfehler, z. B. ${errors[0]}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[admission-recheck] Abbruch:', err);
  reportStepReason(`Abbruch: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
