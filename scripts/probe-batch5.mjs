import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TIMEOUT = 8000;
const DELAY = 500;

const PATHS = [
  '/veranstaltungen', '/termine', '/events',
  '/aktuelles/veranstaltungen', '/buergerservice/aktuelles/veranstaltungen',
  '/freizeit/veranstaltungen', '/kultur/veranstaltungen',
  '/freizeit-tourismus/veranstaltungen', '/tourismus/veranstaltungen',
  '/aktuelles/termine', '/buergerservice/termine',
  '/veranstaltungskalender', '/kalender', '/event', '/programm',
];

const EVENT_KEYWORDS = [
  'veranstaltung', 'veranstaltungen', 'event', 'events', 'termine',
  'kalender', 'programm', 'konzert', 'fest', 'feier', 'vortrag',
  'workshop', 'ausstellung', 'theater', 'kabarett', 'lesung',
  'flohmarkt', 'wanderung', 'führung', 'kurs',
];

const DATE_PATTERN = /\b\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4}\b/g;

function fetch(url, timeout = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GemeindeProbe/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-AT,de;q=0.9',
      },
    }, (res) => {
      // Follow redirects (up to 3)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) {
          const u = new URL(url);
          loc = `${u.protocol}//${u.host}${loc}`;
        }
        res.resume();
        return fetch(loc, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function analyzeHtml(html) {
  const lower = html.toLowerCase();
  let keywordCount = 0;
  for (const kw of EVENT_KEYWORDS) {
    const re = new RegExp(kw, 'gi');
    const m = lower.match(re);
    if (m) keywordCount += m.length;
  }
  const dates = html.match(DATE_PATTERN);
  const dateCount = dates ? dates.length : 0;
  return { keywordCount, dateCount };
}

function extractEventLinks(html, baseUrl) {
  const linkRe = /href=["']([^"']*?)["']/gi;
  const eventLinkPatterns = [
    /veranstaltung/i, /termine/i, /events?/i, /kalender/i, /programm/i,
    /freizeit/i, /kultur/i, /aktuelles/i,
  ];
  const found = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    for (const pat of eventLinkPatterns) {
      if (pat.test(href)) {
        found.push(href);
        break;
      }
    }
  }
  return [...new Set(found)];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Parse CSV
const csvPath = path.join(__dirname, '..', 'data', 'uncovered-gemeinden-3000plus.csv');
const csvText = fs.readFileSync(csvPath, 'utf-8');
const lines = csvText.trim().split('\n');
// header is line 0, data rows start at line 1
// We want rows 249-308 (0-indexed from data: indices 248-307, file lines 249-308)
const dataLines = lines.slice(1); // skip header
const selected = dataLines.slice(248, 308); // rows 249-308

const municipalities = selected.map(line => {
  // CSV parse: handle commas in quoted fields
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
    rank: parts[0],
    name: parts[1],
    bundesland: parts[2],
    bezirk: parts[3],
    population: parseInt(parts[4]),
    website: parts[5],
  };
});

console.log(`Loaded ${municipalities.length} municipalities (rows 249-308)`);

async function probeMunicipality(muni) {
  const base = muni.website.replace(/\/+$/, '');

  // Try standard paths
  for (const p of PATHS) {
    const url = base + p;
    try {
      const html = await fetch(url);
      const { keywordCount, dateCount } = analyzeHtml(html);
      if (keywordCount >= 3 && dateCount >= 2) {
        return {
          name: muni.name,
          bundesland: muni.bundesland,
          population: muni.population,
          website: muni.website,
          eventPageUrl: url,
          eventPagePath: p,
          dateCount,
          keywordCount,
          method: 'direct-path',
        };
      }
    } catch (e) {
      // skip
    }
    await sleep(100);
  }

  // Fallback: fetch homepage and search for event links
  try {
    const homeHtml = await fetch(base);
    const links = extractEventLinks(homeHtml, base);

    for (const link of links.slice(0, 8)) {
      let fullUrl = link;
      if (link.startsWith('/')) {
        fullUrl = base + link;
      } else if (!link.startsWith('http')) {
        fullUrl = base + '/' + link;
      }
      try {
        const html = await fetch(fullUrl);
        const { keywordCount, dateCount } = analyzeHtml(html);
        if (keywordCount >= 3 && dateCount >= 1) {
          const urlObj = new URL(fullUrl);
          return {
            name: muni.name,
            bundesland: muni.bundesland,
            population: muni.population,
            website: muni.website,
            eventPageUrl: fullUrl,
            eventPagePath: urlObj.pathname,
            dateCount,
            keywordCount,
            method: 'homepage-link',
          };
        }
      } catch (e) {
        // skip
      }
      await sleep(100);
    }

    // Check homepage itself
    const { keywordCount, dateCount } = analyzeHtml(homeHtml);
    if (keywordCount >= 5 && dateCount >= 2) {
      return {
        name: muni.name,
        bundesland: muni.bundesland,
        population: muni.population,
        website: muni.website,
        eventPageUrl: base,
        eventPagePath: '/',
        dateCount,
        keywordCount,
        method: 'homepage-events',
      };
    }
  } catch (e) {
    // homepage failed
  }

  return {
    name: muni.name,
    bundesland: muni.bundesland,
    population: muni.population,
    website: muni.website,
    eventPageUrl: null,
    eventPagePath: null,
    dateCount: 0,
    keywordCount: 0,
    method: 'not-found',
  };
}

async function main() {
  const results = [];
  for (let i = 0; i < municipalities.length; i++) {
    const muni = municipalities[i];
    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`[${i + 1}/${municipalities.length}] Probing ${muni.name} (${muni.website})...`);
    }
    const result = await probeMunicipality(muni);
    results.push(result);
    if (result.eventPageUrl) {
      console.log(`  ✓ ${muni.name}: ${result.eventPagePath} (${result.method}, kw=${result.keywordCount}, dates=${result.dateCount})`);
    }
    await sleep(DELAY);
  }

  const outPath = path.join(__dirname, '..', 'data', 'probe-batch5.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');

  const found = results.filter(r => r.eventPageUrl);
  const notFound = results.filter(r => !r.eventPageUrl);
  console.log(`\nDone! ${found.length} found, ${notFound.length} not found.`);
  console.log(`Results saved to ${outPath}`);

  // Summary by method
  const methods = {};
  for (const r of results) {
    methods[r.method] = (methods[r.method] || 0) + 1;
  }
  console.log('Methods:', methods);
}

main().catch(e => { console.error(e); process.exit(1); });
