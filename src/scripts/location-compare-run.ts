/**
 * Vergleichslauf (fn-25 Phase D1): neuer Resolver über den gespeicherten
 * Quellenstand, Ergebnis in einer SEPARATEN Tabelle, keine Änderung an den
 * öffentlichen Zeilen.
 *
 * Je Event: alter Wert, Quellwert, neue Entscheidung, Belege, Genauigkeit,
 * Konfliktgrund und vorgesehene Veröffentlichung. Zeilen ohne gesicherten
 * Quellenstand (kein raw_event_id / keine Rohspalten) werden NICHT aus dem
 * Altbestand „rekonstruiert" — sie stehen als `awaiting_rescrape` im
 * Ergebnis, bis die Quelle sie erneut geliefert hat.
 *
 * Ergebnis: Tabelle snap_20260913.d1_compare (per RPC nicht erreichbar,
 * nur psql) — hier über PostgREST in `public.location_compare_runs`
 * (Migration 20260914100000). Zusätzlich eine Zusammenfassung je Quelle
 * auf stdout und optional als Markdown (`--report <datei>`).
 *
 * Aufruf:
 *   npx tsx --env-file=.env.local src/scripts/location-compare-run.ts [--source Eventim] [--limit 5000] [--report docs/ops/x.md]
 */
