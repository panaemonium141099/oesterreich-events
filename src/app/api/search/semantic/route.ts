/**
 * Natural-language smart event search.
 *
 * POST /api/search/semantic
 * Body: { query: string, limit?: number }
 *
 * fn-19 Phase B: Die komplette Pipeline lebt jetzt in
 * `src/lib/search/smart-search.ts` (runSmartSearch) — Code-Motion, damit
 * der Concierge-Chat (/api/search/chat) sie als Tool aufrufen kann.
 * Diese Route ist nur noch Validierung + Instanz-Cache + HTTP-Mapping;
 * ihr Response-Contract ist UNVERÄNDERT: { query, parsed, matches,
 * count, activityMatches }. `matches`/`count` bleiben event-only —
 * Consumer, die einen Empty-State rendern, MÜSSEN
 * `matches.length > 0 || activityMatches.length > 0` prüfen.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { runSmartSearch, SmartSearchUnavailableError } from '@/lib/search/smart-search';
import { TtlCache } from '@/lib/search/search-cache';

/** fn-19: identische Queries (Doppel-Submit, Sample-Chips, Back-Nav)
 *  15 min lang aus dem Instanz-Cache bedienen — spart den Gemini-Call
 *  und die drei DB-Queries. Datumsanker ('heute') altern innerhalb der
 *  TTL um max. 15 min — akzeptabel. */
const RESPONSE_CACHE_TTL_MS = 15 * 60_000;
const responseCache = new TtlCache<Record<string, unknown>>(RESPONSE_CACHE_TTL_MS);

export async function POST(req: NextRequest) {
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

  const cacheKey = `${rawQuery.toLowerCase()}|${limit}`;
  const cachedPayload = responseCache.get(cacheKey);
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, { headers: { 'x-smart-cache': 'hit' } });
  }

  try {
    const payload = await runSmartSearch(rawQuery, limit);
    responseCache.set(cacheKey, payload as unknown as Record<string, unknown>);
    return NextResponse.json(payload, { headers: { 'x-smart-cache': 'miss' } });
  } catch (e) {
    if (e instanceof SmartSearchUnavailableError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error('[smart-search] unexpected failure:', e);
    return NextResponse.json({ error: 'search unavailable' }, { status: 503 });
  }
}
