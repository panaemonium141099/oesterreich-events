/**
 * Natural-language semantic event search.
 *
 * POST /api/search/semantic
 * Body: { query: string, limit?: number }
 *
 * Pipeline:
 *   1. Parse the query for hard filters (date, price, audience) via
 *      lightweight regex → structured filter set
 *   2. Embed the remaining free-text part with text-embedding-3-small
 *   3. Call pgvector RPC `search_events_semantic` with the embedding
 *      + hard filters applied → top-N by cosine similarity
 *   4. Enrich results with the full event payload and return
 *
 * Example queries that work:
 *   "Ich bin Student und will heute abend billig saufen gehen"
 *   → date=today, price≤günstig, audience=studenten+, embedding≈"saufen
 *     gehen student bar night"
 *
 *   "Romantisches Date für morgen"
 *   → date=tomorrow, occasion=date-night, embedding≈"romantisch dinner date"
 *
 *   "Gratis Wochenende Familie"
 *   → date=weekend, price=gratis, audience=family+, embedding≈"familie kostenlos"
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const LOCATION_MODEL = 'gemini-2.5-flash';

// ────────────────────────────────────────────────────────────────────
// Query parser — pulls structured filters out of the natural-language
// query and returns (strippedQuery, filters). The stripped version is
// what gets embedded; the filters are passed as SQL constraints.
// ────────────────────────────────────────────────────────────────────

/**
 * DetectedLocation — was wir aus der Query extrahieren um das Result-Set
 * hart zu filtern (NICHT mehr nur soft re-rank wie früher).
 *
 *   `district`    — Stadt-Slug der `events.district` matched (z.B.
 *                   `eisenstadt`). Wenn nur Bundesland erwähnt wurde,
 *                   bleibt das `null`.
 *   `bundesland`  — Bundesland-ID der `events.bundesland` matched
 *                   (z.B. `burgenland`). Sicherheitsnetz: wenn der
 *                   district-Filter leer läuft, fallen wir auf die
 *                   gröbere Bundesland-Ebene zurück.
 */
interface DetectedLocation {
  district: string | null;
  bundesland: string | null;
}

interface ParsedFilters {
  afterDate: Date | null;      // exclusive lower bound (e.g. today 00:00)
  beforeDate: Date | null;     // exclusive upper bound (e.g. tomorrow 23:59)
  maxPriceTier: 'gratis' | 'günstig' | 'mittel' | null;
  keywordSignals: string[];    // hints we detected (for response debugging)
  location: DetectedLocation | null;
}

/**
 * Stadt-Keyword → canonical {district, bundesland} aus der DB.
 *
 * Werte gemessen am `events.district` / `events.bundesland`-Format
 * (alles lowercase, ohne Umlaute, slugified). district-Slugs sind die
 * Bezirks-Namen wie sie in der existierenden List-View gefiltert
 * werden — gleicher Match-Mechanismus wie `useFilteredEvents` (case-
 * insensitive equality auf `e.district`).
 *
 * Wien ist Sonderfall: Stadt und Bundesland identisch, Bezirke sind
 * 1-23 (zu granular für Stichwort-Suche) — deshalb `district: null`,
 * Filter greift nur auf Bundesland-Ebene.
 */
const CITIES: Record<string, DetectedLocation> = {
  eisenstadt:        { district: 'eisenstadt',      bundesland: 'burgenland' },
  mattersburg:       { district: 'mattersburg',     bundesland: 'burgenland' },
  graz:              { district: 'graz',            bundesland: 'steiermark' },
  leoben:            { district: 'leoben',          bundesland: 'steiermark' },
  kapfenberg:        { district: 'kapfenberg',      bundesland: 'steiermark' },
  linz:              { district: 'linz',            bundesland: 'oberoesterreich' },
  wels:              { district: 'wels',            bundesland: 'oberoesterreich' },
  steyr:             { district: 'steyr',           bundesland: 'oberoesterreich' },
  innsbruck:         { district: 'innsbruck',       bundesland: 'tirol' },
  kufstein:          { district: 'kufstein',        bundesland: 'tirol' },
  bregenz:           { district: 'bregenz',         bundesland: 'vorarlberg' },
  dornbirn:          { district: 'dornbirn',        bundesland: 'vorarlberg' },
  klagenfurt:        { district: 'klagenfurt',      bundesland: 'kaernten' },
  villach:           { district: 'villach',         bundesland: 'kaernten' },
  salzburg:          { district: 'salzburg',        bundesland: 'salzburg' },
  krems:             { district: 'krems',           bundesland: 'niederoesterreich' },
  wienerneustadt:    { district: 'wienerneustadt',  bundesland: 'niederoesterreich' },
  baden:             { district: 'baden',           bundesland: 'niederoesterreich' },
  amstetten:         { district: 'amstetten',       bundesland: 'niederoesterreich' },
  'st pölten':       { district: 'sankt-poelten',   bundesland: 'niederoesterreich' },
  'sankt pölten':    { district: 'sankt-poelten',   bundesland: 'niederoesterreich' },
  wien:              { district: null,              bundesland: 'wien' },
  vienna:            { district: null,              bundesland: 'wien' },
};

