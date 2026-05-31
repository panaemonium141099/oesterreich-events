// Final-verification probe: low concurrency, generous pause, browser UA + Referer.
// Reads slugs from argv[2], writes JSONL to argv[3]. Resumable.
import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';

const API_BASE = 'https://webapi.deskline.net';
const DW_SOURCE = 'desklineweb';
const CONCURRENCY = 3;
const TIMEOUT_MS = 10000;
const PAUSE_MS = 700;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function sessId() { return `L${Date.now()}`; }

async function probe(slug) {
  const url = `${API_BASE}/${slug}/de/events?fields=id&pageNo=0&pageSize=1`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'DW-Source': DW_SOURCE,
        'DW-SessionId': sessId(),
        'User-Agent': UA,
        'Referer': 'https://www.burgenland.info/',
      },
      signal: ctrl.signal,
    });
    if (r.status === 403) return { slug, status: 403, total: null, ok: false, reason: 'waf' };
    if (!r.ok) return { slug, status: r.status, total: null, ok: false };
    const j = await r.json();
    const total = j?.paging?.totalRecordCount;
    if (typeof total !== 'number') return { slug, status: r.status, total: null, ok: false, reason: 'no-paging' };
    return { slug, status: r.status, total, ok: true };
  } catch (e) {
    return { slug, status: 0, total: null, ok: false, reason: e?.name === 'AbortError' ? 'timeout' : (e?.message || String(e)) };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const inFile = process.argv[2];
  const outFile = process.argv[3];
  const all = readFileSync(inFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const uniq = [...new Set(all)];
  const done = new Set();
  if (existsSync(outFile)) {
    for (const line of readFileSync(outFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        // Skip re-probe only if it was successful previously
        if (r.ok && r.total >= 1) done.add(r.slug);
      } catch {}
    }
  } else {
    writeFileSync(outFile, '');
  }
  const todo = uniq.filter(s => !done.has(s));
  console.error(`[final] ${uniq.length} unique, ${done.size} confirmed-done, ${todo.length} to probe`);
  let wafHits = 0;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const chunk = todo.slice(i, i + CONCURRENCY);
    const out = await Promise.all(chunk.map(probe));
    appendFileSync(outFile, out.map(r => JSON.stringify(r)).join('\n') + '\n');
    wafHits += out.filter(r => r.reason === 'waf').length;
    process.stderr.write(`\r[final] ${i + chunk.length}/${todo.length}  waf=${wafHits}     `);
    // If too many WAF hits in a row, back off harder
    if (out.every(r => r.reason === 'waf')) {
      process.stderr.write('\n[final] WAF burst detected, sleeping 30s...\n');
      await new Promise(r => setTimeout(r, 30000));
    } else {
      await new Promise(r => setTimeout(r, PAUSE_MS));
    }
  }
  process.stderr.write('\n[final] done\n');
}
main().catch(e => { console.error(e); process.exit(1); });
