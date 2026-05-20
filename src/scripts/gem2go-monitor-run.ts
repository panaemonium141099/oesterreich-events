/**
 * Monitored full gem2go run.
 *
 * Runs the production Gem2GoScraper.scrape() and writes a per-gemeinde CSV
 * `reports/gem2go-monitor-<ts>.csv` with status + event count. Does NOT write
 * to the events table — pure analysis run. The CSV is the input for the
 * follow-up "why is this gemeinde returning 0" investigation.
 *
 * Usage:
 *   npx tsx --env-file=.env.local src/scripts/gem2go-monitor-run.ts
 */

import { mkdirSync, appendFileSync } from 'node:fs';
import { Gem2GoScraper } from '../lib/scrapers/Gem2GoScraper';
import { GEM2GO_GEMEINDEN } from '../lib/scrapers/gemeinden/gem2goGemeinden';

mkdirSync('reports', { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const csvPath = `reports/gem2go-monitor-${ts}.csv`;
appendFileSync(csvPath, 'idx,name,website,event_count,status,ts\n');

// Intercept the scraper's log() so we capture every per-gemeinde line and
// classify it. Less invasive than rewriting the scraper itself.
const origLog = (Gem2GoScraper.prototype as unknown as { log: (m: string) => void }).log;
(Gem2GoScraper.prototype as unknown as { log: (m: string) => void }).log = function (msg: string) {
  origLog.call(this, msg);
  // Parse the structured log entries the scraper now emits
  // "[i/N] Name: K Events (gesamt: M)"      → success
  // "[i/N] Name: 0 Events"                  → empty
  // "[i/N] Name: FETCH-FAIL"                → fetch error
  // "[i/N] Name: KEIN GEM2GO Layout"        → wrong CMS
  // "[i/N] Name: FEHLER (...)"              → parser exception
  const m = msg.match(/^\[(\d+)\/(\d+)\]\s+(.+?):\s+(.+)$/);
  if (!m) return;
  const idx = parseInt(m[1], 10);
  const name = m[3];
  const tail = m[4];
  let status = 'unknown';
  let count = 0;
  if (/^\d+\s+Events/.test(tail)) {
    status = 'ok';
    count = parseInt(tail, 10);
  } else if (/^0\s+Events/.test(tail)) {
    status = 'empty';
  } else if (/FETCH-FAIL/.test(tail)) {
    status = 'fetch-fail';
  } else if (/KEIN GEM2GO/.test(tail)) {
    status = 'not-gem2go';
  } else if (/FEHLER/.test(tail)) {
    status = 'error';
  }
  const ge = GEM2GO_GEMEINDEN[idx - 1];
  const website = ge?.website?.replace(/"/g, '""') ?? '';
  const cleanName = name.replace(/"/g, '""');
  appendFileSync(
    csvPath,
    `${idx},"${cleanName}","${website}",${count},${status},${new Date().toISOString()}\n`,
  );
};

async function main() {
  const scraper = new Gem2GoScraper();
  const start = Date.now();
  const events = await scraper.scrape();
  const dur = Math.round((Date.now() - start) / 1000);
  console.log(`\n══════════════ MONITOR RUN COMPLETE ══════════════`);
  console.log(`Events collected: ${events.length}`);
  console.log(`Duration: ${Math.floor(dur / 60)}m ${dur % 60}s`);
  console.log(`Per-gemeinde CSV: ${csvPath}`);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
