/**
 * 10k-event coverage harness.
 *
 * Pulls N random events with source_url across ALL sources, fetches each
 * detail page, runs the universal extractor (extractGem2goDetail), and writes
 * a row per event to a CSV. Concurrency: 8 parallel fetches, delay throttled.
 *
 * Output CSV columns:
 *   idx, source_name, url, http_status, fetched_bytes,
 *   got_description, got_address, got_postal_code, got_image, got_price, got_organizer, got_location_name,
 *   addr_has_number, snippet_preview
 *
 * Usage:
 *   npx tsx --env-file=.env.local src/scripts/10k-coverage-test.ts --limit=10000 --concurrency=8
 */
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { extractGem2goDetail } from '../lib/scrapers/gem2go-detail';

function arg(name: string): string | undefined {
  const m = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!m) return undefined;
  return m.includes('=') ? m.split('=')[1] : 'true';
}

const LIMIT = parseInt(arg('limit') ?? '10000', 10);
const CONCURRENCY = parseInt(arg('concurrency') ?? '8', 10);
const TIMEOUT_MS = parseInt(arg('timeout') ?? '12000', 10);

mkdirSync('reports', { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const csvPath = `reports/10k-coverage-${ts}.csv`;
const summaryPath = `reports/10k-coverage-${ts}.summary.json`;
appendFileSync(
  csvPath,
  'idx,source_name,url,http_status,fetched_bytes,got_description,got_address,got_postal_code,got_image,got_price,got_organizer,got_location_name,addr_has_number,title_short,snippet\n',
);

async function fetchOne(url: string): Promise<{ status: number; html?: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-AT,de;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) return { status: res.status };
    return { status: res.status, html: await res.text() };
  } catch {
    return { status: 0 };
  }
}

interface Event {
  id: string;
  source_name: string;
  source_url: string;
  title: string;
}

async function processOne(idx: number, ev: Event, totalCounts: Record<string, number>): Promise<void> {
  const cell = (s: string) => `"${s.replace(/"/g, '""').replace(/\n/g, ' ').slice(0, 200)}"`;
  const result = await fetchOne(ev.source_url);
  if (!result.html) {
    appendFileSync(
      csvPath,
      `${idx},${cell(ev.source_name)},${cell(ev.source_url)},${result.status},0,0,0,0,0,0,0,0,0,${cell(ev.title)},""\n`,
    );
    totalCounts.fetch_fail = (totalCounts.fetch_fail ?? 0) + 1;
    return;
  }

  const out = extractGem2goDetail(result.html);
  const got = {
    desc: out.description ? 1 : 0,
    addr: out.address ? 1 : 0,
    plz: out.postal_code ? 1 : 0,
    img: out.image_url ? 1 : 0,
    price: out.price_text ? 1 : 0,
    org: out.organizer ? 1 : 0,
    loc: out.location_name ? 1 : 0,
  };
  // Heuristic: does extracted address actually contain a house number?
  const addrHasNumber = out.address && /\d/.test(out.address) ? 1 : 0;
  totalCounts.ok = (totalCounts.ok ?? 0) + 1;
  for (const [k, v] of Object.entries(got)) {
    totalCounts[`got_${k}`] = (totalCounts[`got_${k}`] ?? 0) + v;
  }
  totalCounts[`src_${ev.source_name}_ok`] = (totalCounts[`src_${ev.source_name}_ok`] ?? 0) + 1;
  const snippet = result.html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  appendFileSync(
    csvPath,
    `${idx},${cell(ev.source_name)},${cell(ev.source_url)},${result.status},${result.html.length},${got.desc},${got.addr},${got.plz},${got.img},${got.price},${got.org},${got.loc},${addrHasNumber},${cell(ev.title)},${cell(snippet)}\n`,
  );
}

async function runBatch(events: Event[], startIdx: number, totalCounts: Record<string, number>): Promise<void> {
  await Promise.all(
    events.map((ev, i) => processOne(startIdx + i, ev, totalCounts)),
  );
}

async function main() {
  console.log(`10k coverage test — limit=${LIMIT} concurrency=${CONCURRENCY}`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  console.log(`Querying ${LIMIT} random events with source_url...`);
  const { data, error } = await sb
    .from('events')
    .select('id, source_name, source_url, title')
    .not('source_url', 'is', null)
    .gte('start_date', new Date().toISOString())
    .in('publish_status', ['published', 'published_low_confidence', 'draft'])
    .limit(LIMIT * 2);
  if (error) throw new Error(error.message);
  const events = (data ?? [])
    .filter((e): e is Event => !!e.source_url && !!e.source_name)
    .sort(() => Math.random() - 0.5)
    .slice(0, LIMIT);
  console.log(`Got ${events.length} events. Starting at ${new Date().toISOString()}`);

  const totalCounts: Record<string, number> = {};
  const start = Date.now();
  // Process in chunks for memory + so we can print progress
  const CHUNK = CONCURRENCY * 5;
  for (let i = 0; i < events.length; i += CHUNK) {
    const slice = events.slice(i, i + CHUNK);
    const subChunks: Event[][] = [];
    for (let j = 0; j < slice.length; j += CONCURRENCY) {
      subChunks.push(slice.slice(j, j + CONCURRENCY));
    }
    for (let j = 0; j < subChunks.length; j++) {
      await runBatch(subChunks[j], i + j * CONCURRENCY, totalCounts);
    }
    const done = i + slice.length;
    const elapsed = Math.round((Date.now() - start) / 1000);
    const rate = done / Math.max(elapsed, 1);
    const eta = Math.round((events.length - done) / rate);
    if (done % 100 === 0 || done === events.length) {
      console.log(
        `  [${done}/${events.length}] ${elapsed}s elapsed, ${rate.toFixed(1)}/s, ETA ${eta}s — ok=${totalCounts.ok ?? 0} fail=${totalCounts.fetch_fail ?? 0}`,
      );
    }
  }

  const dur = Math.round((Date.now() - start) / 1000);
  console.log(`\nCOMPLETE: ${events.length} events in ${Math.floor(dur / 60)}m ${dur % 60}s`);
  const summary: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    sample_size: events.length,
    duration_s: dur,
    csv: csvPath,
    counts: totalCounts,
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Summary: ${summaryPath}`);
  console.log(`CSV: ${csvPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
