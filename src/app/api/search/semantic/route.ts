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
import { createClient } from '@supabase/supabase-js';
import { bundeslandToId } from '@/lib/bundeslaender';

const EMBEDDING_MODEL = 'text-embedding-3-small';

// ────────────────────────────────────────────────────────────────────
// Query parser — pulls structured filters out of the natural-language
// query and returns (strippedQuery, filters). The stripped version is
// what gets embedded; the filters are passed as SQL constraints.
// ────────────────────────────────────────────────────────────────────

interface ParsedFilters {
  afterDate: Date | null;      // exclusive lower bound (e.g. today 00:00)
  beforeDate: Date | null;     // exclusive upper bound (e.g. tomorrow 23:59)
  maxPriceTier: 'gratis' | 'günstig' | 'mittel' | null;
  keywordSignals: string[];    // hints we detected (for response debugging)
  /** Bundesland the user mentioned (for soft re-ranking only). */
  locationBundesland: string | null;
}

/**
 * Stadt/Region → canonical Bundesland-ID Mapping für Soft-Re-Ranking.
 *
 * Wir geben hier nur Roh-Strings — die werden alle durch
 * `bundeslandToId()` aus `src/lib/bundeslaender.ts` durchgejagt, das
 * dieselbe Normalisierung macht die auch die Listen-View nutzt
 * (Umlaute, Shortcodes, etc.). Dadurch garantiert das Re-Ranking-Filter
 * gegen `event.bundesland` (DB-Format) konsistent matched.
 */
const CITY_TO_BUNDESLAND_RAW: Record<string, string> = {
  // Wien
  wien: 'wien', vienna: 'wien',
  // Niederösterreich
  'st pölten': 'niederoesterreich', 'sankt pölten': 'niederoesterreich',
  krems: 'niederoesterreich', wienerneustadt: 'niederoesterreich',
  baden: 'niederoesterreich', amstetten: 'niederoesterreich',
  // Oberösterreich
  linz: 'oberoesterreich', wels: 'oberoesterreich', steyr: 'oberoesterreich',
  // Steiermark
  graz: 'steiermark', leoben: 'steiermark', kapfenberg: 'steiermark',
  // Salzburg
  salzburg: 'salzburg',
  // Tirol
  innsbruck: 'tirol', kufstein: 'tirol',
  // Vorarlberg
  bregenz: 'vorarlberg', dornbirn: 'vorarlberg',
  // Kärnten
  klagenfurt: 'kaernten', villach: 'kaernten',
  // Burgenland
  eisenstadt: 'burgenland', mattersburg: 'burgenland',
  // Direct Bundesland-Erwähnungen — sowohl mit als auch ohne Umlauten
  burgenland: 'burgenland',
  niederösterreich: 'niederoesterreich', niederoesterreich: 'niederoesterreich',
  oberösterreich: 'oberoesterreich', oberoesterreich: 'oberoesterreich',
  steiermark: 'steiermark',
  tirol: 'tirol', vorarlberg: 'vorarlberg',
  kärnten: 'kaernten', kaernten: 'kaernten',
};

function detectBundesland(q: string): string | null {
  const lower = q.toLowerCase();
  for (const [key, bl] of Object.entries(CITY_TO_BUNDESLAND_RAW)) {
    const re = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(lower)) return bl;
  }
  return null;
}

function parseQuery(raw: string): { text: string; filters: ParsedFilters } {
  const q = raw.toLowerCase();
  const signals: string[] = [];
  const filters: ParsedFilters = {
    afterDate: null,
    beforeDate: null,
    maxPriceTier: null,
    keywordSignals: signals,
    locationBundesland: detectBundesland(raw),
  };
  if (filters.locationBundesland) {
    signals.push(`location:${filters.locationBundesland}`);
  }

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

  // 1. Parse
  const { text: embedText, filters } = parseQuery(rawQuery);

  // 2. Embed
  const openai = new OpenAI({ apiKey: openaiKey });
  let queryEmbedding: number[];
  try {
    const resp = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: embedText,
    });
    queryEmbedding = resp.data[0]?.embedding ?? [];
    if (queryEmbedding.length !== 1536) {
      return NextResponse.json({ error: 'embedding failed' }, { status: 500 });
    }
  } catch (e) {
    console.error('[semantic-search] embed failed:', e);
    return NextResponse.json({ error: 'embedding service unavailable' }, { status: 502 });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: matches, error: rpcErr } = await (supabase.rpc as any)('search_events_semantic', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_limit: limit,
    min_similarity: 0.2,    // filter out very loose matches
    filter_after_date: afterDate,
    filter_max_price_tier: filters.maxPriceTier,
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
      parsed: { embedded_text: embedText, ...filters },
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
  let hydrated: any[] = matchList
    .map(m => {
      const ev = eventMap.get(m.id);
      return ev ? { ...ev, _similarity: m.similarity } : null;
    })
    .filter(Boolean);

  // ─── Location Re-Ranking (Phase 4.9) ─────────────────────────────
  // Wenn der User explizit eine Stadt/Bundesland erwähnt, sollen Events
  // dort ZUERST kommen, der Rest danach. Innerhalb jeder Gruppe bleibt
  // die ursprüngliche Similarity-Reihenfolge erhalten — kein
  // hard-filter, sondern soft re-rank (stable partition).
  if (filters.locationBundesland) {
    // Beide Seiten durch bundeslandToId normalisieren — handles
    // "Niederösterreich" vs "niederoesterreich" vs "NÖ" / "ktn" etc.
    // Same Logik die auch die FilterDrawer-Pipeline nutzt.
    const target = filters.locationBundesland;
    const matches = (bl: string | null | undefined) => bundeslandToId(bl) === target;
    const inLocation = hydrated.filter(e => matches(e.bundesland));
    const elsewhere = hydrated.filter(e => !matches(e.bundesland));
    hydrated = [...inLocation, ...elsewhere];
  }

  return NextResponse.json({
    query: rawQuery,
    parsed: {
      embedded_text: embedText,
      after_date: filters.afterDate?.toISOString() ?? null,
      before_date: filters.beforeDate?.toISOString() ?? null,
      max_price_tier: filters.maxPriceTier,
      signals: filters.keywordSignals,
      location_bundesland: filters.locationBundesland,
    },
    matches: hydrated,
    count: hydrated.length,
  });
}
