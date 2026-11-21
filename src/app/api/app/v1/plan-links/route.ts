/**
 * GET /api/app/v1/plan-links?city=<Stadt>&date=<YYYY-MM-DD> — Hotelsuche für
 * den Plan-Assistenten der nativen App.
 *
 * Der Link ist der Affiliate-Link der Website (`buildBookingUrl`); er wird
 * hier gebaut, damit Kennung und Format an einer Stelle bleiben. Keine
 * Datenbank, keine Nutzerdaten.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { buildBookingUrl } from '@/lib/plans/deep-links';

export function GET(request: NextRequest) {
  const city = (request.nextUrl.searchParams.get('city') ?? '').trim().slice(0, 80);
  const date = request.nextUrl.searchParams.get('date') ?? '';
  if (!city || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'city und date (YYYY-MM-DD) sind nötig.' }, { status: 400 });
  }
  return NextResponse.json(
    { booking: buildBookingUrl(city, date, 1) },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
