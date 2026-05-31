// WAF-resistant sweep: Conc 3, 600ms pause. Treats 429/WAF as retryable.
import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';

const API_BASE = 'https://webapi.deskline.net';
const CONCURRENCY = 3;
const TIMEOUT_MS = 8000;
const PAUSE_MS = 600;
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
        'DW-Source': 'desklineweb',
        'DW-SessionId': sessId(),
        'User-Agent': UA,
        'Referer': 'https://www.burgenland.info/',
      },
      signal: ctrl.signal,
    });
    if (r.status === 429) return { slug, status: 429, total: null, ok: false, reason: 'rate-limit' };
    if (r.status === 403) {
      const body = await r.text();
      const isWaf = body.includes('Access Denied') || body.length < 50;
      return { slug, status: 403, total: null, ok: false, reason: isWaf ? 'waf' : 'forbidden' };
    }
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
        // Don't skip rate-limit/WAF/timeout — retry those
        if (r.reason === 'rate-limit' || r.reason === 'waf' || r.reason === 'timeout') continue;
        done.add(r.slug);
      } catch {}
    }
  } else {
    writeFileSync(outFile, '');
  }
  const todo = uniq.filter(s => !done.has(s));
  console.error(`[sweep] ${uniq.length} unique, ${done.size} done, ${todo.length} to probe`);

  let consecutiveBlocks = 0;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const chunk = todo.slice(i, i + CONCURRENCY);
    const out = await Promise.all(chunk.map(probe));
    appendFileSync(outFile, out.map(r => JSON.stringify(r)).join('\n') + '\n');
    const hits = out.filter(r => r.ok && r.total > 0).length;
    const blocks = out.filter(r => r.reason === 'rate-limit' || r.reason === 'waf').length;
    process.stderr.write(`\r[sweep] ${i + chunk.length}/${todo.length}  hits+=${hits}  block+=${blocks}     `);

    if (blocks === chunk.length) {
      consecutiveBlocks++;
      const wait = Math.min(60000, 15000 * consecutiveBlocks);
      process.stderr.write(`\n[sweep] block burst ×${consecutiveBlocks} — sleep ${wait/1000}s\n`);
      await new Promise(r => setTimeout(r, wait));
    } else {
      consecutiveBlocks = 0;
      await new Promise(r => setTimeout(r, PAUSE_MS));
    }
  }
  process.stderr.write('\n[sweep] done\n');
}
main().catch(e => { console.error(e); process.exit(1); });
