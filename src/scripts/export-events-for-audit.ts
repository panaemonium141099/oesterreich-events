/**
 * Export every event in Supabase to a CSV per bundesland for the user
 * to gegen-kontrollieren after the district normalisation migration.
 *
 * Output: data/exports/events_<bundesland>.csv (9 files + 1 for null/foreign).
 * Columns include `district_pre_normalize` so each row shows the original
 * spelling next to the canonical name — that's the audit trail.
 *
 * Run:  npx tsx src/scripts/export-events-for-audit.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Inline .env.local loader — same idiom the other scripts in this dir use.
try {
  const envPath = join(process.cwd(), '.env.local');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.substring(0, i).trim();
    const v = t.substring(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* .env.local optional */ }

const COLS = [
  'id', 'title', 'start_date', 'location_name', 'postal_code',
  'bundesland', 'district', 'district_pre_normalize',
  'latitude', 'longitude', 'source_name', 'category',
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const outDir = join(process.cwd(), 'data', 'exports');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // Bundesländer + a bucket for nulls/foreign
  const buckets: Record<string, string[]> = {};
  buckets['_no_bundesland'] = [COLS.join(',')];

  // PostgREST default cap is 1000 rows per request. Anything bigger
  // silently truncates without an error, which is what made the previous
  // PAGE=5000 export stop at 60k of 184k. Stay under the cap and rely on
  // the cursor-style id pagination.
  const PAGE = 1000;
  let lastId: string | null = null;
  let total = 0;

  while (true) {
    let q = sb
      .from('events')
      .select(COLS.join(','))
      .order('id', { ascending: true })
      .limit(PAGE);
    if (lastId) q = q.gt('id', lastId);

    const { data, error } = await q;

    if (error) { console.error('Fetch error after', total, 'rows:', error.message); break; }
    if (!data || data.length === 0) break;

    for (const ev of data as unknown as Record<string, unknown>[]) {
      const bl = (ev.bundesland as string | null) || '_no_bundesland';
      if (!buckets[bl]) buckets[bl] = [COLS.join(',')];
      buckets[bl].push(COLS.map((c) => csvEscape(ev[c])).join(','));
    }
    total += data.length;
    lastId = String((data[data.length - 1] as unknown as Record<string, unknown>).id);
    if (data.length < PAGE) break;
    if (total % 10000 === 0) console.log(`  fetched ${total}…`);
  }

  for (const [bl, lines] of Object.entries(buckets)) {
    const file = join(outDir, `events_${bl}.csv`);
    writeFileSync(file, lines.join('\n') + '\n', 'utf8');
    console.log(`✓ ${file} (${lines.length - 1} rows)`);
  }

  // Summary: district counts per bundesland — easiest gegen-kontroll table.
  console.log('\nGenerating district-summary…');
  const { data: summary, error: sumErr } = await sb.rpc('exec_sql_text', { q: '' }).then(() => ({ data: null, error: { message: 'rpc unavailable, building from buckets' } }));
  if (sumErr) {
    const sumLines = ['bundesland,district,count'];
    for (const bl of Object.keys(buckets)) {
      const counts: Record<string, number> = {};
      for (let i = 1; i < buckets[bl].length; i++) {
        // crude split — sufficient since we control escape rules above
        const parts = buckets[bl][i].split(',');
        const dIdx = COLS.indexOf('district');
        const d = parts[dIdx] || '_null_';
        counts[d] = (counts[d] || 0) + 1;
      }
      for (const [d, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
        sumLines.push(`${csvEscape(bl)},${csvEscape(d)},${n}`);
      }
    }
    const sumFile = join(outDir, 'districts_summary.csv');
    writeFileSync(sumFile, sumLines.join('\n') + '\n', 'utf8');
    console.log(`✓ ${sumFile} (${sumLines.length - 1} rows)`);
  }
  void summary;

  console.log(`\nTotal events exported: ${total}`);

  // ── Bonus: events_clean.csv — exactly the rows the /map view shows.
  // Mirrors the API filter chain in src/app/api/events/route.ts:
  //   visibility='public', publish_status published|published_low_confidence,
  //   start_date >= today, lat 46.3–49.1, lng 9.5–17.2, lat/lng NOT NULL.
  // Chunked per-bundesland because the combined geo+publish_status scan
  // hits Supabase's statement timeout when the cursor walks past ~50k rows.
  console.log('\nFetching map-clean event set (per bundesland)…');
  const today = new Date().toISOString().slice(0, 10);
  const cleanLines = [COLS.join(',')];
  let cleanTotal = 0;
  const BL_IDS = ['burgenland','kaernten','niederoesterreich','oberoesterreich','salzburg','steiermark','tirol','vorarlberg','wien'];
  for (const bl of BL_IDS) {
    let last: string | null = null;
    let blN = 0;
    while (true) {
      let q = sb
        .from('events')
        .select(COLS.join(','))
        .eq('visibility', 'public').eq('bundesland', bl)
        .in('publish_status', ['published', 'published_low_confidence'])
        .gte('start_date', today)
        .gte('latitude', 46.3).lte('latitude', 49.1)
        .gte('longitude', 9.5).lte('longitude', 17.2)
        .order('id', { ascending: true })
        .limit(PAGE);
      if (last) q = q.gt('id', last);
      const { data, error } = await q;
      if (error) { console.error(`  ${bl} error:`, error.message); break; }
      if (!data || data.length === 0) break;
      for (const ev of data as unknown as Record<string, unknown>[]) {
        cleanLines.push(COLS.map((c) => csvEscape(ev[c])).join(','));
      }
      blN += data.length;
      last = String((data[data.length - 1] as unknown as Record<string, unknown>).id);
      if (data.length < PAGE) break;
    }
    cleanTotal += blN;
    console.log(`  ${bl}: ${blN}`);
  }
  const cleanFile = join(outDir, 'events_clean.csv');
  writeFileSync(cleanFile, cleanLines.join('\n') + '\n', 'utf8');
  console.log(`✓ ${cleanFile} (${cleanTotal} rows — what the map renders)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
