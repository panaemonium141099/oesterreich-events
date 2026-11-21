/**
 * POST /api/app/v1/search — Smart-Suche der nativen App.
 *
 * Body `{ "query": "Konzert am Samstag in Graz, günstig" }` (höchstens 500
 * Zeichen). Sucht mit `runSmartSearch` (dieselbe Suche wie
 * `/api/search/semantic`, 40 Treffer wie /entdecken) und rechnet das
 * Ergebnis in das um, was die Seite zeigt (`src/lib/app-api/search.ts`).
 *
 * Jede neue Anfrage kostet einen Gemini-Aufruf (Kontingent, siehe
 * MASTERPLAN) und mehrere Datenbank-Abfragen: gleiche Anfragen kommen
 * 15 Minuten aus dem Speicher des Servers, wie bei der Website.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createTranslator } from 'next-intl';
import type { AppTranslate } from '@/lib/app-api/landing';
import { APP_SEARCH_LIMIT, toAppSearch, type AppSearch } from '@/lib/app-api/search';
import { loadMessages } from '@/i18n/messages';
import { TtlCache } from '@/lib/search/search-cache';
import { runSmartSearch, SmartSearchUnavailableError } from '@/lib/search/smart-search';
import { getSite, SITE_ORIGIN } from '@/lib/site';

const MAX_QUERY_LENGTH = 500;
const cache = new TtlCache<AppSearch>(15 * 60_000);

export async function POST(request: NextRequest) {
  let body: { query?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) return NextResponse.json({ error: 'Bitte gib eine Suche ein.' }, { status: 400 });
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: `Die Suche ist zu lang (höchstens ${MAX_QUERY_LENGTH} Zeichen).` }, { status: 400 });
  }

  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store', 'X-LT-Cache': 'hit' } });

  try {
    const [payload, messages] = await Promise.all([
      runSmartSearch(query, APP_SEARCH_LIMIT),
      loadMessages('de', getSite()),
    ]);
    const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
    const result = toAppSearch(payload, { t, locale: 'de', origin: SITE_ORIGIN }, new Date());
    cache.set(key, result);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store', 'X-LT-Cache': 'miss' } });
  } catch (err) {
    if (!(err instanceof SmartSearchUnavailableError)) {
      console.error('[app-api] search:', err instanceof Error ? err.message : err);
    }
    return NextResponse.json(
      { error: 'Die Suche ist gerade nicht erreichbar.' },
      { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
    );
  }
}
