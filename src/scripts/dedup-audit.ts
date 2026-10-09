// src/scripts/dedup-audit.ts
//
// Nachkontrolle nach dem nächtlichen Dedup: zählt sichtbare künftige Events,
// die offensichtlich doppelt sind (gleicher Titel, gleicher Wiener Tag,
// gleiche oder unbekannte Uhrzeit, derselbe Ort, verschiedene Quellen).
// Über der Grenze: Exit 1 → Pipeline-Schritt rot → Alarm-Mail.
//
// Usage:
//   npm run dedup:audit                 # Grenze 100
//   npm run dedup:audit -- --max 0      # jede Restdublette meldet
//   npm run dedup:audit -- --samples 50

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/db/fetch-all';
import { findResidualDuplicates } from '@/lib/pipeline/dedup-audit';
import { pairKey } from '@/lib/pipeline/dedup-engine';
import { toViennaIso } from '@/lib/utils/event-time';
import { reportStepReason } from '@/lib/pipeline/step-reason';
import type { EventRow } from '@/lib/pipeline/types';

try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0 && !process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  }
} catch { /* ignore */ }

const args = process.argv.slice(2);
function numArg(name: string, fallback: number): number {
  const i = args.indexOf(name);
  const v = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
}
// Normalstand nach dem Umbau (2026-10-07): ~20 echte Unklarheiten (zwei
// Christmetten im Ort, dieselbe Show zu zwei Zeiten). Ein ausgefallener Dedup
// bringt schon in einer Nacht deutlich mehr (Ausgangswert vorher: 837).
const MAX_RESIDUAL = numArg('--max', 100);
const SAMPLES = numArg('--samples', 20);

const SELECT = 'id,title,start_date,is_all_day,location_name,postal_code,district,latitude,longitude,location_precision,source_name,source_id,venue_id,publish_status';

async function main(): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Ab Wiener Tagesbeginn heute: auch heutige Events zählen.
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const events = await fetchAllRows<EventRow>(
    (from, to) => supabase
      .from('events')
      .select(SELECT)
      .gte('start_date', since)
      .in('publish_status', ['published', 'published_low_confidence'])
      .order('id')
      .range(from, to) as unknown as PromiseLike<{ data: EventRow[] | null; error: { message: string } | null }>,
    { label: 'dedup-audit: Events' },
  );
  const splits = await fetchAllRows<{ id: string; event_a_id: string; event_b_id: string }>(
    (from, to) => supabase
      .from('event_dedup_log')
      .select('id,event_a_id,event_b_id')
      .eq('decision', 'manual_split')
      .order('id')
      .range(from, to),
    { label: 'dedup-audit: manuelle Trennungen' },
  );

  const residual = findResidualDuplicates(events, {
    manualSplits: new Set(splits.map(s => pairKey(s.event_a_id, s.event_b_id))),
  });

  const bySource = new Map<string, number>();
  for (const { a, b } of residual) {
    const k = [a.source_name, b.source_name].sort().join(' + ');
    bySource.set(k, (bySource.get(k) ?? 0) + 1);
  }

  console.log(`=== Dedup-Audit ===`);
  console.log(`  Sichtbare Events ab heute: ${events.length}`);
  console.log(`  Offensichtliche Restdubletten: ${residual.length} (Grenze ${MAX_RESIDUAL})`);
  for (const [k, n] of [...bySource.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10)) {
    console.log(`    ${String(n).padStart(5)}  ${k}`);
  }
  for (const { a, b } of residual.slice(0, SAMPLES)) {
    console.log(`    ${toViennaIso(new Date(a.start_date)).slice(0, 16)}  [${a.source_name}] ${a.title.slice(0, 50)}  |  [${b.source_name}] ${b.title.slice(0, 50)}  (${a.id.slice(0, 8)} / ${b.id.slice(0, 8)})`);
  }

  if (residual.length > MAX_RESIDUAL) {
    console.log(`\n!!! ALARM: ${residual.length} Restdubletten > ${MAX_RESIDUAL}. Lief der Dedup? Neue Quelle oder Statusvariante?`);
    reportStepReason(`${residual.length} sichtbare Restdubletten > Grenze ${MAX_RESIDUAL}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
