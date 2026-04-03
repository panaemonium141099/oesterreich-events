#!/usr/bin/env node
/**
 * fix-gemeinde-coords.mjs
 *
 * Fixes incorrect municipality coordinates in gem2goGemeinden.ts by:
 * 1. Fetching ALL Austrian place=village|town|city nodes from Overpass API (OSM)
 * 2. Matching gem2go municipalities by name
 * 3. Using Nominatim as fallback for unmatched municipalities
 * 4. Writing corrected coordinates back to gem2goGemeinden.ts
 *
 * Usage: node scripts/fix-gemeinde-coords.mjs [--dry-run]
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEM2GO_FILE = path.join(__dirname, '..', 'src', 'lib', 'scrapers', 'gemeinden', 'gem2goGemeinden.ts');
const CITIES_FILE = path.join(__dirname, '..', 'src', 'lib', 'scrapers', 'CitiesScraper.ts');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Helpers ──────────────────────────────────────────────────────────

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AustriaEvents-GeoFix/1.0 (educational)', ...headers } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = typeof body === 'string' ? body : JSON.stringify(body);
    const options = {
      hostname, path, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'AustriaEvents-GeoFix/1.0 (educational)',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Normalize name for fuzzy matching */
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')  // Remove parentheticals
    .replace(/\bam\b/g, '')
    .replace(/\ban\s+der\b/g, '')
    .replace(/\ban\s+dem\b/g, '')
    .replace(/\bim\b/g, '')
    .replace(/\bbei\b/g, '')
    .replace(/\bob\s+der\b/g, '')
    .replace(/\bsankt\b/g, 'st.')
    .replace(/\bsaint\b/g, 'st.')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9.]/g, '')
    .trim();
}

/** Distance in km between two lat/lng points (Haversine) */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Step 1: Fetch Overpass place nodes ──────────────────────────────

async function fetchOverpassPlaceNodes() {
  console.log('Step 1: Fetching all Austrian place nodes from Overpass API...');
  const query = `[out:json][timeout:90];
area["ISO3166-1"="AT"]->.austria;
(
  node["place"~"^(village|town|city|municipality)$"](area.austria);
);
out body;`;

  let raw;
  for (let attempt = 0; attempt < 3; attempt++) {
    raw = await httpsPost('overpass-api.de', '/api/interpreter', 'data=' + encodeURIComponent(query));
    if (raw.startsWith('{')) break;
    console.log(`  Overpass returned non-JSON (attempt ${attempt + 1}/3), retrying in 10s...`);
    await sleep(10000);
  }
  if (!raw.startsWith('{')) {
    throw new Error('Overpass API did not return JSON after 3 attempts: ' + raw.slice(0, 200));
  }
  const data = JSON.parse(raw);

  if (!data.elements) {
    throw new Error('Overpass API returned no elements');
  }

  console.log(`  Fetched ${data.elements.length} place nodes`);

  // Build lookup: name -> { lat, lon, place, population }
  // Handle duplicate names by keeping all and disambiguating later
  const byName = new Map();
  const byNormalized = new Map();

  for (const el of data.elements) {
    const name = el.tags?.name;
    if (!name) continue;

    const entry = {
      name,
      lat: el.lat,
      lon: el.lon,
      place: el.tags?.place,
      population: parseInt(el.tags?.population) || 0,
      osmId: el.id,
    };

    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(entry);

    const norm = normalize(name);
    if (!byNormalized.has(norm)) byNormalized.set(norm, []);
    byNormalized.get(norm).push(entry);
  }

  console.log(`  Unique names: ${byName.size}, unique normalized: ${byNormalized.size}`);
  return { byName, byNormalized };
}

// ── Step 2: Parse gem2go municipalities ─────────────────────────────