import { writeFileSync } from 'fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadLocationEvidence } from '../lib/location/evidence';
import { resolveEventLocation } from '../lib/location/resolver';
import { inputFromStoredRow, STORED_LOCATION_COLUMNS, type StoredEventLocationRow } from '../lib/location/re-resolve';
import { gemeindenByName } from '../lib/location/gemeinde-index';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i !== -1 ? argv[i + 1] : undefined; };
const SOURCE = arg('--source');
const LIMIT = arg('--limit') ? parseInt(arg('--limit')!, 10) : Infinity;
const REPORT = arg('--report');
const RUN_ID = `d1-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;

type Klass =
  | 'awaiting_rescrape'
  | 'unchanged'
  | 'upgrade_precise'
  | 'downgrade_to_municipality'
  | 'downgrade_to_conflict'
  | 'position_moved'
  | 'name_restored'
  | 'status_only';

interface CompareRow extends StoredEventLocationRow {
  source_name: string;
  publish_status: string | null;
  start_date: string;
}

interface Result {
  run_id: string;
  event_id: string;
  source_name: string;
  has_raw: boolean;
  klass: Klass;
  old_status: string | null;
  new_status: string | null;
  old_name: string | null;
  new_name: string | null;
  raw_name: string | null;
  old_lat: number | null;
  old_lng: number | null;
  new_lat: number | null;
  new_lng: number | null;
  moved_km: number | null;
  precision: string | null;
  reasons: string[];
  evidence: string[];
  publish_old: string | null;
  publish_intent: string | null;
  legacy_place_name: boolean;
}

function km(a: number, b: number, c: number, d: number): number {
  const R = 6371, dLat = ((c - a) * Math.PI) / 180, dLng = ((d - b) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function fetchPage(sb: SupabaseClient, afterId: string | null): Promise<CompareRow[]> {
  let q = sb
    .from('events')
    .select(STORED_LOCATION_COLUMNS + ', source_name, publish_status, start_date, raw_event_id')
    .gte('start_date', new Date().toISOString())
    .in('publish_status', ['published', 'published_low_confidence', 'needs_review'])
    .order('id', { ascending: true })
    .limit(1000);
  if (SOURCE) q = q.eq('source_name', SOURCE);
  if (afterId) q = q.gt('id', afterId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CompareRow[];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase-Env fehlt');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const summary = new Map<string, Record<string, number>>();
  const bump = (src: string, k: string) => {
    const m = summary.get(src) ?? {};
    m[k] = (m[k] ?? 0) + 1;
    summary.set(src, m);
  };

  let after: string | null = null;
  let processed = 0;
  const samples: Result[] = [];
  while (processed < LIMIT) {
    const page = await fetchPage(sb, after);
    if (page.length === 0) break;
    after = page[page.length - 1].id;
    const withRaw = page.filter(r => (r as unknown as { raw_event_id: string | null }).raw_event_id || r.location_name_raw !== null || r.address_raw !== null || r.latitude_raw !== null);
    const inputs = withRaw.map(inputFromStoredRow);
    const evidence = withRaw.length > 0 ? await loadLocationEvidence(sb, inputs) : [];
    const rawIdx = new Map(withRaw.map((r, i) => [r.id, i]));
    const results: Result[] = [];
    for (const row of page) {
      const i = rawIdx.get(row.id);
      const legacyPlace = !!row.location_name && gemeindenByName(row.location_name).length > 0;
      if (i === undefined) {
        results.push({
          run_id: RUN_ID, event_id: row.id, source_name: row.source_name, has_raw: false, klass: 'awaiting_rescrape',
          old_status: row.location_status, new_status: null, old_name: row.location_name, new_name: null, raw_name: null,
          old_lat: row.latitude, old_lng: row.longitude, new_lat: null, new_lng: null, moved_km: null, precision: null,
          reasons: [], evidence: [], publish_old: row.publish_status, publish_intent: null, legacy_place_name: legacyPlace,
        });
        bump(row.source_name, 'awaiting_rescrape');
        continue;
      }
      const d = resolveEventLocation(inputs[i], evidence[i]);
      const oldPrecise = row.location_status === 'venue_confirmed' || row.location_status === 'address_confirmed';
      const newPrecise = d.status === 'venue_confirmed' || d.status === 'address_confirmed';
      const moved = row.latitude != null && d.latitude != null ? km(row.latitude, row.longitude!, d.latitude, d.longitude!) : null;
      const nameChanged = (row.location_name ?? null) !== (d.location_name ?? null);
      let klass: Klass = 'unchanged';
      if (d.status === 'conflict' && row.location_status !== 'conflict') klass = 'downgrade_to_conflict';
      else if (!newPrecise && oldPrecise) klass = 'downgrade_to_municipality';
      else if (newPrecise && !oldPrecise) klass = 'upgrade_precise';
      else if (moved != null && moved > 0.25) klass = 'position_moved';
      else if (nameChanged) klass = 'name_restored';
      else if (row.location_status !== d.status) klass = 'status_only';
      const publishIntent = d.status === 'conflict' ? 'needs_review' : row.publish_status;
      results.push({
        run_id: RUN_ID, event_id: row.id, source_name: row.source_name, has_raw: true, klass,
        old_status: row.location_status, new_status: d.status, old_name: row.location_name, new_name: d.location_name, raw_name: row.location_name_raw,
        old_lat: row.latitude, old_lng: row.longitude, new_lat: d.latitude, new_lng: d.longitude, moved_km: moved != null ? Math.round(moved * 10) / 10 : null,
        precision: d.precision, reasons: d.reasons, evidence: d.evidence, publish_old: row.publish_status, publish_intent: publishIntent, legacy_place_name: legacyPlace,
      });
      bump(row.source_name, klass);
      if (klass !== 'unchanged' && samples.length < 40) samples.push(results[results.length - 1]);
    }
    // Ergebnis in Batches sichern (separate Tabelle, keine öffentlichen Zeilen).
    for (let i = 0; i < results.length; i += 500) {
      const { error } = await sb.from('location_compare_runs').upsert(results.slice(i, i + 500), { onConflict: 'run_id,event_id' });
      if (error) console.error('[compare] upsert:', error.message);
    }
    processed += page.length;
    process.stdout.write(`\r[compare] ${processed} Events…`);
  }
  console.log(`\n[compare] Lauf ${RUN_ID}: ${processed} Events`);

  const lines: string[] = [];
  lines.push(`# Vergleichslauf ${RUN_ID}`, '', `Events: ${processed}${SOURCE ? ` (Quelle ${SOURCE})` : ''}`, '');
  lines.push('| Quelle | gesamt | ohne Quellenstand | unverändert | präziser | → Gemeinde | → Konflikt | Position verschoben | Name wiederhergestellt | nur Status |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  const order: Klass[] = ['awaiting_rescrape', 'unchanged', 'upgrade_precise', 'downgrade_to_municipality', 'downgrade_to_conflict', 'position_moved', 'name_restored', 'status_only'];
  const rows = [...summary.entries()].sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0));
  for (const [src, m] of rows) {
    const total = Object.values(m).reduce((x, y) => x + y, 0);
    lines.push(`| ${src} | ${total} | ${order.map(k => m[k] ?? 0).join(' | ')} |`);
  }
  lines.push('', '## Stichproben geänderter Entscheidungen', '');
  for (const s of samples) {
    lines.push(`- \`${s.event_id.slice(0, 8)}\` ${s.source_name} · ${s.klass}: ${s.old_status ?? '∅'} → ${s.new_status} · „${s.old_name ?? '∅'}" → „${s.new_name ?? '∅'}"${s.moved_km != null ? ` · ${s.moved_km} km` : ''} · ${s.reasons.join(', ')}`);
  }
  const text = lines.join('\n') + '\n';
  console.log(text);
  if (REPORT) { writeFileSync(REPORT, text); console.log(`Report → ${REPORT}`); }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
