/**
 * Dev-only test runner for the gem2go detail extractor.
 *
 * Modes:
 *   --mode=sample (default) — runs against 9 hand-picked URLs
 *   --mode=db --limit=50    — fetches N random gem2go events from the DB
 *                             where address IS NULL and runs the extractor
 *                             against them. Quotes per-field coverage.
 *
 * Usage:
 *   npx tsx --env-file=.env.local src/scripts/test-gem2go-detail.ts
 *   npx tsx --env-file=.env.local src/scripts/test-gem2go-detail.ts --mode=db --limit=50
 */
import { createClient } from '@supabase/supabase-js';

import { extractGem2goDetail, type DetailEnrichment } from '../lib/scrapers/gem2go-detail';

const URLS = [
  'http://www.mariastein.gv.at/system/web/veranstaltung.aspx?detailonr=226606298-266&menuonr=218751431&sprache=1',
  'http://www.gaubitsch.gv.at/Damenturngruppe_3',
  'https://www.schruns.at/Schruser_Sommermarkt_5',
  'http://www.neulengbach.gv.at/system/web/veranstaltung.aspx?detailonr=226809764-865&menuonr=218306168&sprache=1',
  'https://www.mellau.at/system/web/veranstaltung.aspx?detailonr=225443923-2761&menuonr=224947918&sprache=1',
  'http://www.hollenthon.at/Silofolienentsorgung_4',
  'http://www.lilienfeld.gv.at/Rundwanderung_in_Hohenberg_der_Naturfreunde_Lilienfeld_1',
  'http://www.bad-grosspertholz.gv.at/Buechereikaffee_Bastel-_und_Plaudernachmittag_',
  'https://www.niederndorferberg.gv.at/system/web/veranstaltung.aspx?detailonr=226669271-218&menuonr=218823130&sprache=1',
];

const FIELDS = [
  'description',
  'location_name',
  'address',
  'postal_code',
  'address_locality',
  'image_url',
  'price_text',
  'price_min',
  'organizer',
] as const;

async function fetchOne(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function summarize(value: unknown, maxLen = 80): string {
  if (value === undefined || value === null) return '—';
  const s = String(value);
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

function arg(name: string): string | undefined {
  const found = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!found) return undefined;
  return found.includes('=') ? found.split('=')[1] : 'true';
}

async function dbUrls(limit: number): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('events')
    .select('source_url')
    .eq('source_name', 'gem2go')
    .gte('start_date', new Date().toISOString())
    .is('address', null)
    .not('source_url', 'is', null)
    .limit(limit * 4);
  if (error) throw new Error(error.message);
  if (!data) return [];
  const urls = data.map((r) => r.source_url as string).filter(Boolean);
  // Random shuffle + cap
  return urls.sort(() => Math.random() - 0.5).slice(0, limit);
}

async function runUrls(urls: string[], verbose: boolean) {
  const counts: Record<string, number> = {};
  for (const f of FIELDS) counts[f] = 0;
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const host = new URL(url).host;
    const html = await fetchOne(url);
    if (!html) {
      failed++;
      if (verbose) console.log(`[${i + 1}/${urls.length}] ${host}: FETCH-FAIL`);
      continue;
    }
    fetched++;
    const out: DetailEnrichment = extractGem2goDetail(html);
    const found = FIELDS.filter((f) => out[f] !== undefined);
    for (const f of found) counts[f]++;
    if (verbose) {
      console.log(`[${i + 1}/${urls.length}] ${host}: ${found.length}/${FIELDS.length}`);
      for (const f of found) console.log(`   ${f}: ${summarize(out[f], 80)}`);
    } else {
      process.stdout.write(found.length >= 6 ? '✓' : found.length >= 3 ? '·' : 'x');
      if ((i + 1) % 50 === 0) process.stdout.write('\n');
    }
  }
  if (!verbose) console.log('');

  console.log('\n' + '─'.repeat(60));
  console.log(`Fetched ${fetched}/${urls.length} (failed: ${failed})`);
  console.log('Coverage über erfolgreich gefetchte URLs:');
  for (const f of FIELDS) {
    const pct = fetched > 0 ? ((counts[f] / fetched) * 100).toFixed(0) : '0';
    console.log(`  ${f.padEnd(20)} ${counts[f]}/${fetched}  (${pct}%)`);
  }
}

async function main() {
  const mode = arg('mode') ?? 'sample';
  const limit = parseInt(arg('limit') ?? '50', 10);
  const verbose = !!arg('verbose');

  let urls: string[];
  if (mode === 'db') {
    console.log(`Loading ${limit} random gem2go events from DB (address IS NULL, future)...`);
    urls = await dbUrls(limit);
    console.log(`Got ${urls.length} URLs.\n`);
  } else {
    urls = URLS;
    console.log('Sample mode — 9 hand-picked URLs\n');
  }

  await runUrls(urls, verbose);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
