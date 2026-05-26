// src/scripts/probe-feratel.ts
//
// Discovery-CLI for Feratel/Deskline TOSC5 region codes.
//
// Why: There is no public list of TVB codes — Feratel hands them out privately
// to each customer. To grow our REGIONS list in FeratelScraper.ts we have to
// probe candidate slugs against webapi.deskline.net and keep the ones that
// return HTTP 200 with a paging block.
//
// Two modes:
//   --candidates <file>   Probe a newline-separated file of candidate slugs
//   --candidates -        Read from stdin
//   (no flag)             Probe a built-in seed list of common AT TVB names
//
// Output: prints `slug -> totalRecordCount` for each working code, plus a
// summary. Pipe to a file and you have a paste-ready snippet for FeratelScraper.
//
// Run:
//   npx tsx src/scripts/probe-feratel.ts
//   npx tsx src/scripts/probe-feratel.ts --candidates ./tvb-candidates.txt
//   echo -e "bregenzerwald\nmontafon" | npx tsx src/scripts/probe-feratel.ts --candidates -

import { readFileSync } from 'fs';

const API_BASE = 'https://webapi.deskline.net';
const DW_SOURCE = 'desklineweb';

// Seed list: ~100 known/guessable AT TVB names. Mix of:
//   • Bundesland-level dachverband attempts
//   • Touristic regions (Waldviertel, Bregenzerwald, ...)
//   • Bezirksstädte (Eisenstadt, Bregenz, Krems, ...)
//   • Ski resorts / valleys
//   • Common gemeinde names that often have own TVBs
const SEED_CANDIDATES = [
  // Bundesland attempts
  'niederoesterreich', 'oberoesterreich', 'tirol', 'steiermark', 'vorarlberg', 'wien', 'salzburg',
  // NÖ / Wachau region
  'waldviertel', 'wachau', 'weinviertel', 'mostviertel', 'wieneralpen', 'kremsdonau',
  'wienerwald', 'roemerland', 'donau', 'donauniederoesterreich',
  // Vorarlberg
  'bregenzerwald', 'montafon', 'kleinwalsertal', 'bodensee', 'silvretta', 'bregenz',
  'dornbirn', 'feldkirch', 'bludenz', 'schruns', 'gaschurn', 'gargellen',
  'lechtal-vlbg', 'arlberg-vlbg',
  // Tirol — Skigebiete
  'saalbach', 'saalbachhinterglemm', 'leogang', 'fieberbrunn', 'soelden', 'obergurgl',
  'hochgurgl', 'skiwelt', 'wilderkaiser', 'kitzbuehel', 'westendorf', 'soell',
  'scheffau', 'ellmau', 'going', 'hopfgarten', 'brixen-im-thale', 'itter',
  'jochberg', 'fuegen', 'finkenberg', 'gerlos', 'tux', 'hintertux', 'achensee',
  'pertisau', 'walchsee', 'koessen', 'niederndorf', 'alpbach', 'reith',
  'mieming', 'nassereith', 'stams', 'nauders', 'kaunertal', 'pfunds',
  'st-anton', 'paznauntal',
  // Salzburg
  'pinzgau', 'pongau', 'lammertal', 'saalfelden', 'mariapfarr', 'mauterndorf',
  'rauris', 'taxenbach', 'salzburgcity', 'fuschl', 'mondsee',
  // Steiermark
  'schladming', 'schladmingdachstein', 'hochsteiermark', 'mariazell', 'mariazellerland',
  'murtal', 'murau', 'graz', 'weiz', 'hartberg', 'leoben', 'liezen',
  'ennstal', 'rax-schneeberg', 'semmering',
  // OÖ
  'attersee', 'mondsee-attersee', 'traunsee', 'gosau', 'hallstatt', 'badischl',
  'gmunden', 'kremsmuenster', 'steyr', 'rohrbach',
  // Kärnten
  'millstaettersee', 'karawanken', 'gailtal', 'lavanttal',
  // Burgenland
  'neusiedlamsee', 'neusiedlersee', 'mattersburg', 'jennersdorf', 'guessing',
  'stegersbach', 'badtatzmannsdorf', 'bernstein', 'suedburgenland', 'nordburgenland',
];