/** Bundesland-Keyword → canonical Bundesland-ID. Akzeptiert Umlaut- und
 *  Nicht-Umlaut-Schreibweisen, da die User das durcheinander tippen. */
const BUNDESLAENDER_KEYS: Record<string, string> = {
  burgenland: 'burgenland',
  niederösterreich: 'niederoesterreich', niederoesterreich: 'niederoesterreich',
  oberösterreich: 'oberoesterreich', oberoesterreich: 'oberoesterreich',
  steiermark: 'steiermark',
  tirol: 'tirol',
  vorarlberg: 'vorarlberg',
  kärnten: 'kaernten', kaernten: 'kaernten',
};

function detectLocationRegex(q: string): DetectedLocation | null {
  const lower = q.toLowerCase();
  // Stadt zuerst (spezifischer) — dadurch matched "eisenstadt" auf
  // {district:'eisenstadt', bundesland:'burgenland'} statt nur auf
  // burgenland (würde sonst auch Mattersburg-Events einschließen).
  for (const [key, loc] of Object.entries(CITIES)) {
    const re = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(lower)) return loc;
  }
  for (const [key, bl] of Object.entries(BUNDESLAENDER_KEYS)) {
    const re = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(lower)) return { district: null, bundesland: bl };
  }
  return null;
}

/**
 * Tippfehler-tolerante Ort-Extraktion via Gemini.
 *
 * Wird NUR aufgerufen wenn der Regex-Pass nichts gefunden hat — der
 * deckt die korrekt geschriebenen Häufig-Fälle ab und spart pro Call
 * den AI-Roundtrip. Für "eisenstad" / "Eisenstatt" / "burgnland" etc.
 * (alle Regex-Misser) springt der AI-Pass ein.
 *
 * Whitelist-Guard: das Model darf nur Strings aus unseren Maps
 * zurückgeben, alles andere wird zu `null` gemapped. Verhindert
 * Halluzinationen die durchsickern.
 */
async function normalizeLocationViaAI(query: string, geminiKey: string): Promise<DetectedLocation | null> {
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const cityList = Object.keys(CITIES).join(', ');
  const blList = Object.keys(BUNDESLAENDER_KEYS).join(', ');
  const systemInstruction =
`Du extrahierst aus einer österreichischen Event-Suchanfrage den erwähnten Ort und gibst ihn als canonical Name zurück.

Erlaubte Städte/Bezirke: ${cityList}
Erlaubte Bundesländer: ${blList}

Regeln:
- Tippfehler/Umlaut-Varianten korrigieren ("eisenstad" → eisenstadt, "Eisenstatt" → eisenstadt, "burgnland" → burgenland, "Niederöstereich" → niederösterreich)
- "in [X]" / "im [X]" / "rund um [X]" / "bei [X]" / einzelnes Ortswort → X extrahieren
- Stadt > Bundesland (wenn Stadt klar erkannt, gib Stadt zurück)
- Nicht-österreichische Orte, unbekannte Orte oder keine Erwähnung → null
- Antworte STRIKT mit einem Eintrag aus den Listen oben (lowercase) ODER null. Niemals eine andere Schreibweise.`;

  try {
    const resp = await ai.models.generateContent({
      model: LOCATION_MODEL,
      contents: query,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            match: { type: Type.STRING, nullable: true },
          },
        },
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 50,
        temperature: 0,
      },
    });

    const text = resp.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { match?: string | null };
    const match = typeof parsed.match === 'string' ? parsed.match.toLowerCase().trim() : null;
    if (!match) return null;
    if (CITIES[match]) return CITIES[match];
    if (BUNDESLAENDER_KEYS[match]) return { district: null, bundesland: BUNDESLAENDER_KEYS[match] };
    return null;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.error('[location-ai]', e);
    return null;
  }
}

