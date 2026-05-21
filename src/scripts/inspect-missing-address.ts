// Read-only inspection: which scrapers produce events without address?
// Run: npx tsx --env-file=.env.local src/scripts/inspect-missing-address.ts
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const today = new Date().toISOString().slice(0, 10);

async function main() {
  // Quick auth test
  const { count: probe, error: probeErr } = await sb.from('events').select('id', { count: 'exact', head: true });
  if (probeErr) { console.error('PROBE FAILED:', JSON.stringify(probeErr)); process.exit(1); }
  console.log(`Events table total rows: ${probe}`);

  // Future, published-ish events
  const baseFilter = (q: ReturnType<typeof sb.from>) =>
    q.gte('start_date', today).in('publish_status', ['published', 'published_low_confidence', 'draft', 'needs_review']);

  // 1) Overview
  console.log('\n=== OVERVIEW (future, published-ish) ===');
  const t = await baseFilter(sb.from('events').select('id', { count: 'exact', head: true }));
  if (t.error) { console.error('TOTAL ERR', JSON.stringify(t.error)); process.exit(1); }
  const total = t.count ?? 0;
  console.log(`Total: ${total}`);

  const metrics = [
    ['noAddress', 'address.is.null'],
    ['noPostalCode', 'postal_code.is.null'],
    ['noCoords', 'latitude.is.null,longitude.is.null'],
    ['noLocationName', 'location_name.is.null'],
    ['noDescription', 'description.is.null'],
    ['noPriceText', 'price_text.is.null'],
  ] as const;
  for (const [name, expr] of metrics) {
    const r = await baseFilter(sb.from('events').select('id', { count: 'exact', head: true }).or(expr));
    const n = r.count ?? 0;
    console.log(`${name.padEnd(20)} ${String(n).padStart(7)}  (${total ? ((n/total)*100).toFixed(1) : '0'}%)`);
  }

  // 2) Distinct source names from the future-events slice
  console.log('\nFetching distinct source_names...');
  const sources = new Set<string>();
  let from = 0;
  while (true) {
    const r = await baseFilter(sb.from('events').select('source_name')).range(from, from + 999);
    if (r.error) { console.error('SRC ERR', JSON.stringify(r.error)); break; }
    if (!r.data || r.data.length === 0) break;
    for (const row of r.data) if (row.source_name) sources.add(row.source_name);
    if (r.data.length < 1000) break;
    from += 1000;
  }
  console.log(`Found ${sources.size} distinct sources.`);

  // 3) Per-source counts
  type Row = { src: string; total: number; noAddr: number; noPLZ: number; noGeo: number; noDesc: number; noPrice: number; noLoc: number };
  const rows: Row[] = [];
  let idx = 0;
  for (const src of sources) {
    idx++;
    if (idx % 20 === 0) console.log(`  ...${idx}/${sources.size}`);
    const tc = await baseFilter(sb.from('events').select('id', { count: 'exact', head: true }).eq('source_name', src));
    const ac = await baseFilter(sb.from('events').select('id', { count: 'exact', head: true }).eq('source_name', src).is('address', null));
    const pc = await baseFilter(sb.from('events').select('id', { count: 'exact', head: true }).eq('source_name', src).is('postal_code', null));
    const gc = await baseFilter(sb.from('events').select('id', { count: 'exact', head: true }).eq('source_name', src).or('latitude.is.null,longitude.is.null'));
    const dc = await baseFilter(sb.from('events').select('id', { count: 'exact', head: true }).eq('source_name', src).is('description', null));
    const prc = await baseFilter(sb.from('events').select('id', { count: 'exact', head: true }).eq('source_name', src).is('price_text', null));
    const lc = await baseFilter(sb.from('events').select('id', { count: 'exact', head: true }).eq('source_name', src).is('location_name', null));
    rows.push({
      src,
      total: tc.count ?? 0,
      noAddr: ac.count ?? 0,
      noPLZ: pc.count ?? 0,
      noGeo: gc.count ?? 0,
      noDesc: dc.count ?? 0,
      noPrice: prc.count ?? 0,
      noLoc: lc.count ?? 0,
    });
  }

  rows.sort((x, y) => y.noAddr - x.noAddr);

  console.log('\n=== FULL QUALITY MATRIX (sorted by missing-address absolute count) ===');
  console.log(
    'source_name'.padEnd(38) +
    'total'.padEnd(7) +
    'noAddr'.padEnd(8) +
    '%addr'.padEnd(7) +
    'noPLZ'.padEnd(8) +
    'noGeo'.padEnd(8) +
    'noDesc'.padEnd(8) +
    'noPrice'.padEnd(9) +
    'noLoc'
  );
  for (const r of rows) {
    const ap = r.total > 0 ? `${Math.round((r.noAddr/r.total)*100)}%` : '-';
    console.log(
      r.src.slice(0, 37).padEnd(38) +
      String(r.total).padEnd(7) +
      String(r.noAddr).padEnd(8) +
      ap.padEnd(7) +
      String(r.noPLZ).padEnd(8) +
      String(r.noGeo).padEnd(8) +
      String(r.noDesc).padEnd(8) +
      String(r.noPrice).padEnd(9) +
      String(r.noLoc)
    );
  }

  // 4) Sample URLs for top-5 worst (absolute)
  console.log('\n=== SAMPLE URLs (top-5 worst, 5 events each) ===');
  for (const r of rows.slice(0, 5)) {
    if (r.noAddr === 0) continue;
    const { data } = await baseFilter(
      sb.from('events').select('id,title,location_name,address,postal_code,source_url').eq('source_name', r.src).is('address', null)
    ).limit(5);
    console.log(`\n--- ${r.src} (${r.noAddr}/${r.total} missing) ---`);
    for (const e of (data ?? [])) {
      const ttl = (e.title ?? '').slice(0, 55);
      console.log(`  "${ttl}" | loc=${e.location_name ?? '∅'} plz=${e.postal_code ?? '∅'}`);
      console.log(`    → ${e.source_url}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