interface ProbeResult {
  slug: string;
  status: number;
  totalRecordCount?: number;
  ok: boolean;
  errorReason?: string;
}

function sessId(): string {
  return `L${Date.now()}`;
}

async function probe(slug: string, signal?: AbortSignal): Promise<ProbeResult> {
  const url = `${API_BASE}/${slug}/de/events?fields=id&pageNo=0&pageSize=1`;
  try {
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'DW-Source': DW_SOURCE,
        'DW-SessionId': sessId(),
        'User-Agent': 'Mozilla/5.0 (compatible; osterreich-events-probe/1.0)',
      },
      signal,
    });
    if (!r.ok) return { slug, status: r.status, ok: false };
    const j = (await r.json()) as { paging?: { totalRecordCount?: number } };
    const total = j.paging?.totalRecordCount;
    if (typeof total !== 'number') {
      return { slug, status: r.status, ok: false, errorReason: 'no paging block' };
    }
    return { slug, status: r.status, totalRecordCount: total, ok: true };
  } catch (err) {
    return { slug, status: 0, ok: false, errorReason: err instanceof Error ? err.message : String(err) };
  }
}

async function probeBatch(slugs: string[], concurrency = 4): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (let i = 0; i < slugs.length; i += concurrency) {
    const chunk = slugs.slice(i, i + concurrency);
    const out = await Promise.all(chunk.map((s) => probe(s)));
    results.push(...out);
    // Mild rate-limit: tiny pause between chunks
    await new Promise((res) => setTimeout(res, 500));
  }
  return results;
}

function loadCandidates(): string[] {
  const idx = process.argv.indexOf('--candidates');
  if (idx === -1) return SEED_CANDIDATES;
  const src = process.argv[idx + 1];
  if (!src) throw new Error('--candidates expects a file path or "-" for stdin');
  let raw: string;
  if (src === '-') {
    raw = readFileSync(0, 'utf8'); // read stdin
  } else {
    raw = readFileSync(src, 'utf8');
  }
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
}

async function main() {
  const candidates = loadCandidates();
  console.log(`Probing ${candidates.length} slug candidates against ${API_BASE}...\n`);
  const results = await probeBatch(candidates, 4);

  const hits = results.filter((r) => r.ok && (r.totalRecordCount ?? 0) > 0);
  const empty = results.filter((r) => r.ok && (r.totalRecordCount ?? 0) === 0);

  console.log('=== HITS (≥1 event) ===');
  hits.sort((a, b) => (b.totalRecordCount ?? 0) - (a.totalRecordCount ?? 0));
  for (const r of hits) {
    console.log(`  ${r.slug.padEnd(28)} ${String(r.totalRecordCount).padStart(6)} events`);
  }

  if (empty.length) {
    console.log('\n=== Valid but empty (0 events) ===');
    for (const r of empty) console.log(`  ${r.slug}`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`  probed:  ${results.length}`);
  console.log(`  hits:    ${hits.length}`);
  console.log(`  empty:   ${empty.length}`);
  console.log(`  miss:    ${results.length - hits.length - empty.length}`);
  console.log(`  total events covered by hits: ${hits.reduce((s, r) => s + (r.totalRecordCount ?? 0), 0)}`);

  if (hits.length > 0) {
    console.log('\n=== Paste into FeratelScraper.ts REGIONS array ===');
    for (const r of hits) {
      console.log(`  { code: '${r.slug}', name: '${r.slug}', bundesland: 'TODO', fallbackLat: 47.5, fallbackLng: 13.5 },  // ${r.totalRecordCount} events`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
