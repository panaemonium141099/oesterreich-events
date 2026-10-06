/**
 * Zieht Events zurück, die ihre Quelle nicht mehr listet.
 *
 * Regeln und Begründung: src/lib/quality/withdrawal.ts. Nicht mehr
 * gelistete Kandidaten werden nur zurückgezogen, wenn ihre Detailseite an
 * der Quelle 404/410 liefert. Läuft nächtlich im Post-Processing
 * (scrape-pipeline.ts, nach dem Dedup). Zurückgezogen heißt
 * `publish_status = 'suppressed'` + `withdrawn_at`; listet die Quelle das
 * Event wieder, hebt der Schreibpfad (supabase-sync) beides auf.
 *
 *   npm run withdraw:stale              # schreiben
 *   npm run withdraw:stale -- --dry-run # nur zählen
 */

import { createClient } from '@supabase/supabase-js';
import { fetchAllRows, forEachPage } from '../lib/db/fetch-all';
import { planWithdrawals, probeGone, type SightingRow } from '../lib/quality/withdrawal';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
// PostgREST trägt .in()-Listen im Query-String: höchstens 200 Ids je Aufruf.
const CHUNK = 200;
// Detailseiten-Abrufe je Nacht (gedrosselt je Website, siehe probeGone).
const PROBE_BUDGET = 2000;

async function main() {
  const now = new Date();
  // Belege brauchen auch Duplikate und nicht sichtbare Zeilen: jede
  // Sichtung zeigt, dass ein Bereich gelesen wurde. Ab gestern, damit ein
  // heute laufendes Event noch als Sichtung zählt.
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const rows: SightingRow[] = [];
  await forEachPage<SightingRow>(
    (from, to) =>
      supabase
        .from('events')
        .select('id, source_name, source_url, start_date, last_seen_at, publish_status, duplicate_of')
        .gte('start_date', since)
        .order('id')
        .range(from, to),
    (page) => { rows.push(...page); },
    { label: 'withdraw-stale-events' },
  );

  // Quellen, deren Scraper noch läuft: ihr Schweigen ist kein Rückzugsbeleg.
  const runs = await fetchAllRows<{ source_name: string }>(
    (from, to) =>
      supabase
        .from('source_runs')
        .select('source_name')
        .gte('run_at', new Date(now.getTime() - 7 * 86_400_000).toISOString())
        .order('id')
        .range(from, to),
    { label: 'source_runs' },
  );
  const runningSources = new Set(runs.map((r) => r.source_name));

  const plan = planWithdrawals(rows, { now, runningSources });

  // Beleg an der Quelle: älteste Kandidaten zuerst, Rest in den nächsten Nächten.
  const lastSeen = new Map(rows.map((r) => [r.id, r.last_seen_at ?? '']));
  const candidates = [...plan.probe].sort((a, b) => (lastSeen.get(a.id)! < lastSeen.get(b.id)! ? -1 : 1));
  const checked = candidates.slice(0, PROBE_BUDGET);
  const gone = await probeGone(checked.map((c) => c.url), { budget: PROBE_BUDGET });
  const confirmed = checked.filter((c) => gone.has(c.url));
  const withdraw = [...plan.withdraw, ...confirmed];

  const bySource = new Map<string, { missing: number; dead: number }>();
  for (const w of withdraw) {
    const s = bySource.get(w.source_name) ?? { missing: 0, dead: 0 };
    if (w.reason === 'source_dead') s.dead++;
    else s.missing++;
    bySource.set(w.source_name, s);
  }
  console.log(`${rows.length} Zeilen gelesen${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`  Quelle abgeschaltet: ${plan.withdraw.length}`);
  console.log(`  Kandidaten: ${plan.probe.length}, ${checked.length} geprüft, ${confirmed.length} an der Quelle weg (404/410)`);
  for (const [source, s] of [...bySource].sort((a, b) => b[1].missing + b[1].dead - (a[1].missing + a[1].dead))) {
    console.log(`  ${source}: ${s.missing} weg an der Quelle${s.dead ? `, ${s.dead} Quelle tot` : ''}`);
  }
  if (DRY_RUN || withdraw.length === 0) return;

  const ids = withdraw.map((w) => w.id);
  let written = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('events')
      .update({ publish_status: 'suppressed', withdrawn_at: now.toISOString() })
      .in('id', ids.slice(i, i + CHUNK))
      .in('publish_status', ['published', 'published_low_confidence'])
      .select('id');
    // supabase-js wirft bei Schreibfehlern nicht: Fehler UND Zahl prüfen.
    if (error) throw new Error(`Update ab ${i}: ${error.message}`);
    written += data?.length ?? 0;
  }
  console.log(`${written} Events zurückgezogen`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
