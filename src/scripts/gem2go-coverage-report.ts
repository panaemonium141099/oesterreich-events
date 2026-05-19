/**
 * Auditable gem2go coverage report.
 *
 * Pulls N random gem2go future events where address IS NULL, runs the
 * detail-page extractor against each, and writes a CSV + a JSON report
 * showing per-URL: which fields the extractor filled, which were left
 * empty, and a short visible-text snippet so a human can verify whether
 * the missing data was actually on the page or genuinely absent.
 *
 * Usage:
 *   npx tsx --env-file=.env.local src/scripts/gem2go-coverage-report.ts --limit=100
 *
 * Output files (in ./reports/):
 *   gem2go-coverage-<timestamp>.csv   — flat table for spreadsheet review
 *   gem2go-coverage-<timestamp>.json  — full record incl. page snippet
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { extractGem2goDetail, type DetailEnrichment } from '../lib/scrapers/gem2go-detail';

const FIELDS: Array<keyof DetailEnrichment> = [
  'description',
  'location_name',
  'address',
  'postal_code',
  'address_locality',
  'image_url',
  'price_text',
  'organizer',
];

function arg(name: string): string | undefined {
  const m = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!m) return undefined;
  return m.includes('=') ? m.split('=')[1] : 'true';
}

interface Row {
  url: string;
  title: string;
  filled: Record<string, string | null>;
  missing: string[];
  snippet: string;
  fetched: boolean;
  http_status?: number;
}

async function main() {
  const limit = parseInt(arg('limit') ?? '100', 10);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Fetching ${limit} random gem2go events with address IS NULL...`);
  const { data, error } = await sb
    .from('events')
    .select('id, title, source_url')
    .eq('source_name', 'gem2go')
    .gte('start_date', new Date().toISOString())
    .is('address', null)
    .not('source_url', 'is', null)
    .limit(limit * 3);
  if (error) throw new Error(error.message);

  const candidates = (data ?? []).filter((r) => !!r.source_url) as Array<{
    id: string;
    title: string;
    source_url: string;
  }>;
  // shuffle + cap
  const sample = candidates.sort(() => Math.random() - 0.5).slice(0, limit);
  console.log(`Got ${sample.length} candidates.\n`);

  const rows: Row[] = [];
  for (let i = 0; i < sample.length; i++) {
    const ev = sample[i];
    process.stdout.write(`[${i + 1}/${sample.length}] `);
    let html: string | null = null;
    let httpStatus: number | undefined;
    try {
      const res = await fetch(ev.source_url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-AT,de;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      });
      httpStatus = res.status;
      if (res.ok) html = await res.text();
    } catch {
      // network fail
    }

    if (!html) {
      console.log(`FETCH-FAIL (HTTP ${httpStatus ?? '?'}) ${ev.source_url}`);
      rows.push({
        url: ev.source_url,
        title: ev.title,
        filled: {},
        missing: [...FIELDS] as string[],
        snippet: '',
        fetched: false,
        http_status: httpStatus,
      });
      continue;
    }

    const out = extractGem2goDetail(html);
    const filled: Record<string, string | null> = {};
    const missing: string[] = [];
    for (const f of FIELDS) {
      const v = out[f];
      if (v === undefined || v === null) missing.push(f);
      else filled[f] = String(v).slice(0, 150);
    }

    // visible page text — what a human would see after the h1
    const idx = html.indexOf('</h1>');
    const visible = html
      .slice(idx >= 0 ? idx : 0, (idx >= 0 ? idx : 0) + 12000)
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);

    rows.push({
      url: ev.source_url,
      title: ev.title,
      filled,
      missing,
      snippet: visible,
      fetched: true,
      http_status: httpStatus,
    });
    console.log(`${Object.keys(filled).length}/${FIELDS.length} extracted — ${ev.title.slice(0, 60)}`);
  }

  // Write outputs
  mkdirSync('reports', { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = `reports/gem2go-coverage-${ts}.json`;
  const csvPath = `reports/gem2go-coverage-${ts}.csv`;

  writeFileSync(jsonPath, JSON.stringify(rows, null, 2));

  // CSV: url, title, missing_fields(pipe-separated), snippet
  const csv: string[] = ['url,title,filled_fields,missing_fields,snippet'];
  for (const r of rows) {
    const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
    csv.push([
      cell(r.url),
      cell(r.title),
      cell(Object.keys(r.filled).join('|')),
      cell(r.missing.join('|')),
      cell(r.snippet),
    ].join(','));
  }
  writeFileSync(csvPath, csv.join('\n'));

  // Summary
  const totals: Record<string, number> = {};
  for (const f of FIELDS) totals[f] = 0;
  const fetched = rows.filter((r) => r.fetched).length;
  for (const r of rows) for (const f of Object.keys(r.filled)) totals[f]++;
  console.log('\n─────── COVERAGE ───────');
  console.log(`Sample size: ${rows.length}, fetched: ${fetched}`);
  for (const f of FIELDS) {
    const pct = fetched > 0 ? ((totals[f] / fetched) * 100).toFixed(0) : '0';
    console.log(`  ${f.padEnd(20)} ${totals[f]}/${fetched}  (${pct}%)`);
  }
  console.log(`\nReports written:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${csvPath}`);
  console.log(`\nManuelle Prüfung: jede Zeile mit leeren Feldern hat einen 'snippet' — der zeigt was tatsächlich auf der Page steht. Falls dort doch Adresse/Preis/etc. zu sehen ist obwohl "missing" markiert: das ist mein Extractor-Bug.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