function parseGem2GoFile() {
  console.log('\nStep 2: Parsing gem2goGemeinden.ts...');
  const content = fs.readFileSync(GEM2GO_FILE, 'utf8');

  const entries = [];
  const regex = /\{\s*name:\s*'([^']+)',\s*website:\s*'([^']+)',\s*plz:\s*'([^']+)',\s*bezirk:\s*'([^']+)',\s*bundesland:\s*'([^']+)',\s*lat:\s*([\d.]+),\s*lng:\s*([\d.]+),\s*gkz:\s*'([^']+)'\s*\}/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    entries.push({
      name: m[1],
      website: m[2],
      plz: m[3],
      bezirk: m[4],
      bundesland: m[5],
      lat: parseFloat(m[6]),
      lng: parseFloat(m[7]),
      gkz: m[8],
      matchIndex: m.index,
      fullMatch: m[0],
    });
  }

  console.log(`  Parsed ${entries.length} municipalities`);
  return { entries, content };
}

// ── Step 3: Match municipalities to OSM place nodes ────────────────

/** Map Bundesland names to approximate bounding boxes for disambiguation */
const BUNDESLAND_BOUNDS = {
  'Burgenland': { latMin: 46.8, latMax: 48.2, lonMin: 15.9, lonMax: 17.2 },
  'Kärnten': { latMin: 46.3, latMax: 47.2, lonMin: 12.6, lonMax: 15.1 },
  'Niederösterreich': { latMin: 47.4, latMax: 49.0, lonMin: 14.4, lonMax: 17.1 },
  'Oberösterreich': { latMin: 47.4, latMax: 48.8, lonMin: 12.7, lonMax: 15.0 },
  'Salzburg': { latMin: 46.9, latMax: 48.1, lonMin: 12.0, lonMax: 14.0 },
  'Steiermark': { latMin: 46.6, latMax: 47.9, lonMin: 13.5, lonMax: 16.2 },
  'Tirol': { latMin: 46.6, latMax: 47.7, lonMin: 10.0, lonMax: 12.9 },
  'Vorarlberg': { latMin: 46.8, latMax: 47.6, lonMin: 9.5, lonMax: 10.3 },
  'Wien': { latMin: 48.1, latMax: 48.35, lonMin: 16.1, lonMax: 16.6 },
};

/** Filter candidates to those within Bundesland bounds. Always applies. */
function filterByBounds(candidates, bounds) {
  if (!bounds || candidates.length === 0) return candidates;
  const filtered = candidates.filter(c =>
    c.lat >= bounds.latMin && c.lat <= bounds.latMax &&
    c.lon >= bounds.lonMin && c.lon <= bounds.lonMax
  );
  return filtered.length > 0 ? filtered : []; // Return empty if none in bounds — don't fallback to wrong Bundesland
}

