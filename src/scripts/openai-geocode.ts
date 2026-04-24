/**
 * OpenAI Geocoding — Batch geocode events using OpenAI API.
 *
 * Three modes:
 * 1. --null (default): Resolve events with NULL coordinates
 * 2. --verify: Re-verify ALL events — send every unique location to OpenAI,
 *    compare with existing coords. If OpenAI disagrees by >500m, flag or correct.
 * 3. --all: Combines both — resolve NULLs AND verify existing coords
 *
 * Features:
 * - Structured JSON output from OpenAI with confidence levels
 * - Austria bbox validation on all results
 * - Deduplicates by location_name + bundesland (many events share same venue)
 * - Caches results in SQLite geocode_cache (prefixed key: gemini::...)
 * - Checkpoint/resume for interrupted runs
 * - Durable backup before --verify/--all mode
 * - Dry-run mode for all modes
 * - Rate-limited at 200ms between API calls
 * - Only accepts high/medium confidence from OpenAI
 *
 * Usage:
 *   npx tsx src/scripts/openai-geocode.ts --dry-run
 *   npx tsx src/scripts/openai-geocode.ts
 *   npx tsx src/scripts/openai-geocode.ts --verify --dry-run
 *   npx tsx src/scripts/openai-geocode.ts --verify
 *   npx tsx src/scripts/openai-geocode.ts --all --dry-run
 *   npx tsx src/scripts/openai-geocode.ts --all
 *   npx tsx src/scripts/openai-geocode.ts --retry-low --dry-run
 *   npx tsx src/scripts/openai-geocode.ts --retry-low
 *   npx tsx src/scripts/openai-geocode.ts --resume
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local (Next.js does this automatically, but tsx does not)
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env.local not found, rely on environment */ }

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { normalizeString } from '../lib/location-normalizer';
import { getCachedGeo, setCachedGeo } from '../lib/geocode-cache';
import * as fs from 'fs';
import * as path from 'path';

// ─── Auth: fail fast if keys missing ──────────────────────────────────────
const openaiApiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!openaiApiKey) {
  console.error('ERROR: Missing OPENAI_API_KEY');
  console.error('Add OPENAI_API_KEY to .env.local or set it in environment.');
  process.exit(1);
}

if (!supabaseUrl) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('ERROR: Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('This script requires the service role key.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiApiKey });
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── CLI args ──────────────────────────────────────────────────────────────
const isDryRun = process.argv.includes('--dry-run');
const isResume = process.argv.includes('--resume');
const isVerifyMode = process.argv.includes('--verify');
const isAllMode = process.argv.includes('--all');
const isRetryLowMode = process.argv.includes('--retry-low');
// Default to --null mode if no other mode specified
const isNullMode = !isVerifyMode && !isAllMode && !isRetryLowMode;

// ─── Constants ─────────────────────────────────────────────────────────────
const BATCH_SIZE = 50;
const RATE_LIMIT_MS = 200;
const VERIFY_DISTANCE_THRESHOLD_M = 500; // 500m threshold for --verify overwrites
const AUSTRIA_BBOX = { minLat: 46.3, maxLat: 49.1, minLng: 9.5, maxLng: 17.2 };

/** Confidences that must NOT be overwritten by AI geocoding */
const PROTECTED_CONFIDENCES = new Set(['manual', 'scraper']);

/** Confidence rank — lower = higher priority. AI geocoding can only overwrite lower-ranked. */
const CONFIDENCE_RANK: Record<string, number> = {
  manual: 0,
  scraper: 1,
  exact: 2,
  normalized: 3,
  from_title: 4,
  from_description: 5,
  nominatim: 6,
  gemini: 7,
  gemini_low: 8,
};

function getConfidenceRank(confidence: string | null | undefined): number {
  if (!confidence) return Infinity;
  return CONFIDENCE_RANK[confidence] ?? Infinity;
}

const modeLabel = isRetryLowMode ? 'RETRY-LOW' : isAllMode ? 'ALL' : isVerifyMode ? 'VERIFY' : 'NULL';
const CHECKPOINT_FILE = path.resolve(`data/gemini-geocode-${modeLabel.toLowerCase()}-checkpoint.json`);

// ─── OpenAI JSON schema for structured output ────────────────────────────
// (no special imports needed — OpenAI uses standard JSON Schema)

