/**
 * Same monitored run as gem2go-monitor-run.ts but limited to the first N
 * gemeinden so we can iterate fast on fallback patterns without waiting for
 * a 3-hour full run.
 */
import { mkdirSync, appendFileSync } from 'node:fs';
import { Gem2GoScraper } from '../lib/scrapers/Gem2GoScraper';
import { GEM2GO_GEMEINDEN } from '../lib/scrapers/gemeinden/gem2goGemeinden';

const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '100', 10);

mkdirSync('reports', { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const csvPath = `reports/gem2go-sample-${ts}.csv`;
appendFileSync(csvPath, 'idx,name,website,event_count,status,via,ts\n');

const origLog = (Gem2GoScraper.prototype as unknown as { log: (m: string) => void }).log;
(Gem2GoScraper.prototype as unknown as { log: (m: string) => void }).log = function (msg: string) {
  origLog.call(this, msg);
  const m = msg.match(/^\[(\d+)\/(\d+)\]\s+(.+?):\s+(.+)$/);
  if (!m) return;
  const idx = parseInt(m[1], 10);
  const name = m[3];
  const tail = m[4];
  let status = 'unknown';
  let count = 0;
  let via = 'gem2go';
  if (/FALLBACK/.test(tail)) {
    status = 'ok';
    count = parseInt(tail, 10);
    via = 'fallback';
  } else if (/Fallback\s+URL\s+gefunden.+0\s+events/.test(tail)) {
    status = 'fallback-empty';
    via = 'fallback';
  } else if (/^\d+\s+Events.*gesamt/.test(tail) && !/^0\s+Events/.test(tail)) {
    status = 'ok';
    count = parseInt(tail, 10);
    via = 'gem2go';
  } else if (/^0\s+Events/.test(tail)) {
    status = 'empty';
  } else if (/FETCH-FAIL/.test(tail)) {
    status = 'fetch-fail';
  } else if (/KEIN GEM2GO/.test(tail)) {
    status = 'not-gem2go';
  } else if (/FEHLER|Fallback-Exception/.test(tail)) {
    status = 'error';
  }
  const ge = GEM2GO_GEMEINDEN[idx - 1];
  const website = ge?.website?.replace(/"/g, '""') ?? '';
  const cleanName = name.replace(/"/g, '""');
  appendFileSync(
    csvPath,
    `${idx},"${cleanName}","${website}",${count},${status},${via},${new Date().toISOString()}\n`,
  );
};

async function main() {
  const original = [...GEM2GO_GEMEINDEN];
  GEM2GO_GEMEINDEN.length = 0;
  GEM2GO_GEMEINDEN.push(...original.slice(0, LIMIT));
  try {
    const scraper = new Gem2GoScraper();
    const start = Date.now();
    const events = await scraper.scrape();
    const dur = Math.round((Date.now() - start) / 1000);
    console.log(`\nSAMPLE RUN COMPLETE — ${events.length} events in ${Math.floor(dur / 60)}m ${dur % 60}s`);
    console.log(`CSV: ${csvPath}`);
  } finally {
    GEM2GO_GEMEINDEN.length = 0;
    GEM2GO_GEMEINDEN.push(...original);
  }
}
main().catch((err) => { console.error(err); process.exit(1); });