function matchMunicipalities(gem2goEntries, osmLookup) {
  console.log('\nStep 3: Matching municipalities to OSM place nodes...');

  const matched = [];
  const unmatched = [];

  for (const gem of gem2goEntries) {
    const bounds = BUNDESLAND_BOUNDS[gem.bundesland];
    let found = false;

    // Strategy 1: Exact name match within Bundesland bounds
    let candidates = filterByBounds(osmLookup.byName.get(gem.name) || [], bounds);
    if (candidates.length >= 1) {
      matched.push({ gem, osm: candidates[0], method: 'exact' });
      continue;
    }

    // Strategy 2: Normalized name match within Bundesland bounds
    const norm = normalize(gem.name);
    candidates = filterByBounds(osmLookup.byNormalized.get(norm) || [], bounds);
    if (candidates.length >= 1) {
      matched.push({ gem, osm: candidates[0], method: 'normalized' });
      continue;
    }

    // Strategy 3: Try first part of hyphenated/compound names (within bounds)
    const parts = gem.name.split(/[-–]/);
    if (parts.length > 1) {
      for (const part of parts) {
        const partNorm = normalize(part.trim());
        candidates = filterByBounds(osmLookup.byNormalized.get(partNorm) || [], bounds);
        if (candidates.length >= 1) {
          matched.push({ gem, osm: candidates[0], method: 'partial-' + part.trim() });
          found = true;
          break;
        }
      }
      if (found) continue;
    }

    // Strategy 4: Try removing common suffixes (within bounds)
    const suffixless = gem.name
      .replace(/\s+(am|an der|an dem|im|bei|ob der)\s+.+$/i, '')
      .trim();
    if (suffixless !== gem.name) {
      const suffNorm = normalize(suffixless);
      candidates = filterByBounds(osmLookup.byNormalized.get(suffNorm) || [], bounds);
      if (candidates.length >= 1) {
        matched.push({ gem, osm: candidates[0], method: 'suffix-stripped' });
        continue;
      }
    }

    unmatched.push(gem);
  }

  console.log(`  Matched: ${matched.length} (exact: ${matched.filter(m => m.method === 'exact').length}, normalized: ${matched.filter(m => m.method === 'normalized').length}, partial: ${matched.filter(m => m.method.startsWith('partial')).length}, suffix: ${matched.filter(m => m.method === 'suffix-stripped').length})`);
  console.log(`  Unmatched: ${unmatched.length}`);

  return { matched, unmatched };
}

// ── Step 4: Nominatim fallback for unmatched ───────────────────────

