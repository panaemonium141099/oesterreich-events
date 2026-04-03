#!/usr/bin/env node
/**
 * patch-db-coords.mjs
 *
 * Patches existing events in SQLite + Supabase with corrected municipality coordinates.
 * Reads the current gem2goGemeinden.ts, gemeindeList.ts, and CitiesScraper.ts,
 * then updates all events whose source_name matches and whose coordinates differ.
 *
 * Usage: node scripts/patch-db-coords.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load env manually (no dotenv dependency)
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Parse municipality coordinates from source files ────────────────

function parseMunicipalityCoords() {
  const coords = new Map(); // key: "source_name|gkz_or_name" -> { lat, lng, name }

  // 1. gem2goGemeinden.ts — key by GKZ (used in source_id: gem2go-{gkz}-...)
  const gem2goContent = fs.readFileSync(path.join(ROOT, 'src/lib/scrapers/gemeinden/gem2goGemeinden.ts'), 'utf8');
  const gem2goRegex = /name:\s*'([^']+)'.*?lat:\s*([\d.]+),\s*lng:\s*([\d.]+),\s*gkz:\s*'([^']+)'/g;
  let m;
  while ((m = gem2goRegex.exec(gem2goContent)) !== null) {
    coords.set(`gem2go|${m[4]}`, { name: m[1], lat: parseFloat(m[2]), lng: parseFloat(m[3]), gkz: m[4] });
  }
  console.log(`Parsed ${coords.size} gem2go municipalities`);

  // 2. CitiesScraper.ts — key by name
  const citiesContent = fs.readFileSync(path.join(ROOT, 'src/lib/scrapers/CitiesScraper.ts'), 'utf8');
  const citiesRegex = /name:\s*'([^']+)'.*?lat:\s*([\d.]+),\s*lng:\s*([\d.]+)/g;
  let citiesCount = 0;
  while ((m = citiesRegex.exec(citiesContent)) !== null) {
    coords.set(`cities|${m[1]}`, { name: m[1], lat: parseFloat(m[2]), lng: parseFloat(m[3]) });
    citiesCount++;
  }
  console.log(`Parsed ${citiesCount} cities municipalities`);

  // 3. gemeindeList.ts — key by name
  const gemListContent = fs.readFileSync(path.join(ROOT, 'src/lib/scrapers/gemeinden/gemeindeList.ts'), 'utf8');
  const gemListRegex = /name:\s*'([^']+)'.*?lat:\s*([\d.]+),\s*lng:\s*([\d.]+)/g;
  let gemListCount = 0;
  while ((m = gemListRegex.exec(gemListContent)) !== null) {
    coords.set(`gemeinden|${m[1]}`, { name: m[1], lat: parseFloat(m[2]), lng: parseFloat(m[3]) });
    gemListCount++;
  }
  console.log(`Parsed ${gemListCount} gemeindeList municipalities`);

  return coords;
}

// ── Build GKZ lookup for gem2go events ──────────────────────────────

function buildGkzLookup(coords) {
  const gkzMap = new Map();
  for (const [key, val] of coords) {
    if (key.startsWith('gem2go|')) {
      gkzMap.set(val.gkz, val);
    }
  }
  return gkzMap;
}

// ── Build name lookup for other scrapers ────────────────────────────

function buildNameLookup(coords, prefix) {
  const nameMap = new Map();
  for (const [key, val] of coords) {
    if (key.startsWith(prefix + '|')) {
      nameMap.set(val.name, val);
    }
  }
  return nameMap;
}

// ── Patch Supabase ──────────────────────────────────────────────────

async function patchSupabase(coords) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('WARNING: SUPABASE env vars not set, skipping Supabase patch');
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const gkzLookup = buildGkzLookup(coords);
  const citiesLookup = buildNameLookup(coords, 'cities');
  const gemeindenLookup = buildNameLookup(coords, 'gemeinden');

  // Fetch all events from relevant sources
  const sourceNames = ['gem2go', 'cities', 'gemeinden-generic', 'gemeinden'];
  let totalUpdated = 0;

  for (const sourceName of sourceNames) {
    console.log(`\nPatching ${sourceName} events in Supabase...`);

    // Fetch in batches of 1000
    let offset = 0;
    const batchSize = 1000;
    let batchUpdated = 0;
    let batchTotal = 0;
    const updates = []; // Collect {id, lat, lng} pairs

    while (true) {
      const { data: events, error } = await supabase
        .from('events')
        .select('id, source_id, source_name, location_name, latitude, longitude')
        .eq('source_name', sourceName)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.log(`  ERROR fetching: ${error.message}`);
        break;
      }
      if (!events || events.length === 0) break;

      batchTotal += events.length;

      for (const event of events) {
        let newCoords = null;

        if (sourceName === 'gem2go') {
          // Extract GKZ from source_id: gem2go-{gkz}-{slug}-{date}
          const gkzMatch = event.source_id?.match(/^gem2go-(\d+)-/);
          if (gkzMatch) {
            newCoords = gkzLookup.get(gkzMatch[1]);
          }
        } else if (sourceName === 'cities') {
          // Match by location_name
          newCoords = citiesLookup.get(event.location_name);
        } else {
          // gemeinden-generic, gemeinden: match by location_name
          newCoords = gemeindenLookup.get(event.location_name);
        }

        if (newCoords && event.latitude != null && event.longitude != null) {
          const dist = Math.sqrt(
            Math.pow((event.latitude - newCoords.lat) * 111, 2) +
            Math.pow((event.longitude - newCoords.lng) * 71, 2)
          );
          // Only update if coordinates actually differ (> 100m)
          if (dist > 0.1) {
            updates.push({ id: event.id, latitude: newCoords.lat, longitude: newCoords.lng });
          }
        }
      }

      offset += batchSize;
      if (events.length < batchSize) break;
    }

    console.log(`  Found ${batchTotal} events, ${updates.length} need coordinate update`);

    // Apply updates in batches of 50
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);
      for (const upd of batch) {
        const { error } = await supabase
          .from('events')
          .update({ latitude: upd.latitude, longitude: upd.longitude })
          .eq('id', upd.id);
        if (error) {
          console.log(`  ERROR updating ${upd.id}: ${error.message}`);
        }
      }
      batchUpdated += batch.length;
      if ((i + 50) % 500 === 0 || i + 50 >= updates.length) {
        console.log(`  Updated ${Math.min(i + 50, updates.length)}/${updates.length}...`);
      }
    }

    totalUpdated += batchUpdated;
  }

  console.log(`\nSupabase total: ${totalUpdated} events updated`);
}

// ── Patch SQLite ────────────────────────────────────────────────────

function patchSQLite(coords) {
  // Use the main repo's DB (worktree doesn't have it)
  const dbPath = process.env.EVENTS_DB_PATH || path.join(ROOT, 'data/events.db');
  if (!fs.existsSync(dbPath)) {
    console.log('SQLite DB not found, skipping');
    return;
  }

  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  const gkzLookup = buildGkzLookup(coords);
  const citiesLookup = buildNameLookup(coords, 'cities');
  const gemeindenLookup = buildNameLookup(coords, 'gemeinden');

  const updateStmt = db.prepare('UPDATE events SET latitude = ?, longitude = ? WHERE id = ?');

  let totalUpdated = 0;

  // gem2go events
  const gem2goEvents = db.prepare("SELECT id, source_id, latitude, longitude FROM events WHERE source_name = 'gem2go'").all();
  let gem2goUpdated = 0;
  for (const event of gem2goEvents) {
    const gkzMatch = event.source_id?.match(/^gem2go-(\d+)-/);
    if (!gkzMatch) continue;
    const newCoords = gkzLookup.get(gkzMatch[1]);
    if (!newCoords) continue;
    const dist = Math.sqrt(
      Math.pow((event.latitude - newCoords.lat) * 111, 2) +
      Math.pow((event.longitude - newCoords.lng) * 71, 2)
    );
    if (dist > 0.1) {
      updateStmt.run(newCoords.lat, newCoords.lng, event.id);
      gem2goUpdated++;
    }
  }
  console.log(`SQLite gem2go: ${gem2goUpdated}/${gem2goEvents.length} updated`);
  totalUpdated += gem2goUpdated;

  // cities events
  const citiesEvents = db.prepare("SELECT id, location_name, latitude, longitude FROM events WHERE source_name = 'cities'").all();
  let citiesUpdated = 0;
  for (const event of citiesEvents) {
    const newCoords = citiesLookup.get(event.location_name);
    if (!newCoords) continue;
    const dist = Math.sqrt(
      Math.pow((event.latitude - newCoords.lat) * 111, 2) +
      Math.pow((event.longitude - newCoords.lng) * 71, 2)
    );
    if (dist > 0.1) {
      updateStmt.run(newCoords.lat, newCoords.lng, event.id);
      citiesUpdated++;
    }
  }
  console.log(`SQLite cities: ${citiesUpdated}/${citiesEvents.length} updated`);
  totalUpdated += citiesUpdated;

  // gemeinden-generic + gemeinden events
  for (const sn of ['gemeinden-generic', 'gemeinden']) {
    const events = db.prepare(`SELECT id, location_name, latitude, longitude FROM events WHERE source_name = '${sn}'`).all();
    let updated = 0;
    for (const event of events) {
      const newCoords = gemeindenLookup.get(event.location_name);
      if (!newCoords) continue;
      const dist = Math.sqrt(
        Math.pow((event.latitude - newCoords.lat) * 111, 2) +
        Math.pow((event.longitude - newCoords.lng) * 71, 2)
      );
      if (dist > 0.1) {
        updateStmt.run(newCoords.lat, newCoords.lng, event.id);
        updated++;
      }
    }
    console.log(`SQLite ${sn}: ${updated}/${events.length} updated`);
    totalUpdated += updated;
  }

  db.close();
  console.log(`\nSQLite total: ${totalUpdated} events updated`);
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Patch existing event coordinates ===\n');

  const coords = parseMunicipalityCoords();

  console.log('\n--- SQLite ---');
  patchSQLite(coords);

  console.log('\n--- Supabase ---');
  await patchSupabase(coords);

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
