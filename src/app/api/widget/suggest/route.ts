/**
 * GET /api/widget/suggest?q=… — Typeahead für den Widget-Generator auf
 * /fuer-firmen#widget. Matcht Regionen, Bezirke und ~2.000 Gemeinden aus
 * rein statischen Daten (kein DB-Zugriff) — die Liste wäre zu groß fürs
 * Client-Bundle, deshalb serverseitig gefiltert. Antworten sind am Edge
 * cachebar (pro q), die Daten ändern sich nur mit Deployments.
 */
import { NextRequest, NextResponse } from 'next/server';
import { suggestWidgetScopes } from '@/lib/widget/scopes';

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const suggestions = suggestWidgetScopes(q, 8);
  return NextResponse.json(
    { suggestions },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