async function nominatimFallback(unmatched) {
  if (unmatched.length === 0) return [];

  console.log(`\nStep 4: Nominatim fallback for ${unmatched.length} unmatched municipalities...`);
  const results = [];

  for (let i = 0; i < unmatched.length; i++) {
    const gem = unmatched[i];
    const query = `${gem.name}, ${gem.bundesland}, Austria`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=at`;

    try {
      const raw = await httpsGet(url);
      const data = JSON.parse(raw);

      if (data.length > 0) {
        results.push({
          gem,
          osm: { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name },
          method: 'nominatim',
        });
        if ((i + 1) % 50 === 0) {
          console.log(`  Nominatim: ${i + 1}/${unmatched.length}...`);
        }
      } else {
        console.log(`  WARNING: No Nominatim result for ${gem.name} (${gem.bundesland})`);
        results.push({ gem, osm: null, method: 'failed' });
      }
    } catch (err) {
      console.log(`  ERROR: Nominatim failed for ${gem.name}: ${err.message}`);
      results.push({ gem, osm: null, method: 'failed' });
    }

    await sleep(1100); // Nominatim rate limit
  }

  const found = results.filter(r => r.osm).length;
  const failed = results.filter(r => !r.osm).length;
  console.log(`  Nominatim results: ${found} found, ${failed} failed`);

  return results;
}

// ── Step 5: Apply corrections ──────────────────────────────────────

function applyCorrections(content, allMatches) {
  console.log('\nStep 5: Applying corrections...');

  let newContent = content;
  let corrections = 0;
  let unchanged = 0;
  let failed = 0;
  const bigMoves = []; // Track moves > 5km for reporting

  // Sort by matchIndex descending so replacements don't shift positions
  const sorted = [...allMatches]
    .filter(m => m.osm)
    .sort((a, b) => b.gem.matchIndex - a.gem.matchIndex);

  for (const { gem, osm, method } of sorted) {
    const newLat = parseFloat(osm.lat.toFixed(4));
    const newLng = parseFloat(osm.lon.toFixed(4));

    const dist = distanceKm(gem.lat, gem.lng, newLat, newLng);

    if (dist < 0.1) {
      unchanged++;
      continue;
    }

    // Build the replacement string
    const oldEntry = gem.fullMatch;
    const newEntry = oldEntry
      .replace(/lat:\s*[\d.]+/, `lat: ${newLat}`)
      .replace(/lng:\s*[\d.]+/, `lng: ${newLng}`);

    if (oldEntry === newEntry) {
      unchanged++;
      continue;
    }

    newContent = newContent.replace(oldEntry, newEntry);
    corrections++;

    if (dist > 5) {
      bigMoves.push({ name: gem.name, oldLat: gem.lat, oldLng: gem.lng, newLat, newLng, dist: dist.toFixed(1), method });
    }
  }

  console.log(`  Corrections: ${corrections}, Unchanged: ${unchanged}, Failed: ${failed}`);
  console.log(`  Big moves (>5km): ${bigMoves.length}`);

  if (bigMoves.length > 0) {
    console.log('\n  Top 20 biggest corrections:');
    bigMoves.sort((a, b) => b.dist - a.dist);
    bigMoves.slice(0, 20).forEach(m => {
      console.log(`    ${m.name}: ${m.dist}km (${m.oldLat},${m.oldLng}) -> (${m.newLat},${m.newLng}) [${m.method}]`);
    });
  }

  return { newContent, corrections, bigMoves };
}

// ── Generic file fixer ─────────────────────────────────────────────

/**
 * Parse any TS file with lat/lng entries and fix coordinates.
 * Supports both gem2go format (with gkz) and simpler formats.
 */
function parseGenericFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const entries = [];

  // Match entries with bundesland + lat + lng (various formats)
  const regex = /\{[^}]*?name:\s*'([^']+)'[^}]*?bundesland:\s*'([^']+)'[^}]*?lat:\s*([\d.]+),\s*lng:\s*([\d.]+)[^}]*?\}/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    entries.push({
      name: m[1],
      bundesland: m[2],
      lat: parseFloat(m[3]),
      lng: parseFloat(m[4]),
      matchIndex: m.index,
      fullMatch: m[0],
    });
  }

  return { entries, content };
}

async function fixFile(filePath, label, osmLookup) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Fixing: ${label} (${path.basename(filePath)})`);
  console.log('='.repeat(60));

  const { entries, content } = parseGenericFile(filePath);
  console.log(`  Parsed ${entries.length} municipalities`);

  if (entries.length === 0) {
    console.log('  No entries found, skipping.');
    return { corrections: 0 };
  }

  const { matched, unmatched } = matchMunicipalities(entries, osmLookup);
  const nominatimResults = await nominatimFallback(unmatched);
  const allMatches = [...matched, ...nominatimResults];
  const { newContent, corrections, bigMoves } = applyCorrections(content, allMatches);

  if (!DRY_RUN && corrections > 0) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`  Wrote ${corrections} corrections`);
  } else if (DRY_RUN) {
    console.log(`  DRY RUN: Would write ${corrections} corrections`);
  }

  return { corrections, matched: matched.length, nominatim: nominatimResults.filter(r => r.osm).length, failed: allMatches.filter(m => !m.osm).length };
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('=== Gemeinde Coordinate Fix (All Scrapers) ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Step 1: Fetch OSM data (once, shared across all files)
  const osmLookup = await fetchOverpassPlaceNodes();

  // Step 2: Fix all files
  const GEMEINDE_LIST_FILE = path.join(__dirname, '..', 'src', 'lib', 'scrapers', 'gemeinden', 'gemeindeList.ts');

  const results = {};
  results.gem2go = await fixFile(GEM2GO_FILE, 'Gem2GoScraper', osmLookup);
  results.cities = await fixFile(CITIES_FILE, 'CitiesScraper', osmLookup);
  results.gemeinden = await fixFile(GEMEINDE_LIST_FILE, 'GemeindeList (generic scraper)', osmLookup);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));
  let totalCorrections = 0;
  for (const [name, r] of Object.entries(results)) {
    console.log(`  ${name}: ${r.corrections} corrections (overpass: ${r.matched}, nominatim: ${r.nominatim}, failed: ${r.failed})`);
    totalCorrections += r.corrections;
  }
  console.log(`  TOTAL: ${totalCorrections} coordinates corrected`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