function parseQuery(raw: string): { text: string; filters: ParsedFilters } {
  const q = raw.toLowerCase();
  const signals: string[] = [];
  const location = detectLocationRegex(raw);
  const filters: ParsedFilters = {
    afterDate: null,
    beforeDate: null,
    maxPriceTier: null,
    keywordSignals: signals,
    location,
  };
  if (location?.district) signals.push(`location:district:${location.district}`);
  if (location?.bundesland) signals.push(`location:bundesland:${location.bundesland}`);

  // ─── Date signals ───
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const endOfTomorrow = new Date(endOfToday); endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  // "heute" / "heute abend" / "tonight"
  if (/\b(heute|tonight|today)\b/.test(q)) {
    filters.afterDate = startOfToday;
    filters.beforeDate = endOfToday;
    signals.push('today');
  }
  // "morgen" / "tomorrow"
  else if (/\b(morgen|tomorrow)\b/.test(q)) {
    filters.afterDate = startOfTomorrow;
    filters.beforeDate = endOfTomorrow;
    signals.push('tomorrow');
  }
  // "dieses wochenende" / "am wochenende" / "weekend"
  else if (/\b(wochenende|weekend)\b/.test(q)) {
    // Find next Saturday-Sunday window
    const day = now.getDay(); // 0 = Sun, 6 = Sat
    const daysToSat = (6 - day + 7) % 7;
    const sat = new Date(startOfToday);
    sat.setDate(sat.getDate() + daysToSat);
    const sun = new Date(sat);
    sun.setDate(sun.getDate() + 1);
    sun.setHours(23, 59, 59, 999);
    filters.afterDate = sat;
    filters.beforeDate = sun;
    signals.push('weekend');
  }

  // ─── Price signals ───
  if (/\b(gratis|kostenlos|free|umsonst)\b/.test(q)) {
    filters.maxPriceTier = 'gratis';
    signals.push('price:gratis');
  } else if (/\b(billig|günstig|cheap|sparsam|kleines budget|unter 20|unter 10|unter 15)\b/.test(q)) {
    filters.maxPriceTier = 'günstig';
    signals.push('price:günstig');
  }

  // ─── Strip recognized date/price words from the text that gets
  // embedded, so the model focuses on the actual activity/vibe intent.
  let stripped = raw;
  const stripPatterns = [
    /\b(heute|tonight|today|morgen|tomorrow|dieses wochenende|am wochenende|weekend)\b/gi,
    /\b(gratis|kostenlos|free|umsonst|billig|günstig|cheap)\b/gi,
    /\b(ich bin|ich will|ich möchte|ich suche|suche|will|möchte)\b/gi,
  ];
  for (const re of stripPatterns) stripped = stripped.replace(re, ' ');
  stripped = stripped.replace(/\s+/g, ' ').trim();

  return { text: stripped || raw, filters };
}

// ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  let body: { query?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const rawQuery = (body.query ?? '').trim();
  if (!rawQuery) return NextResponse.json({ error: 'query required' }, { status: 400 });
  if (rawQuery.length > 500) {
    return NextResponse.json({ error: 'query too long (max 500 chars)' }, { status: 400 });
  }
  const limit = Math.min(Math.max(1, body.limit ?? 20), 50);

  // 1. Parse — regex-Pass für Ort (deckt korrekt geschriebene Fälle ab)
  const { text: embedText, filters } = parseQuery(rawQuery);

  // 2. Parallel: embedding + AI-Location-Normalisierung (nur wenn regex
  //    nichts gefunden hat, sonst sparen wir den AI-Call). AI ist
  //    ausschließlich für Tippfehler/Varianten zuständig — der Regex
  //    bleibt der schnelle Pfad für die Häufig-Fälle.
  const openai = new OpenAI({ apiKey: openaiKey });
  const geminiKey = process.env.GEMINI_API_KEY;
  const aiLocationPromise: Promise<DetectedLocation | null> =
    (!filters.location && geminiKey)
      ? normalizeLocationViaAI(rawQuery, geminiKey)
      : Promise.resolve(null);

  let queryEmbedding: number[];
  let aiLocation: DetectedLocation | null = null;
  try {
    const [embedResp, aiLoc] = await Promise.all([
      openai.embeddings.create({ model: EMBEDDING_MODEL, input: embedText }),
      aiLocationPromise,
    ]);
    queryEmbedding = embedResp.data[0]?.embedding ?? [];
    aiLocation = aiLoc;
    if (queryEmbedding.length !== 1536) {
      return NextResponse.json({ error: 'embedding failed' }, { status: 500 });
    }
  } catch (e) {
    console.error('[semantic-search] embed failed:', e);
    return NextResponse.json({ error: 'embedding service unavailable' }, { status: 502 });
  }

  // AI ergänzt regex — regex gewinnt wenn beide hits haben (deterministisch).
  if (!filters.location && aiLocation) {
    filters.location = aiLocation;
    if (aiLocation.district) filters.keywordSignals.push(`location:district:${aiLocation.district}:ai`);
    if (aiLocation.bundesland) filters.keywordSignals.push(`location:bundesland:${aiLocation.bundesland}:ai`);
  }

  // 3. Call the RPC
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  // Future-only: nie past events durchsuchen (auch nicht gestern).
  // Default = heute 00:00:00 lokal so dass ganztägige Events (start_date
  // ist tag-genau) noch reinkommen wenn sie heute laufen. Past events
  // belasten den HNSW-Index unnötig — siehe Memory-Note
  // reference_semantic_search_future_only.md.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const afterDate = (filters.afterDate ?? today).toISOString();

  // RPC filtert jetzt direkt nach district/bundesland (siehe Migration
  // 20260520_*_extend_search_events_semantic_with_location_filters).
  // Damit braucht es keinen Kandidaten-Pool-Overshoot mehr — die RPC
  // gibt die top-N Eisenstadt-Events nach Similarity zurück, nicht
  // global top-N und dann post-filter (das verlor Eisenstadt-Events
  // sobald rural Burgenland-Heurigen höhere Similarity hatten).
  //
  // district hat Vorrang vor bundesland (wenn beide gesetzt). Wenn der
  // User die Stadt nennt, respektieren wir das hart — bundesland-Fallback
  // wäre irreführend ("23 Treffer in Eisenstadt" wo eigentlich Kukmirn,
  // Rudersdorf etc. drinstanden).
  const filterDistrict = filters.location?.district ?? null;
  const filterBundesland = filterDistrict ? null : (filters.location?.bundesland ?? null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: matches, error: rpcErr } = await (supabase.rpc as any)('search_events_semantic', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_limit: limit,
    min_similarity: 0.2,    // filter out very loose matches
    filter_after_date: afterDate,
    filter_max_price_tier: filters.maxPriceTier,
    filter_bundesland: filterBundesland,
    filter_district: filterDistrict,
  });

  if (rpcErr) {
    console.error('[semantic-search] RPC failed:', rpcErr);
    // Most common cause: pgvector extension not enabled yet, or the
    // RPC wasn't created. Surface a useful hint.
    const hint = rpcErr.message.includes('does not exist') || rpcErr.message.includes('search_events_semantic')
      ? 'Run the SQL migration 20260423_semantic_search_embeddings.sql in Supabase first.'
      : rpcErr.message;
    return NextResponse.json({ error: `semantic search unavailable: ${hint}` }, { status: 503 });
  }

  const matchList = (matches ?? []) as Array<{ id: string; title: string; similarity: number }>;
  if (matchList.length === 0) {
    return NextResponse.json({
      query: rawQuery,
      parsed: {
        embedded_text: embedText,
        after_date: filters.afterDate?.toISOString() ?? null,
        before_date: filters.beforeDate?.toISOString() ?? null,
        max_price_tier: filters.maxPriceTier,
        signals: filters.keywordSignals,
        location_district: filters.location?.district ?? null,
        location_bundesland: filters.location?.bundesland ?? null,
      },
      matches: [],
      count: 0,
    });
  }

  // 4. Hydrate full event records for the top matches
  const ids = matchList.map(m => m.id);
  const { data: events } = await supabase
    .from('events')
    .select('id, title, description, start_date, end_date, location_name, postal_code, address, bundesland, latitude, longitude, category, tags, image_url, price_text, price_tier, slug, audience, vibe, occasion_tags, is_student_friendly, is_family_friendly, duration_type')
    .in('id', ids);

  // Preserve similarity order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventMap = new Map<string, any>((events ?? []).map((e: any) => [e.id, e]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hydrated: any[] = matchList
    .map(m => {
      const ev = eventMap.get(m.id);
      return ev ? { ...ev, _similarity: m.similarity } : null;
    })
    .filter(Boolean);

  // Kein TS-Post-Filter mehr nötig — die RPC filtert jetzt direkt
  // nach district/bundesland (siehe oben). Falls 0 Eisenstadt-Events
  // semantisch passen, kriegt der User ehrlich eine leere Liste statt
  // 23 falscher Heurigen aus dem Rest von Burgenland.

  return NextResponse.json({
    query: rawQuery,
    parsed: {
      embedded_text: embedText,
      after_date: filters.afterDate?.toISOString() ?? null,
      before_date: filters.beforeDate?.toISOString() ?? null,
      max_price_tier: filters.maxPriceTier,
      signals: filters.keywordSignals,
      location_district: filters.location?.district ?? null,
      location_bundesland: filters.location?.bundesland ?? null,
    },
    matches: hydrated,
    count: hydrated.length,
  });
}
