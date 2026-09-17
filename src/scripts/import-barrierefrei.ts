/**
 * Import des kuratierten Barrierefrei-Datensatzes (data/barrierefrei/*.json)
 * nach poi_activities.
 *
 *   npm run import:barrierefrei                 # schreibt
 *   npm run import:barrierefrei -- --dry-run    # nur pruefen/zaehlen
 *   npm run import:barrierefrei -- --source niederoesterreich-at
 *   npm run import:barrierefrei -- --wikimedia  # Bildsuche fuer Eintraege ohne Bild
 *                                                # (Cache data/barrierefrei/_wikimedia.json)
 *
 * Pro Eintrag:
 *   1. Koordinaten: aus dem Datensatz, sonst Geocoding (Nominatim via
 *      geocodeLocation, gecacht in geocode_cache) — genau -> grob.
 *   2. Gemeinde-Registry (Bundesland, Gemeinde-Slug, Bezirk) wie der
 *      Deskline-Ingest; ausserhalb der Registry -> uebersprungen.
 *   3. Abgleich mit dem Deskline-Bestand (<= 600 m, Namen ueberlappen):
 *      Treffer -> die bestehende Zeile bekommt accessibility_curated
 *      (und ein Bild, falls sie keines hat); sonst eigene Zeile
 *      source='barrierefrei-web', source_region=<Quelle>.
 *   4. Wiederholungslauf: Upsert auf (source, source_id), Slug/shortid
 *      bleiben (E5). Zeilen werden nie geloescht.
 *
 * supabase-js wirft bei Schreibfehlern nicht — jede Antwort wird geprueft.
 * Am Ende laeuft recompute_activity_quality_scores() per RPC, damit neue
 * Zeilen sofort im Ranking stehen (der taegliche pg_cron uebernimmt danach).
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createActivityStoreClient } from '@/lib/activities/activity-store';
import { geocodeLocation } from '@/lib/geocoding';
import { parseCuratedAccessibility } from '@/lib/activities/accessibility';
import {
  BARRIEREFREI_SOURCE,
  buildCuratedInsertRow,
  buildCuratedUpdateRow,
  curatedAccessibilityOf,
  findDesklineMatch,
  geocodeCandidates,
  resolvePlace,
  sourceIdOf,
  toImageJson,
  validateDatasetFile,
  type DatasetEntry,
  type DatasetFile,
  type DatasetImage,
  type MatchCandidate,
} from '@/lib/activities/barrierefrei-dataset';
import { findWikimediaImage } from '@/lib/activities/wikimedia-image';
import { isDirectRun } from './lib/is-direct-run';

const DATA_DIR = join(process.cwd(), 'data', 'barrierefrei');
const WIKIMEDIA_CACHE = join(DATA_DIR, '_wikimedia.json');
const GEO_CACHE = join(DATA_DIR, '_geocode.json');

type WikimediaCache = Record<string, DatasetImage | null>;
type GeoCache = Record<string, { lat: number; lng: number; query: string } | null>;

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function loadDataset(onlySource: string | null): DatasetFile[] {
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort();
  const out: DatasetFile[] = [];
  for (const f of files) {
    const parsed = validateDatasetFile(JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')), f);
    if (onlySource && parsed.source !== onlySource) continue;
    out.push(parsed);
  }
  return out;
}

interface Stats {
  entries: number;
  geocoded: number;
  noCoords: number;
  outsideRegistry: number;
  mergedIntoDeskline: number;
  mergedIntoCurated: number;
  inserted: number;
  updated: number;
  imagesFromWikimedia: number;
  errors: string[];
}

/** Nominatim sperrt bei >1 Anfrage/s per 429; dann nichts als "kein Treffer" cachen. */
let geocoderBlocked = false;
async function probeNominatim(): Promise<void> {
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?q=Wien%2C%20Austria&format=json&limit=1&countrycodes=at', {
      headers: { 'User-Agent': 'AustriaEvents-Scraper/1.0 (educational project)' },
    });
    geocoderBlocked = res.status === 429 || res.status === 403;
  } catch {
    geocoderBlocked = true;
  }
  if (geocoderBlocked) console.log('[import-barrierefrei] Nominatim antwortet mit 429/403: Eintraege ohne Koordinaten werden uebersprungen, Cache bleibt unberuehrt');
}

