/**
 * Zieht Events zurück, die ihre Quelle nicht mehr listet.
 *
 * Regeln und Begründung: src/lib/quality/withdrawal.ts. Läuft nächtlich im
 * Post-Processing (scrape-pipeline.ts, nach dem Dedup). Zurückgezogen heißt
 * `publish_status = 'suppressed'` + `withdrawn_at`; listet die Quelle das
 * Event wieder, hebt der Schreibpfad (supabase-sync) beides auf.
 *
 *   npm run withdraw:stale              # schreiben
 *   npm run withdraw:stale -- --dry-run # nur zählen
 */

import { createClient } from '@supabase/supabase-js';
import { forEachPage } from '../lib/db/fetch-all';
import { planWithdrawals, type SightingRow } from '../lib/quality/withdrawal';

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

  const plan = planWithdrawals(rows, { now });

  const bySource = new Map<string, { missing: number; dead: number }>();
  for (const w of plan.withdraw) {
    const s = bySource.get(w.source_name) ?? { missing: 0, dead: 0 };
    if (w.reason === 'source_dead') s.dead++;
    else s.missing++;
    bySource.set(w.source_name, s);
  }
  console.log(`${rows.length} Zeilen gelesen, ${plan.withdraw.length} zurückzuziehen${DRY_RUN ? ' (dry-run)' : ''}`);
  for (const [source, s] of [...bySource].sort((a, b) => b[1].missing + b[1].dead - (a[1].missing + a[1].dead))) {
    console.log(`  ${source}: ${s.missing} nicht mehr gelistet${s.dead ? `, ${s.dead} Quelle tot` : ''}`);
  }
  if (plan.skippedScopes.length > 0) {
    console.log(`${plan.skippedScopes.length} Bereiche übersprungen (zu viel verschwunden, Scraper prüfen):`);
    for (const s of plan.skippedScopes) console.log(`  ${s.scope}: ${s.candidates} von ${s.visible}`);
  }
  if (DRY_RUN || plan.withdraw.length === 0) return;

  const ids = plan.withdraw.map((w) => w.id);
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