const SYSTEM_PROMPT = `You are an Austrian geography expert. Given a location name and context (Bundesland, address, PLZ, event title), return the precise coordinates AND the 4-digit Austrian postal code.

RULES:
- You MUST return coordinates within Austria (lat 46.3-49.1, lng 9.5-17.2)
- Use 6 decimal places for coordinates
- For venue names (hotels, restaurants, theaters, etc.), return the venue's exact coordinates
- For generic names like "Hauptplatz", use the Bundesland context to determine the correct city
- If the location is a well-known Austrian venue, landmark, or place, use your knowledge
- postal_code: always return the 4-digit Austrian PLZ for the resolved location.
  - If the input already contains a PLZ, verify it and echo it back.
  - If no PLZ was supplied, derive it from the resolved city/venue (every point in Austria falls in some PLZ).
  - Return null ONLY if you are returning lat=0, lng=0 (truly unresolvable).
- confidence must be "high", "medium", or "low":
  - "high": you know this exact place (e.g., "Schloss Schoenbrunn" -> 48.184516, 16.312236)
  - "medium": you can make a good estimate based on context (e.g., "Gemeindesaal" + "Burgenland, 7000 Eisenstadt")
  - "low": you are uncertain or guessing — return your best guess but mark as low
- If you truly cannot determine any plausible location, return latitude=0, longitude=0, confidence="low", postal_code=null

EXAMPLES:
- "Schloss Esterhazy" + Burgenland -> { latitude: 47.845833, longitude: 16.518611, confidence: "high", resolved_name: "Schloss Esterhazy, Eisenstadt, Burgenland", postal_code: "7000" }
- "Hauptplatz" + Steiermark -> { latitude: 47.070714, longitude: 15.438889, confidence: "medium", resolved_name: "Hauptplatz, Graz, Steiermark", postal_code: "8010" }
- "Wiener Stadthalle" + Wien -> { latitude: 48.201667, longitude: 16.330000, confidence: "high", resolved_name: "Wiener Stadthalle, Wien", postal_code: "1150" }
- "Kulturhaus" + Burgenland, 7400 -> { latitude: 47.2854, longitude: 16.2646, confidence: "medium", resolved_name: "Kulturhaus, Oberwart, Burgenland", postal_code: "7400" }`;

// ─── Helpers ───────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isInAustriaBbox(lat: number, lng: number): boolean {
  return lat >= AUSTRIA_BBOX.minLat && lat <= AUSTRIA_BBOX.maxLat &&
    lng >= AUSTRIA_BBOX.minLng && lng <= AUSTRIA_BBOX.maxLng;
}

function getDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract a city hint from the event title, e.g., "Konzert in Eisenstadt" -> "Eisenstadt"
 */
function extractCityHint(title: string): string | null {
  // Common patterns: "... in <City>", "... - <City>", "<City>: ..."
  const inMatch = title.match(/\bin\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+(?:am|an|bei|ob)\s+[A-ZÄÖÜ][a-zäöüß]+)?)/);
  if (inMatch) return inMatch[1];

  const dashMatch = title.match(/\s[-–]\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+(?:am|an|bei|ob)\s+[A-ZÄÖÜ][a-zäöüß]+)?)$/);
  if (dashMatch) return dashMatch[1];

  return null;
}

// ─── Checkpoint ────────────────────────────────────────────────────────────

interface Checkpoint {
  processedKeys: string[];
  backupPath?: string;
  timestamp: string;
}

function saveCheckpoint(processedKeys: string[], backupPath: string | null): void {
  const data: Checkpoint = { processedKeys, backupPath: backupPath ?? undefined, timestamp: new Date().toISOString() };
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function clearCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
}

// ─── Backup ────────────────────────────────────────────────────────────────

interface BackupEntry {
  id: string;
  old_latitude: number | null;
  old_longitude: number | null;
  old_geocoding_confidence: string | null;
  old_geocoding_source: string | null;
}

