import fs from 'fs';
import path from 'path';

// Parse CSV
const csvPath = path.resolve('data/uncovered-gemeinden-3000plus.csv');
const csvText = fs.readFileSync(csvPath, 'utf-8');
const lines = csvText.trim().split('\n');
const header = lines[0].split(',');
const rows = lines.slice(1, 63).map(line => {
  // Handle CSV with commas in quoted fields
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { parts.push(current); current = ''; continue; }
    current += ch;
  }
  parts.push(current);
  return {
    rank: parseInt(parts[0]),
    name: parts[1],
    bundesland: parts[2],
    bezirk: parts[3],
    population: parseInt(parts[4]),
    website: parts[5]
  };
});

console.log(`Loaded ${rows.length} municipalities`);

const STANDARD_PATHS = [
  '/veranstaltungen',
  '/termine',
  '/events',
  '/aktuelles/veranstaltungen',
  '/buergerservice/aktuelles/veranstaltungen',
  '/freizeit/veranstaltungen',
  '/kultur/veranstaltungen',
  '/freizeit-tourismus/veranstaltungen',
  '/tourismus/veranstaltungen',
  '/aktuelles/termine',
  '/buergerservice/termine',
  '/veranstaltungskalender',
  '/kalender',
  '/event',
  '/programm',
];

const CITY_PORTALS = {
  'Graz': ['https://www.graz.at/veranstaltungen', 'https://events.graz.at'],
  'Linz': ['https://www.linz.at/veranstaltungen', 'https://www.linztourismus.at/veranstaltungen'],
  'Innsbruck': ['https://www.innsbruck.gv.at/veranstaltungen'],
  'Klagenfurt am Wörthersee': ['https://www.klagenfurt.at/veranstaltungen'],
  'Villach': ['https://www.villach.at/veranstaltungen'],
  'Wels': ['https://www.wels.gv.at/veranstaltungen'],
  'St. Pölten': ['https://www.st-poelten.gv.at/veranstaltungen'],
  'Dornbirn': ['https://www.dornbirn.at/veranstaltungen'],
  'Bregenz': ['https://www.bregenz.gv.at/veranstaltungen'],
};

const EVENT_KEYWORDS = /veranstaltung|termin|event|datum|uhrzeit/gi;
const DATE_PATTERN = /\b\d{1,2}\.\d{1,2}\.\d{4}\b/g;

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function safeFetch(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventProber/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-AT,de;q=0.9',
      },
      redirect: 'follow',
    });
    if (resp.ok) {
      const text = await resp.text();
      return { ok: true, status: resp.status, text, url: resp.url };
    }
    return { ok: false, status: resp.status, text: '', url };
  } catch (e) {
    return { ok: false, status: 0, text: '', url, error: e.message };
  }
}

function analyzeHtml(html) {
  const kwMatches = html.match(EVENT_KEYWORDS) || [];
  const dateMatches = html.match(DATE_PATTERN) || [];
  return { keywordCount: kwMatches.length, dateCount: dateMatches.length };
}

function isEventPage(analysis) {
  return analysis.keywordCount >= 3 || analysis.dateCount >= 2;
}

async function probeStandardPaths(baseUrl) {
  // Normalize base URL
  let base = baseUrl.replace(/\/+$/, '');
  if (!base.startsWith('http')) base = 'http://' + base;

  for (const p of STANDARD_PATHS) {
    const url = base + p;
    const resp = await safeFetch(url);
    await delay(500);
    if (resp.ok) {
      const analysis = analyzeHtml(resp.text);
      if (isEventPage(analysis)) {
        return { eventPageUrl: resp.url, eventPagePath: p, ...analysis, method: 'standard' };
      }
    }
  }
  return null;
}

async function probeHomepageLinks(baseUrl) {
  let base = baseUrl.replace(/\/+$/, '');
  if (!base.startsWith('http')) base = 'http://' + base;

  const resp = await safeFetch(base);
  await delay(500);
  if (!resp.ok) return null;

  // Find links with event-related hrefs
  const linkPattern = /href=["']([^"']*(?:veranstaltung|termin|event|kalender)[^"']*)["']/gi;
  const links = new Set();
  let m;
  while ((m = linkPattern.exec(resp.text)) !== null) {
    let href = m[1];
    if (href.startsWith('/')) href = base + href;
    else if (!href.startsWith('http')) href = base + '/' + href;
    links.add(href);
  }

  for (const link of [...links].slice(0, 5)) {
    const r = await safeFetch(link);
    await delay(500);
    if (r.ok) {
      const analysis = analyzeHtml(r.text);
      if (isEventPage(analysis)) {
        const urlObj = new URL(r.url);
        return { eventPageUrl: r.url, eventPagePath: urlObj.pathname, ...analysis, method: 'homepage-link' };
      }
    }
  }
  return null;
}

async function probeCityPortals(name) {
  const portals = CITY_PORTALS[name];
  if (!portals) return null;

  for (const url of portals) {
    const resp = await safeFetch(url);
    await delay(500);
    if (resp.ok) {
      const analysis = analyzeHtml(resp.text);
      if (isEventPage(analysis)) {
        const urlObj = new URL(resp.url);
        return { eventPageUrl: resp.url, eventPagePath: urlObj.pathname, ...analysis, method: 'city-portal' };
      }
    }
  }
  return null;
}

async function probeMunicipality(row) {
  // 1. Try city portals first for big cities
  let result = await probeCityPortals(row.name);
  if (result) return result;

  // 2. Try standard paths
  result = await probeStandardPaths(row.website);
  if (result) return result;

  // 3. Try homepage links
  result = await probeHomepageLinks(row.website);
  if (result) return result;

  return { eventPageUrl: null, eventPagePath: null, dateCount: 0, keywordCount: 0, method: 'not-found' };
}

async function main() {
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if ((i + 1) % 10 === 0 || i === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`[${elapsed}s] Processing ${i + 1}/${rows.length}: ${row.name} (${row.bundesland})`);
    }

    const probeResult = await probeMunicipality(row);
    results.push({
      name: row.name,
      bundesland: row.bundesland,
      population: row.population,
      website: row.website,
      eventPageUrl: probeResult.eventPageUrl,
      eventPagePath: probeResult.eventPagePath,
      dateCount: probeResult.dateCount,
      keywordCount: probeResult.keywordCount,
      method: probeResult.method,
    });

    const status = probeResult.method !== 'not-found'
      ? `FOUND (${probeResult.method}) ${probeResult.eventPagePath} [${probeResult.dateCount}d/${probeResult.keywordCount}kw]`
      : 'NOT FOUND';
    console.log(`  ${row.name}: ${status}`);
  }

  // Save results
  const outPath = path.resolve('data/probe-batch1.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');

  // Summary
  const found = results.filter(r => r.method !== 'not-found');
  const byMethod = {};
  for (const r of results) {
    byMethod[r.method] = (byMethod[r.method] || 0) + 1;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n=== DONE in ${elapsed}s ===`);
  console.log(`Found: ${found.length}/${results.length}`);
  console.log(`By method:`, byMethod);
  console.log(`Saved to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