async function resolveCoords(
  entry: DatasetEntry,
  geoCache: GeoCache,
  key: string,
  stats: Stats,
): Promise<{ lat: number; lng: number } | null> {
  if (entry.lat != null && entry.lng != null) return { lat: entry.lat, lng: entry.lng };
  if (key in geoCache) {
    const c = geoCache[key];
    return c ? { lat: c.lat, lng: c.lng } : null;
  }
  if (geocoderBlocked) return null;
  for (const candidate of geocodeCandidates(entry)) {
    // Nominatim erlaubt 1 Anfrage/s; ohne Pause antwortet es mit 429 und
    // geocodeLocation liefert dann still null.
    await new Promise((r) => setTimeout(r, 1100));
    const geo = await geocodeLocation(candidate);
    if (geo) {
      geoCache[key] = { lat: geo.latitude, lng: geo.longitude, query: candidate };
      stats.geocoded++;
      return { lat: geo.latitude, lng: geo.longitude };
    }
  }
  geoCache[key] = null;
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const wikimedia = args.includes('--wikimedia');
  const sourceIdx = args.indexOf('--source');
  const onlySource = sourceIdx >= 0 ? (args[sourceIdx + 1] ?? null) : null;

  const files = loadDataset(onlySource);
  await probeNominatim();
  const supabase = createActivityStoreClient();
  const wikiCache = readJson<WikimediaCache>(WIKIMEDIA_CACHE, {});
  const geoCache = readJson<GeoCache>(GEO_CACHE, {});
  const nowIso = new Date().toISOString();

  const stats: Stats = {
    entries: 0,
    geocoded: 0,
    noCoords: 0,
    outsideRegistry: 0,
    mergedIntoDeskline: 0,
    mergedIntoCurated: 0,
    inserted: 0,
    updated: 0,
    imagesFromWikimedia: 0,
    errors: [],
  };

  console.log(
    `[import-barrierefrei] ${files.length} Quellen, ${files.reduce((n, f) => n + f.entries.length, 0)} Eintraege` +
      `${dryRun ? ' (dry-run)' : ''}${wikimedia ? ' + Wikimedia-Bildsuche' : ''}`,
  );

  for (const file of files) {
    // Bestehende kuratierte Zeilen dieser Quelle (fuer Insert/Update-Trennung).
    const existingBySourceId = new Map<string, { id: string }>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('poi_activities')
        .select('id, source_id')
        .eq('source', BARRIEREFREI_SOURCE)
        .eq('source_region', file.source)
        .range(from, from + 999);
      if (error) throw new Error(`[import-barrierefrei] Prefetch ${file.source}: ${error.message}`);
      for (const row of (data ?? []) as Array<{ id: string; source_id: string }>) existingBySourceId.set(row.source_id, { id: row.id });
      if ((data ?? []).length < 1000) break;
    }

    for (const entry of file.entries) {
      stats.entries++;
      const key = sourceIdOf(file, entry);
      try {
        const coords = await resolveCoords(entry, geoCache, key, stats);
        if (!coords) {
          stats.noCoords++;
          stats.errors.push(`${key}: keine Koordinaten (Adresse: ${entry.address ?? '-'}, ${entry.postal_code ?? ''} ${entry.town ?? ''})`);
          continue;
        }
        const place = resolvePlace(coords.lat, coords.lng);
        if (!place) {
          stats.outsideRegistry++;
          stats.errors.push(`${key}: ausserhalb der Gemeinde-Registry (${coords.lat}, ${coords.lng})`);
          continue;
        }

        // Kandidaten im Umkreis (bbox ~700 m): Deskline-POIs und bereits
        // kuratierte Zeilen ANDERER Quellen (dieselbe Sehenswuerdigkeit steht
        // oft bei austria.info, wien.info und museumsguide.net).
        const { data: cand, error: candErr } = await supabase
          .from('poi_activities')
          .select('id, name, lat, lng, images, source, source_region, accessibility_curated')
          .in('source', ['deskline', BARRIEREFREI_SOURCE])
          .eq('visible', true)
          .gte('lat', coords.lat - 0.0065)
          .lte('lat', coords.lat + 0.0065)
          .gte('lng', coords.lng - 0.0095)
          .lte('lng', coords.lng + 0.0095)
          .limit(80);
        if (candErr) throw new Error(`Kandidaten: ${candErr.message}`);
        type CandRow = MatchCandidate & { images: unknown; source: string; source_region: string | null; accessibility_curated: unknown };
        const all = (cand ?? []) as CandRow[];
        const desklineCands = all.filter((c) => c.source === 'deskline');
        const curatedCands = all.filter((c) => c.source === BARRIEREFREI_SOURCE && c.source_region !== file.source);
        const match = findDesklineMatch({ name: entry.name, lat: coords.lat, lng: coords.lng }, desklineCands);
        const matchRow = match ? desklineCands.find((c) => c.id === match.id) ?? null : null;
        const curatedMatch = match ? null : findDesklineMatch({ name: entry.name, lat: coords.lat, lng: coords.lng }, curatedCands);
        const curatedRow = curatedMatch ? curatedCands.find((c) => c.id === curatedMatch.id) ?? null : null;

        // Bilder: Quelle, sonst Wikimedia (gecacht), sonst keins.
        let images: DatasetImage[] = entry.images ?? [];
        const matchHasImage =
          (Array.isArray(matchRow?.images) && matchRow.images.length > 0) ||
          (Array.isArray(curatedRow?.images) && curatedRow.images.length > 0);
        if (images.length === 0 && !matchHasImage) {
          if (wikimedia && !(key in wikiCache)) {
            wikiCache[key] = await findWikimediaImage(entry.name, entry.town ?? place.townFallback);
            writeFileSync(WIKIMEDIA_CACHE, JSON.stringify(wikiCache, null, 2) + '\n');
          }
          const cached = wikiCache[key];
          if (cached) {
            images = [cached];
            stats.imagesFromWikimedia++;
          }
        }

        if (dryRun) {
          if (match) stats.mergedIntoDeskline++;
          else if (curatedRow) stats.mergedIntoCurated++;
          else if (existingBySourceId.has(key)) stats.updated++;
          else stats.inserted++;
          continue;
        }

        // Dublette einer anderen kuratierten Quelle: Merkmale vereinigen,
        // Eintrag der ersten Quelle bleibt fuehrend (Notiz, Quelle, Bild).
        if (curatedRow && !existingBySourceId.has(key)) {
          const prev = parseCuratedAccessibility(curatedRow.accessibility_curated);
          const mine = curatedAccessibilityOf(entry, file);
          const features = [...new Set([...(prev?.features ?? []), ...mine.features])];
          const patch: Record<string, unknown> = {
            accessibility_curated: prev ? { ...prev, features } : mine,
            updated_at: nowIso,
          };
          if (!matchHasImage && images.length > 0) patch.images = images.map(toImageJson);
          const { error } = await supabase.from('poi_activities').update(patch).eq('id', curatedRow.id);
          if (error) throw new Error(`Merge kuratiert ${curatedRow.id}: ${error.message}`);
          stats.mergedIntoCurated++;
          continue;
        }

        if (match) {
          const patch: Record<string, unknown> = {
            accessibility_curated: curatedAccessibilityOf(entry, file),
            updated_at: nowIso,
          };
          if (!matchHasImage && images.length > 0) patch.images = images.map(toImageJson);
          const { error } = await supabase.from('poi_activities').update(patch).eq('id', match.id);
          if (error) throw new Error(`Merge ${match.id}: ${error.message}`);
          stats.mergedIntoDeskline++;
          continue;
        }

        const existing = existingBySourceId.get(key);
        if (existing) {
          const row = buildCuratedUpdateRow(file, entry, place, images, nowIso);
          const { error } = await supabase.from('poi_activities').update(row).eq('id', existing.id);
          if (error) throw new Error(`Update ${existing.id}: ${error.message}`);
          stats.updated++;
        } else {
          const row = buildCuratedInsertRow(file, entry, place, images, nowIso);
          const { data, error } = await supabase.from('poi_activities').insert(row).select('id').single();
          if (error || !data) throw new Error(`Insert: ${error?.message ?? 'keine Zeile'}`);
          existingBySourceId.set(key, { id: (data as { id: string }).id });
          stats.inserted++;
        }
      } catch (err) {
        stats.errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    writeFileSync(GEO_CACHE, JSON.stringify(geoCache, null, 2) + '\n');
    console.log(`[import-barrierefrei] ${file.source}: ${file.entries.length} Eintraege verarbeitet`);
  }

  if (!dryRun) {
    const { error } = await supabase.rpc('recompute_activity_quality_scores');
    if (error) stats.errors.push(`recompute_activity_quality_scores: ${error.message}`);
  }

  console.log(
    `[import-barrierefrei] ${stats.entries} Eintraege: ${stats.inserted} neu, ${stats.updated} aktualisiert, ` +
      `${stats.mergedIntoDeskline} in Deskline-Zeilen gemerged, ${stats.mergedIntoCurated} Dubletten anderer Quellen gemerged, ${stats.geocoded} geocodiert, ` +
      `${stats.imagesFromWikimedia} Wikimedia-Bilder, ${stats.noCoords} ohne Koordinaten, ` +
      `${stats.outsideRegistry} ausserhalb Registry, ${stats.errors.length} Fehler`,
  );
  for (const e of stats.errors.slice(0, 60)) console.log('  - ' + e);
  if (stats.errors.length > 60) console.log(`  ... ${stats.errors.length - 60} weitere`);
}

if (isDirectRun(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