async function createBackup(events: EventRow[]): Promise<string> {
  const backupDir = path.resolve('data');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, `coord-backup-gemini-${getDateString()}.json`);

  const entries: BackupEntry[] = events.map(e => ({
    id: e.id,
    old_latitude: e.latitude,
    old_longitude: e.longitude,
    old_geocoding_confidence: e.geocoding_confidence,
    old_geocoding_source: e.geocoding_source,
  }));

  fs.writeFileSync(backupPath, JSON.stringify(entries, null, 2));
  console.log(`  Backup created: ${backupPath} (${entries.length} events)`);
  return backupPath;
}

// ─── SQLite cache ──────────────────────────────────────────────────────────

// Shared geocode cache is backed by Supabase via `../lib/geocode-cache`.
// The per-process memo in that module keeps repeated lookups free within a
// single run; the helpers are async because Supabase I/O is async.

// ─── OpenAI API call ──────────────────────────────────────────────────────

interface GeoResult {
  latitude: number;
  longitude: number;
  confidence: 'high' | 'medium' | 'low';
  resolved_name: string;
  /** 4-digit Austrian postcode the AI resolved along with the coords.
   *  Null only for unresolvable inputs (lat=0, lng=0). */
  postal_code: string | null;
}

const RETRY_LOW_SYSTEM_PROMPT = `You are an expert Austrian geography researcher. You must resolve the given location to precise coordinates.

This location was previously UNRESOLVABLE by a simpler model. Try harder:
- Search your knowledge thoroughly for Austrian venues, restaurants, hotels, cultural centers, Gasthäuser, Heurige, community halls
- Consider the Bundesland, PLZ, and any address fragments as strong clues
- For generic names like "Gemeindesaal" or "Mehrzweckhalle", the PLZ or Bundesland should tell you which town
- Austrian PLZ codes are 4 digits: first digit = rough region (1=Wien, 2=NOE-east, 3=NOE-west, 4=OOE, 5=Salzburg, 6=Tirol, 7=Burgenland, 8=Steiermark, 9=Kärnten/Vorarlberg)
- Many Austrian towns have a "Gemeindesaal", "Pfarrsaal", "Kulturhaus" — use the PLZ/town to find the right one
- For venue names with a town suffix (e.g., "Stadtsaal Oberpullendorf"), the town name IS the location

RULES:
- Return coordinates within Austria (lat 46.3-49.1, lng 9.5-17.2)
- Use 6 decimal places
- postal_code: always return the 4-digit Austrian PLZ for the resolved location (echo input PLZ if given, otherwise derive from the resolved town). Return null only if you return lat=0, lng=0.
- confidence: "high" = exact known, "medium" = good estimate from context, "low" = best guess but uncertain
- If truly impossible (no context at all), return latitude=0, longitude=0, confidence="low", postal_code=null
- IMPORTANT: Even "medium" confidence is acceptable — only return "low" if you are genuinely lost

EXAMPLES:
- "Gemeindesaal" + PLZ 7350 + Burgenland -> Oberpullendorf -> { lat: 47.4953, lng: 16.5133, confidence: "medium", resolved: "Gemeindesaal, Oberpullendorf, Burgenland", postal_code: "7350" }
- "Gasthaus zur Post" + PLZ 2630 + NOE -> Ternitz -> { lat: 47.7167, lng: 16.0333, confidence: "medium", resolved: "Gasthaus zur Post, Ternitz, Niederösterreich", postal_code: "2630" }
- "Stadtsaal" + PLZ 8010 + Steiermark -> Graz -> { lat: 47.0707, lng: 15.4395, confidence: "medium", resolved: "Stadtsaal Graz, Steiermark", postal_code: "8010" }`;

