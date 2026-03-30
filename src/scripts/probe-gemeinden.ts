/**
 * Phase 1: Probe all inactive municipalities for event pages.
 * Saves results to data/gemeinden-event-pages.json
 *
 * Run: npx tsx src/scripts/probe-gemeinden.ts
 */

import Database from 'better-sqlite3';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'data', 'events.db');
const OUTPUT_PATH = join(process.cwd(), 'data', 'gemeinden-event-pages.json');

const EVENT_PATHS = [
  '/veranstaltungen',
  '/termine',
  '/events',
  '/aktuelles/veranstaltungen',
  '/buergerservice/aktuelles/veranstaltungen',
  '/freizeit/veranstaltungen',
  '/kultur/veranstaltungen',
  '/freizeit-tourismus/veranstaltungen',
  '/gemeinde/veranstaltungen',
  '/leben/veranstaltungen',
  '/tourismus/veranstaltungen',
  '/buergerservice/termine',
  '/aktuelles/termine',
];

interface Gemeinde {
  name: string;
  website: string;
  plz: string;
  bezirk: string;
  bundesland: string;
  lat: number;
  lng: number;
}

interface ProbeResult {
  gemeinde: Gemeinde;
  eventPageUrl: string;
  path: string;
  dateCount: number;
  eventKeywords: number;
  htmlSize: number;
}

function parseGemeinden(): Gemeinde[] {
  const content = readFileSync(join(process.cwd(), 'src/lib/scrapers/gemeinden/gem2goGemeinden.ts'), 'utf8');
  const regex = /\{\s*name:\s*'([^']+)',\s*website:\s*'([^']+)',\s*plz:\s*'([^']+)',\s*bezirk:\s*'([^']+)',\s*bundesland:\s*'([^']+)',\s*lat:\s*([\d.]+),\s*lng:\s*([\d.]+)/g;
  const result: Gemeinde[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    result.push({ name: m[1], website: m[2], plz: m[3], bezirk: m[4], bundesland: m[5], lat: parseFloat(m[6]), lng: parseFloat(m[7]) });
  }
  return result;
}

function getActiveGem2GoDomains(): Set<string> {
  const db = new Database(DB_PATH);
  const active = new Set<string>();
  const rows = db.prepare("SELECT DISTINCT source_url FROM events WHERE source_name = 'gem2go'").all() as { source_url: string }[];
  for (const r of rows) {
    try { active.add(new URL(r.source_url).hostname.replace(/^www\./, '')); } catch {}
  }
  db.close();
  return active;
}

async function probeGemeinde(g: Gemeinde): Promise<ProbeResult | null> {
  const base = g.website.replace(/\/$/, '');

  for (const path of EVENT_PATHS) {
    try {
      const url = base + path;
      const r = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      });

      if (r.status !== 200) continue;

      const html = await r.text();
      const lower = html.toLowerCase();

      // Must have event-like content
      const dateCount = (html.match(/\d{1,2}\.\d{1,2}\.20\d{2}/g) || []).length;
      const eventKeywords = (lower.match(/veranstaltung|termin(?:e\b)|event(?:s\b)|kalender|datum|uhrzeit/g) || []).length;

      if (dateCount >= 2 || eventKeywords >= 3) {
        return {
          gemeinde: g,
          eventPageUrl: r.url,
          path,
          dateCount,
          eventKeywords,
          htmlSize: html.length,
        };
      }
    } catch {}
  }
  return null;
}

async function main() {
  const gemeinden = parseGemeinden();
  const activeDomains = getActiveGem2GoDomains();

  const inactive = gemeinden.filter(g => {
    try { return !activeDomains.has(new URL(g.website).hostname.replace(/^www\./, '')); } catch { return true; }
  });

  console.log(`Probing ${inactive.length} inactive municipalities for event pages...`);
  console.log(`(${activeDomains.size} already active via GEM2GO)\n`);

  const results: ProbeResult[] = [];
  let processed = 0;

  for (const g of inactive) {
    processed++;
    const result = await probeGemeinde(g);

    if (result) {
      results.push(result);
      console.log(`✓ [${processed}/${inactive.length}] ${g.name} → ${result.path} (${result.dateCount} dates, ${result.eventKeywords} keywords)`);
    } else if (processed % 50 === 0) {
      console.log(`  [${processed}/${inactive.length}] ... ${results.length} found so far`);
    }

    // Save intermediate results every 100
    if (processed % 100 === 0) {
      writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    }

    // Rate limit: 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }

  // Final save
  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

  console.log(`\n=== DONE ===`);
  console.log(`Found event pages: ${results.length}/${inactive.length} (${Math.round(results.length / inactive.length * 100)}%)`);
  console.log(`Results saved to: ${OUTPUT_PATH}`);

  // Summary by path
  const byPath: Record<string, number> = {};
  for (const r of results) {
    byPath[r.path] = (byPath[r.path] || 0) + 1;
  }
  console.log(`\nBy path:`);
  Object.entries(byPath).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // Summary by bundesland
  const byBL: Record<string, number> = {};
  for (const r of results) {
    byBL[r.gemeinde.bundesland] = (byBL[r.gemeinde.bundesland] || 0) + 1;
  }
  console.log(`\nBy Bundesland:`);
  Object.entries(byBL).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

main().catch(console.error);