async function geocodeWithAI(
  locationName: string,
  bundesland: string | null,
  address: string | null,
  postalCode: string | null,
  titleCityHint: string | null,
  useStrongModel: boolean = false,
): Promise<GeoResult | null> {
  // Build context prompt
  const parts: string[] = [`Location: "${locationName}"`];
  if (bundesland) parts.push(`Bundesland: ${bundesland}`);
  if (postalCode) parts.push(`PLZ: ${postalCode}`);
  if (address) parts.push(`Address: ${address}`);
  if (titleCityHint) parts.push(`City hint from event title: ${titleCityHint}`);

  const userPrompt = parts.join('\n');
  const systemPrompt = useStrongModel ? RETRY_LOW_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const model = useStrongModel ? 'gpt-4o' : 'gpt-4o-mini';

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'geocode_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              latitude: { type: 'number', description: 'Latitude in decimal degrees (WGS84), 6 decimal places' },
              longitude: { type: 'number', description: 'Longitude in decimal degrees (WGS84), 6 decimal places' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'high = exact known, medium = good estimate, low = uncertain' },
              resolved_name: { type: 'string', description: 'Full resolved name e.g. "Schloss Esterhazy, Eisenstadt, Burgenland"' },
              postal_code: {
                type: ['string', 'null'],
                description: '4-digit Austrian PLZ for the resolved location, or null if unresolvable (lat=0, lng=0)',
              },
            },
            required: ['latitude', 'longitude', 'confidence', 'resolved_name', 'postal_code'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text) as GeoResult;

    // Validate structure
    if (typeof parsed.latitude !== 'number' || typeof parsed.longitude !== 'number' ||
        typeof parsed.confidence !== 'string' || typeof parsed.resolved_name !== 'string') {
      console.warn(`  [ai] Invalid response structure for "${locationName}"`);
      return null;
    }

    return parsed;
  } catch (err) {
    console.error(`  [ai] API error for "${locationName}": ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

interface EventRow {
  id: string;
  title: string;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoding_confidence: string | null;
  geocoding_source: string | null;
}

interface UniqueLocation {
  key: string; // normalizedLocation||bundesland||cityHint
  cacheKey: string; // gemini::normalizedLocation||bundesland
  locationName: string; // original (first seen)
  bundesland: string | null;
  address: string | null; // first non-null address seen
  postalCode: string | null; // first non-null PLZ seen
  cityHint: string | null;
  eventIds: string[]; // all events at this location
  events: EventRow[]; // all event rows for this location
}

interface AuditEntry {
  event_id: string;
  location_name: string | null;
  old_lat: number | null;
  old_lng: number | null;
  new_lat: number | null;
  new_lng: number | null;
  old_confidence: string | null;
  new_confidence: string;
  distance_m: number | null;
  action: 'write' | 'overwrite' | 'skip_protected' | 'skip_close' | 'skip_low_confidence' | 'skip_bbox' | 'skip_gemini_null';
  gemini_resolved: string;
}

async function fetchEvents(): Promise<EventRow[]> {
  const allEvents: EventRow[] = [];
  let offset = 0;
  const pageSize = 1000;

  console.log('\nFetching events from Supabase...');

  while (true) {
    let query = supabase
      .from('events')
      .select('id, title, location_name, address, postal_code, bundesland, latitude, longitude, geocoding_confidence, geocoding_source')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    // In null mode, only fetch events with NULL coords
    // In retry-low mode, fetch ALL events (like verify) to catch previously-skipped locations
    if (isNullMode) {
      query = query.is('latitude', null);
    }

    const { data, error } = await query;

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;

    allEvents.push(...(data as EventRow[]));
    offset += data.length;
    process.stdout.write(`  Fetched ${allEvents.length} events...\r`);
    if (data.length < pageSize) break;
  }

  console.log(`  Total events fetched: ${allEvents.length}`);
  return allEvents;
}

function deduplicateLocations(events: EventRow[]): UniqueLocation[] {
  const map = new Map<string, UniqueLocation>();

  for (const e of events) {
    const locationName = e.location_name ?? '';
    if (!locationName.trim()) continue; // Skip events with no location

    const normalized = normalizeString(locationName);
    const bundesland = e.bundesland ?? '';
    const cityHint = extractCityHint(e.title);
    const key = `${normalized}||${bundesland}`;
    const cacheKey = `gemini::${normalized}||${bundesland}`;

    const existing = map.get(key);
    if (existing) {
      existing.eventIds.push(e.id);
      existing.events.push(e);
      // Use first non-null address/PLZ
      if (!existing.address && e.address) existing.address = e.address;
      if (!existing.postalCode && e.postal_code) existing.postalCode = e.postal_code;
      if (!existing.cityHint && cityHint) existing.cityHint = cityHint;
    } else {
      map.set(key, {
        key,
        cacheKey,
        locationName,
        bundesland: e.bundesland,
        address: e.address,
        postalCode: e.postal_code,
        cityHint,
        eventIds: [e.id],
        events: [e],
      });
    }
  }

  return Array.from(map.values());
}

async function main() {
  console.log(`\nOpenAI Geocoding [${modeLabel}] — ${isDryRun ? 'DRY RUN' : 'LIVE MODE'}${isResume ? ' (RESUME)' : ''}`);
  if (isRetryLowMode) {
    console.log('  Using gpt-4o (stronger model) for previously-skipped locations');
  }
  console.log('='.repeat(60));

  // 1. Fetch events
  const events = await fetchEvents();
  if (events.length === 0) {
    console.log('\nNo events to process. Done.');
    return;
  }

  // 2. For --verify/--all/--retry-low mode, filter out protected confidences
  let processableEvents = events;
  if (!isNullMode) {
    processableEvents = events.filter(e => {
      const conf = e.geocoding_confidence;
      return !conf || !PROTECTED_CONFIDENCES.has(conf);
    });
    console.log(`  After filtering protected confidences: ${processableEvents.length} events`);
  }

  // 3. Deduplicate by location
  let uniqueLocations = deduplicateLocations(processableEvents);
  console.log(`  Unique locations (before filter): ${uniqueLocations.length} (from ${processableEvents.length} events)`);

  // 3b. For --retry-low: filter to ONLY locations NOT in the cache (= previously skipped)
  if (isRetryLowMode) {
    const uncachedLocations: UniqueLocation[] = [];
    for (const loc of uniqueLocations) {
      const cached = await getCachedGeo(loc.cacheKey);
      if (cached === null) uncachedLocations.push(loc);
    }
    console.log(`  Uncached locations (skipped/errored): ${uncachedLocations.length} of ${uniqueLocations.length}`);
    uniqueLocations = uncachedLocations;
  }

  console.log(`  Unique locations to process: ${uniqueLocations.length}`);

  // 4. Handle resume
  let processedKeys = new Set<string>();
  let backupPath: string | null = null;
  if (isResume) {
    const checkpoint = loadCheckpoint();
    if (checkpoint) {
      processedKeys = new Set(checkpoint.processedKeys);
      backupPath = checkpoint.backupPath ?? null;
      console.log(`\n  Resuming: ${processedKeys.size} locations already processed`);
      if (backupPath) console.log(`  Using original backup: ${backupPath}`);
    } else {
      console.log('\n  No checkpoint found, starting from beginning');
    }
  }

  // 5. Create backup before --verify/--all/--retry-low (skip on resume or dry-run)
  if (!isDryRun && !isNullMode && !backupPath) {
    console.log('\nCreating durable backup...');
    backupPath = await createBackup(events);
  }

  // 6. Filter out already-processed locations (for resume)
  const locationsToProcess = uniqueLocations.filter(loc => !processedKeys.has(loc.key));
  console.log(`  Locations remaining: ${locationsToProcess.length}`);

  // 7. Process locations
  let geminiCalls = 0;
  let cacheHits = 0;
  let eventsWritten = 0;
  let eventsOverwritten = 0;
  let eventsSkipped = 0;
  const auditLog: AuditEntry[] = [];

  const totalLocations = locationsToProcess.length;
  const allProcessedKeys = Array.from(processedKeys);

  for (let i = 0; i < totalLocations; i++) {
    const loc = locationsToProcess[i];

    // Check shared Supabase cache first
    let lat: number | null = null;
    let lng: number | null = null;
    let confidence: string = 'gemini';
    let resolvedName: string = '';
    // Only set from fresh AI calls — the cross-run geocode_cache stores
    // only lat/lng today, so cached hits leave this null and skip PLZ
    // back-fill. Acceptable: the initial run already wrote the PLZ.
    let aiPostalCode: string | null = null;

    const cached = await getCachedGeo(loc.cacheKey);
    if (cached) {
      lat = cached.latitude;
      lng = cached.longitude;
      confidence = 'gemini';
      resolvedName = '(cached)';
      cacheHits++;
    } else {
      // Call AI — gpt-4o for retry-low, gpt-4o-mini otherwise
      const result = await geocodeWithAI(
        loc.locationName,
        loc.bundesland,
        loc.address,
        loc.postalCode,
        loc.cityHint,
        isRetryLowMode, // use stronger model
      );
      geminiCalls++;

      if (result) {
        // In retry-low mode: accept ALL confidence levels (gpt-4o is more reliable)
        // In normal mode: only accept high/medium confidence
        if (!isRetryLowMode && result.confidence === 'low') {
          // Log skip for all events at this location
          for (const event of loc.events) {
            auditLog.push({
              event_id: event.id,
              location_name: event.location_name,
              old_lat: event.latitude,
              old_lng: event.longitude,
              new_lat: result.latitude,
              new_lng: result.longitude,
              old_confidence: event.geocoding_confidence,
              new_confidence: 'gemini',
              distance_m: null,
              action: 'skip_low_confidence',
              gemini_resolved: result.resolved_name,
            });
          }
          eventsSkipped += loc.events.length;

          // Still save checkpoint progress
          allProcessedKeys.push(loc.key);
          if (!isDryRun && (i + 1) % BATCH_SIZE === 0) {
            saveCheckpoint(allProcessedKeys, backupPath);
          }

          // Rate limit
          await sleep(RATE_LIMIT_MS);
          process.stdout.write(`  Processing ${i + 1}/${totalLocations} (${geminiCalls} API calls, ${cacheHits} cache hits)...\r`);
          continue;
        }

        // Austria bbox validation
        if (!isInAustriaBbox(result.latitude, result.longitude)) {
          for (const event of loc.events) {
            auditLog.push({
              event_id: event.id,
              location_name: event.location_name,
              old_lat: event.latitude,
              old_lng: event.longitude,
              new_lat: result.latitude,
              new_lng: result.longitude,
              old_confidence: event.geocoding_confidence,
              new_confidence: 'gemini',
              distance_m: null,
              action: 'skip_bbox',
              gemini_resolved: result.resolved_name,
            });
          }
          eventsSkipped += loc.events.length;

          console.warn(`\n  [bbox] Rejected: "${loc.locationName}" -> [${result.latitude}, ${result.longitude}] (${result.resolved_name})`);

          allProcessedKeys.push(loc.key);
          if (!isDryRun && (i + 1) % BATCH_SIZE === 0) {
            saveCheckpoint(allProcessedKeys, backupPath);
          }
          await sleep(RATE_LIMIT_MS);
          process.stdout.write(`  Processing ${i + 1}/${totalLocations} (${geminiCalls} API calls, ${cacheHits} cache hits)...\r`);
          continue;
        }

        // OpenAI returned 0,0 = unable to resolve
        if (result.latitude === 0 && result.longitude === 0) {
          for (const event of loc.events) {
            auditLog.push({
              event_id: event.id,
              location_name: event.location_name,
              old_lat: event.latitude,
              old_lng: event.longitude,
              new_lat: null,
              new_lng: null,
              old_confidence: event.geocoding_confidence,
              new_confidence: 'gemini',
              distance_m: null,
              action: 'skip_gemini_null',
              gemini_resolved: result.resolved_name,
            });
          }
          eventsSkipped += loc.events.length;

          allProcessedKeys.push(loc.key);
          if (!isDryRun && (i + 1) % BATCH_SIZE === 0) {
            saveCheckpoint(allProcessedKeys, backupPath);
          }
          await sleep(RATE_LIMIT_MS);
          process.stdout.write(`  Processing ${i + 1}/${totalLocations} (${geminiCalls} API calls, ${cacheHits} cache hits)...\r`);
          continue;
        }

        lat = result.latitude;
        lng = result.longitude;
        resolvedName = result.resolved_name;
        // In retry-low mode, tag low-confidence results distinctly
        if (isRetryLowMode && result.confidence === 'low') {
          confidence = 'gemini_low';
        }
        // Capture PLZ only if AI returned a well-formed 4-digit code;
        // otherwise leave null so we don't pollute the DB with garbage.
        if (result.postal_code && /^\d{4}$/.test(result.postal_code.trim())) {
          aiPostalCode = result.postal_code.trim();
        }

        // Cache the valid result (shared Supabase cache).
        if (!isDryRun) {
          await setCachedGeo(loc.cacheKey, lat, lng);
        }
      } else {
        // OpenAI returned null (API error)
        eventsSkipped += loc.events.length;

        allProcessedKeys.push(loc.key);
        if (!isDryRun && (i + 1) % BATCH_SIZE === 0) {
          saveCheckpoint(allProcessedKeys, backupPath);
        }
        await sleep(RATE_LIMIT_MS);
        process.stdout.write(`  Processing ${i + 1}/${totalLocations} (${geminiCalls} API calls, ${cacheHits} cache hits)...\r`);
        continue;
      }

      // Rate limit between OpenAI calls
      await sleep(RATE_LIMIT_MS);
    }

    // Apply results to all events at this location
    if (lat !== null && lng !== null) {
      for (const event of loc.events) {
        // Check if event is protected
        if (event.geocoding_confidence && PROTECTED_CONFIDENCES.has(event.geocoding_confidence)) {
          auditLog.push({
            event_id: event.id,
            location_name: event.location_name,
            old_lat: event.latitude,
            old_lng: event.longitude,
            new_lat: lat,
            new_lng: lng,
            old_confidence: event.geocoding_confidence,
            new_confidence: confidence,
            distance_m: null,
            action: 'skip_protected',
            gemini_resolved: resolvedName,
          });
          eventsSkipped++;
          continue;
        }

        if (event.latitude !== null && event.longitude !== null) {
          // Event has existing coords — verify mode logic
          const distM = haversineKm(event.latitude, event.longitude, lat, lng) * 1000;

          // Only overwrite if distance > 500m AND existing confidence <= gemini rank
          if (distM <= VERIFY_DISTANCE_THRESHOLD_M) {
            auditLog.push({
              event_id: event.id,
              location_name: event.location_name,
              old_lat: event.latitude,
              old_lng: event.longitude,
              new_lat: lat,
              new_lng: lng,
              old_confidence: event.geocoding_confidence,
              new_confidence: confidence,
              distance_m: Math.round(distM),
              action: 'skip_close',
              gemini_resolved: resolvedName,
            });
            eventsSkipped++;
            continue;
          }

          const existingRank = getConfidenceRank(event.geocoding_confidence);
          const geminiRank = getConfidenceRank('gemini');

          if (existingRank < geminiRank) {
            // Existing confidence is higher — don't overwrite, just log
            auditLog.push({
              event_id: event.id,
              location_name: event.location_name,
              old_lat: event.latitude,
              old_lng: event.longitude,
              new_lat: lat,
              new_lng: lng,
              old_confidence: event.geocoding_confidence,
              new_confidence: confidence,
              distance_m: Math.round(distM),
              action: 'skip_close', // existing has higher confidence
              gemini_resolved: resolvedName,
            });
            eventsSkipped++;
            continue;
          }

          // Overwrite: distance > 500m AND gemini rank >= existing rank
          auditLog.push({
            event_id: event.id,
            location_name: event.location_name,
            old_lat: event.latitude,
            old_lng: event.longitude,
            new_lat: lat,
            new_lng: lng,
            old_confidence: event.geocoding_confidence,
            new_confidence: confidence,
            distance_m: Math.round(distM),
            action: 'overwrite',
            gemini_resolved: resolvedName,
          });

          if (!isDryRun) {
            // Back-fill postal_code only when event had none — never
            // overwrite an existing PLZ (that came from the scraper or
            // a prior manual entry and is trusted over AI inference).
            const update: Record<string, unknown> = {
              latitude: lat,
              longitude: lng,
              geocoding_confidence: 'gemini',
              geocoding_source: 'gemini',
            };
            if (!event.postal_code && aiPostalCode) {
              update.postal_code = aiPostalCode;
            }
            const { error } = await supabase
              .from('events')
              .update(update)
              .eq('id', event.id);
            if (error) console.error(`  Error updating event ${event.id}: ${error.message}`);
          }
          eventsOverwritten++;
        } else {
          // NULL coords — write directly
          auditLog.push({
            event_id: event.id,
            location_name: event.location_name,
            old_lat: null,
            old_lng: null,
            new_lat: lat,
            new_lng: lng,
            old_confidence: event.geocoding_confidence,
            new_confidence: confidence,
            distance_m: null,
            action: 'write',
            gemini_resolved: resolvedName,
          });

          if (!isDryRun) {
            // Same postal_code rule as the overwrite branch — write only
            // when the event currently has none.
            const update: Record<string, unknown> = {
              latitude: lat,
              longitude: lng,
              geocoding_confidence: 'gemini',
              geocoding_source: 'gemini',
            };
            if (!event.postal_code && aiPostalCode) {
              update.postal_code = aiPostalCode;
            }
            const { error } = await supabase
              .from('events')
              .update(update)
              .eq('id', event.id);
            if (error) console.error(`  Error updating event ${event.id}: ${error.message}`);
          }
          eventsWritten++;
        }
      }
    }

    // Save checkpoint periodically
    allProcessedKeys.push(loc.key);
    if (!isDryRun && (i + 1) % BATCH_SIZE === 0) {
      saveCheckpoint(allProcessedKeys, backupPath);
    }

    process.stdout.write(`  Processing ${i + 1}/${totalLocations} (${geminiCalls} API calls, ${cacheHits} cache hits)...\r`);
  }

  // 8. Report
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('GEMINI GEOCODING REPORT');
  console.log('='.repeat(60));
  console.log(`  Mode:                ${modeLabel}`);
  console.log(`  Total events:        ${processableEvents.length}`);
  console.log(`  Unique locations:    ${uniqueLocations.length}`);
  console.log(`  OpenAI API calls:    ${geminiCalls}`);
  console.log(`  Cache hits:          ${cacheHits}`);
  console.log(`  Events written:      ${eventsWritten} (NULL -> coords)`);
  console.log(`  Events overwritten:  ${eventsOverwritten} (old coords -> OpenAI coords)`);
  console.log(`  Events skipped:      ${eventsSkipped}`);

  // Audit log details
  if (auditLog.length > 0) {
    const actionCounts: Record<string, number> = {};
    for (const entry of auditLog) {
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    }
    console.log('\n  Action breakdown:');
    for (const [action, count] of Object.entries(actionCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${action}: ${count}`);
    }

    // Show corrections (overwrites) in detail
    const corrections = auditLog.filter(e => e.action === 'overwrite');
    if (corrections.length > 0) {
      console.log(`\n${'─'.repeat(100)}`);
      console.log('CORRECTIONS (first 50):');
      console.log('─'.repeat(100));
      console.log(
        'event_id'.padEnd(40) +
        'location'.padEnd(25) +
        'old_lat'.padEnd(10) +
        'old_lng'.padEnd(10) +
        'new_lat'.padEnd(10) +
        'new_lng'.padEnd(10) +
        'dist_m'.padEnd(8) +
        'old_conf'
      );
      console.log('─'.repeat(100));

      for (const entry of corrections.slice(0, 50)) {
        console.log(
          (entry.event_id?.slice(0, 38) ?? '').padEnd(40) +
          (entry.location_name?.slice(0, 23) ?? '').padEnd(25) +
          (entry.old_lat?.toFixed(4) ?? 'NULL').padEnd(10) +
          (entry.old_lng?.toFixed(4) ?? 'NULL').padEnd(10) +
          (entry.new_lat?.toFixed(4) ?? 'NULL').padEnd(10) +
          (entry.new_lng?.toFixed(4) ?? 'NULL').padEnd(10) +
          (entry.distance_m?.toString() ?? '-').padEnd(8) +
          (entry.old_confidence ?? 'NULL')
        );
      }
      if (corrections.length > 50) {
        console.log(`  ... and ${corrections.length - 50} more corrections`);
      }
    }

    // Show writes (NULL -> coords) summary
    const writes = auditLog.filter(e => e.action === 'write');
    if (writes.length > 0 && isDryRun) {
      console.log(`\n${'─'.repeat(100)}`);
      console.log(`WRITES (first 50 of ${writes.length}):`)
      console.log('─'.repeat(100));
      for (const entry of writes.slice(0, 50)) {
        console.log(
          `  ${entry.event_id?.slice(0, 36)} | ${(entry.location_name ?? '').slice(0, 30).padEnd(30)} -> [${entry.new_lat?.toFixed(4)}, ${entry.new_lng?.toFixed(4)}] (${entry.gemini_resolved})`
        );
      }
      if (writes.length > 50) {
        console.log(`  ... and ${writes.length - 50} more writes`);
      }
    }
  }

  // Clean up
  if (!isDryRun) {
    clearCheckpoint();
    console.log('\n  Geocoding complete. Checkpoint cleared.');
  } else {
    console.log(`\n  DRY RUN complete. Run without --dry-run to apply changes.`);
  }
}

main().catch(err => {
  console.error('OpenAI geocoding failed:', err);
  process.exit(1);
});
